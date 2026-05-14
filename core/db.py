import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, func
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from config.settings import settings

class Base(DeclarativeBase):
    pass

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True)
    external_id = Column(String, unique=True, index=True)
    league = Column(String)
    home_team = Column(String)
    away_team = Column(String)
    kickoff = Column(DateTime)
    status = Column(String, default="scheduled")

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    match_external_id = Column(String, index=True)
    model_home = Column(Float)
    model_draw = Column(Float)
    model_away = Column(Float)
    market_home_implied = Column(Float)
    market_draw_implied = Column(Float)
    market_away_implied = Column(Float)
    best_edge = Column(Float)
    best_selection = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Bet(Base):
    __tablename__ = "bets"
    id = Column(Integer, primary_key=True)
    match_external_id = Column(String, index=True)
    home_team = Column(String, nullable=True)
    away_team = Column(String, nullable=True)
    kickoff = Column(String, nullable=True)       # ISO string
    league = Column(String, nullable=True)
    matchday_id = Column(String, nullable=True)   # YYYY-MM-DD
    selection = Column(String)
    odds = Column(Float)
    stake = Column(Float)
    paper = Column(Boolean, default=True)
    status = Column(String, default="pending")
    profit_loss = Column(Float, nullable=True)
    betfair_bet_id = Column(String, nullable=True)
    thesis = Column(String, nullable=True)
    placed_at = Column(DateTime, default=datetime.datetime.utcnow)
    settled_at = Column(DateTime, nullable=True)

class LeagueProfile(Base):
    __tablename__ = "league_profiles"
    id = Column(Integer, primary_key=True)
    league_id = Column(String, unique=True, index=True)
    league_name = Column(String)
    strength_tier = Column(Integer, nullable=True)
    market_efficiency = Column(Float, default=0.5)
    predictability_score = Column(Float, default=0.5)
    avg_xg_per_game = Column(Float, nullable=True)
    result_volatility = Column(Float, nullable=True)
    liquidity_score = Column(Float, default=0.5)
    recommended_edge_min = Column(Float, default=0.03)
    total_matches_analyzed = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class MatchClassification(Base):
    __tablename__ = "match_classifications"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, unique=True, index=True)
    league_id = Column(String, index=True)
    match_type = Column(String, default="STANDARD")
    motivation_home = Column(Float, nullable=True)
    motivation_away = Column(Float, nullable=True)
    rest_advantage = Column(Float, nullable=True)
    home_days_rest = Column(Integer, nullable=True)
    away_days_rest = Column(Integer, nullable=True)
    is_derby = Column(Boolean, default=False)
    classified_at = Column(DateTime, default=datetime.datetime.utcnow)


class LeaguePredictabilityLog(Base):
    __tablename__ = "league_predictability_log"
    id = Column(Integer, primary_key=True)
    league_id = Column(String, index=True)
    snapshot_date = Column(DateTime, default=datetime.datetime.utcnow)
    total_predictions = Column(Integer, default=0)
    hit_rate = Column(Float, nullable=True)
    value_bet_hit_rate = Column(Float, nullable=True)
    avg_clv = Column(Float, nullable=True)
    roi = Column(Float, nullable=True)
    brier_score = Column(Float, nullable=True)
    best_bet_type = Column(String, nullable=True)
    worst_bet_type = Column(String, nullable=True)
    confidence_level = Column(String, default="INSUFFICIENT_DATA")
    bet_filter_active = Column(Boolean, default=False)


class DerbyRegistry(Base):
    __tablename__ = "derby_registry"
    id = Column(Integer, primary_key=True)
    team_a = Column(String, index=True)
    team_b = Column(String, index=True)
    league_id = Column(String, nullable=True)
    derby_type = Column(String, default="NATIONAL")
    source = Column(String, default="seed")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Risk Manager tables ───────────────────────────────────────────────────────

class RiskDecisionLog(Base):
    __tablename__ = "risk_decisions"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, index=True)
    league_id = Column(String, index=True)
    approved = Column(Boolean, default=False)
    final_stake = Column(Float, nullable=True)
    base_stake = Column(Float, nullable=True)
    composite_multiplier = Column(Float, nullable=True)
    skip_reason = Column(String, nullable=True)
    circuit_level = Column(String, default="NONE")
    drawdown = Column(Float, default=0.0)
    factors_json = Column(String, nullable=True)   # JSON blob of 7 factors
    decided_at = Column(DateTime, default=datetime.datetime.utcnow)


class BankrollHistory(Base):
    __tablename__ = "bankroll_history"
    id = Column(Integer, primary_key=True)
    bankroll = Column(Float)
    peak_bankroll = Column(Float)
    drawdown = Column(Float, default=0.0)
    circuit_level = Column(String, default="NONE")
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)


