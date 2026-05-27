from fastapi import FastAPI, HTTPException
from core.redis_client import get_redis
from core.db import (
    AsyncSessionLocal, Bet,
    LeagueProfile, MatchClassification, LeaguePredictabilityLog,
    RiskDecisionLog, BankrollHistory, VarianceBudgetLog,
    DataTrustLog, TemporalAuditLog, PredictionExplanation,
    FeatureMemoryLog, ErrorPatternLog, PredictionReasoningLog,
)
from agents.monitor import is_heartbeat_stale, compute_pnl, AGENT_HEARTBEAT_KEYS
from sqlalchemy import select, desc
from config.settings import settings

app = FastAPI(title="Agentic Markets Dashboard")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/agents")
async def agents_status():
    r = await get_redis()
    status = {}
    for agent_key, hb_key in AGENT_HEARTBEAT_KEYS.items():
        hb = await r.get(f"health:{hb_key}")
        if hb is None:
            status[hb_key] = "offline"
        elif is_heartbeat_stale(hb, settings.HEARTBEAT_TIMEOUT):
            status[hb_key] = "stale"
        else:
            status[hb_key] = "running"
    return status


@app.get("/bets")
async def recent_bets(limit: int = 20):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet).order_by(Bet.placed_at.desc()).limit(limit))
        bets = result.scalars().all()
    return [{"id": b.id, "match": b.match_external_id, "selection": b.selection,
             "odds": b.odds, "stake": b.stake, "status": b.status,
             "paper": b.paper, "pnl": b.profit_loss} for b in bets]


@app.get("/pnl")
async def pnl_summary():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet))
        bets = result.scalars().all()
    bet_dicts = [{"stake": b.stake, "odds": b.odds, "status": b.status} for b in bets]
    return {
        "total_pnl": compute_pnl(bet_dicts),
        "total_bets": len(bet_dicts),
        "paper_mode": settings.PAPER_TRADING,
    }


# ── Context Module endpoints ───────────────────────────────────────────────────

@app.get("/api/league/{league_id}/profile")
async def league_profile(league_id: str):
    """League strength + odds + predictability profile."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(LeagueProfile).where(LeagueProfile.league_id == league_id.upper())
        )
        row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"No profile for league {league_id!r}")

    # Attach the latest predictability snapshot
    async with AsyncSessionLocal() as session:
        snap_result = await session.execute(
            select(LeaguePredictabilityLog)
            .where(LeaguePredictabilityLog.league_id == league_id.upper())
            .order_by(desc(LeaguePredictabilityLog.snapshot_date))
            .limit(1)
        )
        snap = snap_result.scalar_one_or_none()

    profile = {
        "league_id": row.league_id,
        "league_name": row.league_name,
        "strength_tier": row.strength_tier,
        "market_efficiency": row.market_efficiency,
        "predictability_score": row.predictability_score,
        "avg_xg_per_game": row.avg_xg_per_game,
        "result_volatility": row.result_volatility,
        "liquidity_score": row.liquidity_score,
        "recommended_edge_min": row.recommended_edge_min,
        "total_matches_analyzed": row.total_matches_analyzed,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "predictability": {
            "confidence_level": snap.confidence_level if snap else "INSUFFICIENT_DATA",
            "hit_rate": snap.hit_rate if snap else None,
            "avg_clv": snap.avg_clv if snap else None,
            "roi": snap.roi if snap else None,
            "brier_score": snap.brier_score if snap else None,
            "bet_filter_active": snap.bet_filter_active if snap else False,
            "best_bet_type": snap.best_bet_type if snap else None,
            "worst_bet_type": snap.worst_bet_type if snap else None,
            "snapshot_date": snap.snapshot_date.isoformat() if snap else None,
        },
    }
    return profile


@app.get("/api/match/{match_id}/context")
async def match_context(match_id: str):
    """Full context classification for a specific match."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(MatchClassification).where(MatchClassification.match_id == match_id)
        )
        row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"No context for match {match_id!r}")

    return {
        "match_id": row.match_id,
        "league_id": row.league_id,
        "match_type": row.match_type,
        "motivation_home": row.motivation_home,
        "motivation_away": row.motivation_away,
        "rest_advantage": row.rest_advantage,
        "home_days_rest": row.home_days_rest,
        "away_days_rest": row.away_days_rest,
        "is_derby": row.is_derby,
        "classified_at": row.classified_at.isoformat() if row.classified_at else None,
    }


@app.get("/api/leagues/summary")
async def leagues_summary():
    """All league profiles ordered by strength tier."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(LeagueProfile).order_by(LeagueProfile.strength_tier)
        )
        rows = result.scalars().all()
    return [
        {
            "league_id": r.league_id,
            "league_name": r.league_name,
            "strength_tier": r.strength_tier,
            "market_efficiency": r.market_efficiency,
            "predictability_score": r.predictability_score,
            "recommended_edge_min": r.recommended_edge_min,
        }
        for r in rows
    ]


# ── Risk Manager endpoints ─────────────────────────────────────────────────────

@app.get("/api/risk/drawdown-status")
async def risk_drawdown_status():
    """Latest bankroll snapshot and circuit breaker level."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(BankrollHistory)
            .order_by(desc(BankrollHistory.recorded_at))
            .limit(1)
        )
        row = result.scalar_one_or_none()
    if row is None:
        return {
            "circuit_level": "NONE",
            "drawdown": 0.0,
            "bankroll": None,
            "peak_bankroll": None,
            "recorded_at": None,
        }
    return {
        "circuit_level": row.circuit_level,
        "drawdown": row.drawdown,
        "bankroll": row.bankroll,
        "peak_bankroll": row.peak_bankroll,
        "recorded_at": row.recorded_at.isoformat() if row.recorded_at else None,
    }