class VarianceBudgetLog(Base):
    __tablename__ = "variance_budget_log"
    id = Column(Integer, primary_key=True)
    week_start = Column(DateTime)
    used_variance = Column(Float, default=0.0)
    max_weekly_variance = Column(Float)
    budget_factor = Column(Float, default=1.0)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Learning module tables ────────────────────────────────────────────────────

class DataTrustLog(Base):
    __tablename__ = "data_trust_log"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, index=True)
    feature_name = Column(String)
    source = Column(String)
    trust_score = Column(Float)
    staleness_minutes = Column(Integer)
    validation_flags = Column(String)   # JSON list
    fallback_used = Column(Boolean, default=False)
    fallback_source = Column(String, nullable=True)
    logged_at = Column(DateTime, default=datetime.datetime.utcnow)


class TemporalAuditLog(Base):
    __tablename__ = "temporal_audit_log"
    id = Column(Integer, primary_key=True)
    leakage_count = Column(Integer, default=0)
    leakage_pct = Column(Float, default=0.0)
    auto_corrected = Column(Boolean, default=False)
    blocked = Column(Boolean, default=False)
    checks_run = Column(Integer, default=0)
    audit_timestamp = Column(DateTime)
    report_json = Column(String)   # full JSON


class PredictionExplanation(Base):
    __tablename__ = "prediction_explanations"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, index=True)
    top_features_json = Column(String)   # JSON list
    narrative = Column(String)
    shap_sum = Column(Float)
    base_probability = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FeatureMemoryLog(Base):
    __tablename__ = "feature_memory"
    id = Column(Integer, primary_key=True)
    feature_name = Column(String, index=True)
    rolling_shap_accuracy = Column(Float)
    error_contribution = Column(Float)
    trend = Column(String)
    last_100_accuracy = Column(Float)
    recommended_weight_adjustment = Column(Float)
    sample_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class ErrorPatternLog(Base):
    __tablename__ = "error_patterns_log"
    id = Column(Integer, primary_key=True)
    pattern_name = Column(String, index=True)
    occurrences = Column(Integer, default=0)
    proposal_id = Column(String, nullable=True)
    status = Column(String)   # PENDING | APPROVED | ROLLED_BACK
    requires_approval = Column(Boolean, default=False)
    logged_at = Column(DateTime, default=datetime.datetime.utcnow)


class PlayerProfileLog(Base):
    __tablename__ = "player_profiles"
    id = Column(Integer, primary_key=True)
    player_id = Column(String, index=True, unique=True)
    name = Column(String)
    team = Column(String)
    role = Column(String)
    importance_score = Column(Float)
    status = Column(String, default="AVAILABLE")
    goals_last_5 = Column(Integer, default=0)
    assists_last_5 = Column(Integer, default=0)
    xg_contribution_last_5 = Column(Float, default=0.0)
    minutes_played_last_5 = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class PredictionReasoningLog(Base):
    __tablename__ = "prediction_reasoning"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, index=True)
    step_number = Column(Integer)
    step_json = Column(String)   # JSON step dict
    logged_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Tennis tables ─────────────────────────────────────────────────────────────

class TennisPrediction(Base):
    __tablename__ = "tennis_predictions"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, index=True)
    tournament = Column(String, nullable=True)
    surface = Column(String, nullable=True)
    player1 = Column(String, nullable=False)
    player2 = Column(String, nullable=False)
    scheduled_at = Column(DateTime, nullable=True)
    p1 = Column(Float, nullable=True)
    p2 = Column(Float, nullable=True)
    odds_p1 = Column(Float, nullable=True)
    odds_p2 = Column(Float, nullable=True)
    edge = Column(Float, nullable=True)
    best_selection = Column(String, nullable=True)
    model_version = Column(String, default="elo_v1")
    computed_at = Column(DateTime, default=datetime.datetime.utcnow)


class TennisBet(Base):
    __tablename__ = "tennis_bets"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, nullable=False, index=True)
    selection = Column(String, nullable=False)   # 'P1' or 'P2'
    player_name = Column(String, nullable=True)
    odds = Column(Float, nullable=False)
    stake = Column(Float, nullable=False)
    paper = Column(Boolean, default=True)
    status = Column(String, default="pending")
    profit_loss = Column(Float, nullable=True)
    placed_at = Column(DateTime, default=datetime.datetime.utcnow)
    betfair_bet_id = Column(String, nullable=True)


class EloRating(Base):
    __tablename__ = "elo_ratings"
    player = Column(String, primary_key=True)
    overall = Column(Float, default=1500.0)
    clay = Column(Float, default=1500.0)
    grass = Column(Float, default=1500.0)
    hard = Column(Float, default=1500.0)
    clay_matches = Column(Integer, default=0)
    grass_matches = Column(Integer, default=0)
    hard_matches = Column(Integer, default=0)
    matches = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