@app.get("/api/risk/portfolio-state")
async def risk_portfolio_state():
    """Current variance budget and recent risk decisions summary."""
    async with AsyncSessionLocal() as session:
        var_result = await session.execute(
            select(VarianceBudgetLog)
            .order_by(desc(VarianceBudgetLog.recorded_at))
            .limit(1)
        )
        var_row = var_result.scalar_one_or_none()

        decisions_result = await session.execute(
            select(RiskDecisionLog)
            .order_by(desc(RiskDecisionLog.decided_at))
            .limit(20)
        )
        decisions = decisions_result.scalars().all()

    approved = [d for d in decisions if d.approved]
    rejected = [d for d in decisions if not d.approved]

    return {
        "variance_budget": {
            "week_start": var_row.week_start.isoformat() if var_row else None,
            "used_variance": var_row.used_variance if var_row else 0.0,
            "max_weekly_variance": var_row.max_weekly_variance if var_row else None,
            "budget_factor": var_row.budget_factor if var_row else 1.0,
        },
        "recent_decisions": {
            "total": len(decisions),
            "approved": len(approved),
            "rejected": len(rejected),
            "avg_stake": round(
                sum(d.final_stake for d in approved if d.final_stake) / len(approved), 2
            ) if approved else 0.0,
        },
        "last_decisions": [
            {
                "match_id": d.match_id,
                "league_id": d.league_id,
                "approved": d.approved,
                "final_stake": d.final_stake,
                "composite_multiplier": d.composite_multiplier,
                "circuit_level": d.circuit_level,
                "skip_reason": d.skip_reason,
                "decided_at": d.decided_at.isoformat() if d.decided_at else None,
            }
            for d in decisions[:5]
        ],
    }


# ── Self-Learning endpoints ────────────────────────────────────────────────────

@app.get("/api/self-learning/corrections-pending")
async def self_learning_corrections_pending():
    """Return pending correction proposals from the SelfLearningEngine."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ErrorPatternLog)
            .where(ErrorPatternLog.status == "PENDING")
            .order_by(desc(ErrorPatternLog.logged_at))
        )
        rows = result.scalars().all()
    return {
        "pending_count": len(rows),
        "proposals": [
            {
                "id": r.id,
                "proposal_id": r.proposal_id,
                "pattern_name": r.pattern_name,
                "occurrences": r.occurrences,
                "requires_approval": r.requires_approval,
                "logged_at": r.logged_at.isoformat() if r.logged_at else None,
            }
            for r in rows
        ],
    }


@app.post("/api/self-learning/approve/{proposal_id}")
async def self_learning_approve(proposal_id: str):
    """Mark a correction proposal as APPROVED."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ErrorPatternLog).where(ErrorPatternLog.proposal_id == proposal_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Proposal not found")
        row.status = "APPROVED"
        await session.commit()
    return {"proposal_id": proposal_id, "status": "APPROVED"}


@app.post("/api/self-learning/rollback/{proposal_id}")
async def self_learning_rollback(proposal_id: str):
    """Rollback an approved correction proposal."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ErrorPatternLog).where(ErrorPatternLog.proposal_id == proposal_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Proposal not found")
        if row.status != "APPROVED":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot rollback proposal with status '{row.status}'",
            )
        row.status = "ROLLED_BACK"
        await session.commit()
    return {"proposal_id": proposal_id, "status": "ROLLED_BACK"}


@app.get("/api/data-trust/current-scores")
async def data_trust_current_scores():
    """Return most recent DataTrustScore per feature."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(DataTrustLog)
            .order_by(desc(DataTrustLog.logged_at))
            .limit(50)
        )
        rows = result.scalars().all()
    seen: dict[str, dict] = {}
    for r in rows:
        if r.feature_name not in seen:
            seen[r.feature_name] = {
                "feature_name": r.feature_name,
                "source": r.source,
                "trust_score": r.trust_score,
                "staleness_minutes": r.staleness_minutes,
                "fallback_used": r.fallback_used,
                "logged_at": r.logged_at.isoformat() if r.logged_at else None,
            }
    return {"features": list(seen.values())}


@app.get("/api/explanations/{match_id}")
async def prediction_explanations(match_id: str):
    """Return the SHAP explanation for a specific match."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(PredictionExplanation)
            .where(PredictionExplanation.match_id == match_id)
            .order_by(desc(PredictionExplanation.created_at))
            .limit(1)
        )
        row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No explanation found for match")
    import json
    return {
        "match_id": row.match_id,
        "top_features": json.loads(row.top_features_json) if row.top_features_json else [],
        "narrative": row.narrative,
        "shap_sum": row.shap_sum,
        "base_probability": row.base_probability,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@app.get("/api/season-phase/{league_id}")
async def season_phase_info(league_id: str, current_matchday: int = 1, total_matchdays: int = 38):
    """Return current season phase and weight config for a league."""
    from learning.season_phase import SeasonPhaseAdapter, SeasonPhase
    adapter = SeasonPhaseAdapter()
    phase = adapter.detect_phase(current_matchday, total_matchdays)
    cfg = adapter.get_config(phase)
    return {
        "league_id": league_id,
        "current_matchday": current_matchday,
        "total_matchdays": total_matchdays,
        "phase": phase.value,
        "config": {
            "xg_weight": cfg.xg_weight,
            "form_weight": cfg.form_weight,
            "pi_rating_weight": cfg.pi_rating_weight,
            "odds_movement_weight": cfg.odds_movement_weight,
            "motivation_weight": cfg.motivation_weight,
            "stake_multiplier": cfg.stake_multiplier,
            "edge_min_boost": cfg.edge_min_boost,
            "dead_rubber_auto_skip": cfg.dead_rubber_auto_skip,
            "notes": cfg.notes,
        },
    }