from sqlalchemy import select as _select


# ── Settlement helpers ────────────────────────────────────────────────────────

async def get_pending_bets_for_settlement(cutoff_minutes: int = 115) -> list:
    """Return pending bets whose kickoff is at least cutoff_minutes ago."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=cutoff_minutes)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            _select(Bet).where(
                Bet.status == "pending",
                Bet.kickoff.isnot(None),
            )
        )
        rows = result.scalars().all()
    pending = []
    for b in rows:
        try:
            ko = datetime.datetime.fromisoformat(b.kickoff.replace("Z", "+00:00"))
            ko_naive = ko.replace(tzinfo=None)
            if ko_naive <= cutoff:
                pending.append(b)
        except Exception:
            continue
    return pending


async def settle_bet(bet_id: int, outcome: str, profit_loss: float) -> None:
    """Update a bet row: status = won/lost, profit_loss, settled_at."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(_select(Bet).where(Bet.id == bet_id))
        bet = result.scalar_one_or_none()
        if bet:
            bet.status = outcome          # "won" or "lost"
            bet.profit_loss = profit_loss
            bet.settled_at = datetime.datetime.utcnow()
            await session.commit()


async def get_cumulative_pnl() -> float:
    """Sum of all settled bet profit_loss values (paper + live)."""
    from sqlalchemy import func
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            _select(func.coalesce(func.sum(Bet.profit_loss), 0.0)).where(
                Bet.status.in_(["won", "lost"]),
                Bet.profit_loss.isnot(None),
            )
        )
        return float(result.scalar() or 0.0)


# ── Context module persistence helpers ────────────────────────────────────────


async def persist_league_profile(profile: dict) -> None:
    """Upsert a LeagueStrengthAnalyzer profile into league_profiles table."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            _select(LeagueProfile).where(LeagueProfile.league_id == profile["league_id"])
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = LeagueProfile(league_id=profile["league_id"])
            session.add(row)
        row.league_name = profile.get("league_name", "")
        row.strength_tier = profile.get("strength_tier")
        row.market_efficiency = profile.get("market_efficiency", 0.5)
        row.predictability_score = profile.get("predictability_score", 0.5)
        row.avg_xg_per_game = profile.get("avg_xg_per_game")
        row.result_volatility = profile.get("result_volatility")
        row.liquidity_score = profile.get("liquidity_score", 0.5)
        row.recommended_edge_min = profile.get("recommended_edge_min", 0.03)
        row.total_matches_analyzed = profile.get("total_matches_analyzed", 0)
        row.updated_at = datetime.datetime.utcnow()
        await session.commit()


async def persist_match_classification(enriched: dict) -> None:
    """Insert or update a MatchClassification row from a ContextService.enrich() output."""
    match_id = str(enriched.get("match_id", ""))
    if not match_id:
        return
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            _select(MatchClassification).where(MatchClassification.match_id == match_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = MatchClassification(match_id=match_id)
            session.add(row)
        row.league_id = enriched.get("league", "")
        row.match_type = enriched.get("match_type", "STANDARD")
        row.rest_advantage = enriched.get("rest_advantage")
        home_rest = enriched.get("home_days_since_last")
        away_rest = enriched.get("away_days_since_last")
        row.home_days_rest = int(home_rest) if home_rest is not None else None
        row.away_days_rest = int(away_rest) if away_rest is not None else None
        row.is_derby = enriched.get("match_type", "") in ("DERBY_NATIONAL",)
        row.classified_at = datetime.datetime.utcnow()
        await session.commit()


async def persist_predictability_snapshot(metrics: dict) -> None:
    """Append a LeaguePredictabilityLog row (rolling snapshot)."""
    async with AsyncSessionLocal() as session:
        row = LeaguePredictabilityLog(
            league_id=metrics.get("league_id", ""),
            snapshot_date=datetime.datetime.utcnow(),
            total_predictions=metrics.get("total_predictions", 0),
            hit_rate=metrics.get("hit_rate"),
            value_bet_hit_rate=metrics.get("value_bet_hit_rate"),
            avg_clv=metrics.get("avg_clv"),
            roi=metrics.get("roi"),
            brier_score=metrics.get("brier_score"),
            best_bet_type=metrics.get("best_bet_type"),
            worst_bet_type=metrics.get("worst_bet_type"),
            confidence_level=metrics.get("confidence_level", "INSUFFICIENT_DATA"),
            bet_filter_active=bool(metrics.get("bet_filter_active", False)),
        )
        session.add(row)
        await session.commit()
