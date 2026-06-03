"""
Supabase REST client for agent heartbeats and model predictions.
Uses httpx (already in requirements) — no extra dependency.
Writes are fire-and-forget: failures are logged but never crash the agent.
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
import httpx
from config.settings import settings

logger = logging.getLogger("supabase_client")

_REST_BASE: str | None = None


def _rest_base() -> str | None:
    """Return the Supabase REST endpoint, or None if not configured."""
    global _REST_BASE
    if _REST_BASE is not None:
        return _REST_BASE
    url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
    if not url or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    _REST_BASE = f"{url}/rest/v1"
    return _REST_BASE


async def upsert_heartbeat(agent_name: str, status_detail: str | None = None) -> None:
    """
    Upsert a row in agent_heartbeats using Supabase PostgREST.
    Safe to call from any async context; swallows all exceptions.
    """
    base = _rest_base()
    if not base:
        return

    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = {
        "agent_name": agent_name,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "status_detail": status_detail,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{base}/agent_heartbeats",
                json=payload,
                headers=headers,
            )
            if resp.status_code not in (200, 201, 204):
                logger.warning(
                    "supabase heartbeat failed: %s %s", resp.status_code, resp.text[:200]
                )
    except Exception as exc:
        logger.debug("supabase heartbeat error (non-fatal): %s", exc)


# ─── Dixon-Coles → unified_predictions writer ──────────────────────────────────
# Runs in parallel to the TS Poisson v1. Distinct model_version + source_table so
# its rows have a distinct (source_table, source_id) dedup key and NEVER overwrite
# the client-served Poisson rows. Promotion to the customer is an explicit
# decision (= production deploy), not done here.

_WORLD_CUP_KEYWORDS = ("world cup", "fifa", "wc 2026", "wc2026")
_COMPETITION_CODES = {"CL": "Champions League", "EL": "Europa League"}


@dataclass(frozen=True)
class DCPrediction:
    """One Dixon-Coles 1X2 prediction ready to be mapped to unified_predictions."""

    match_id: str
    league: str
    league_name: str
    home_team: str
    away_team: str
    kickoff: str  # ISO-8601, used for both starts_at and expires_at
    p_home: float
    p_draw: float
    p_away: float
    home_team_matches: int
    away_team_matches: int
    ci_width: float | None = None  # conformal interval width on the picked outcome


def _competition(league: str, league_name: str) -> str:
    lower = league_name.lower()
    if any(k in lower for k in _WORLD_CUP_KEYWORDS):
        return "World Cup"
    return _COMPETITION_CODES.get(league, league_name)


def _world_cup_stage(league_name: str) -> str | None:
    lower = league_name.lower()
    if not any(k in lower for k in _WORLD_CUP_KEYWORDS):
        return None
    if "final" in lower and "semi" not in lower and "quarter" not in lower:
        return "final"
    if "semi" in lower:
        return "semi"
    if "quarter" in lower:
        return "quarter"
    if "round of 16" in lower or "round16" in lower:
        return "round16"
    return "group"


def _status_from_kickoff(kickoff: str) -> str:
    try:
        ko = datetime.fromisoformat(kickoff)
    except ValueError:
        return "upcoming"
    if ko.tzinfo is None:
        ko = ko.replace(tzinfo=timezone.utc)
    hours_until = (ko - datetime.now(timezone.utc)).total_seconds() / 3600.0
    if hours_until > 24:
        return "upcoming"
    if hours_until > 0:
        return "open"
    return "pending_settlement"


def dc_prediction_to_unified_row(p: DCPrediction) -> dict:
    """
    Map a Dixon-Coles prediction onto the unified_predictions schema.

    No real market odds flow through here yet, so every row is a model estimate
    (is_paper=True, no fabricated edge/bookmaker — same honesty rule as the TS
    adapter's P0 #2). Reliability is gated on the min-match count and, when
    available, the conformal interval width.
    """
    probs = {"HOME": p.p_home, "DRAW": p.p_draw, "AWAY": p.p_away}
    pick = max(probs, key=probs.get)
    pick_prob = probs[pick]

    reliable = (
        min(p.home_team_matches, p.away_team_matches) >= settings.DC_MIN_TEAM_MATCHES
        and (p.ci_width is None or p.ci_width <= settings.DC_MAX_CI_WIDTH)
    )

    fair_odds = round(1.0 / pick_prob, 2) if pick_prob > 0 else None
    confidence = round(pick_prob * 100)

    if reliable:
        signal_type = "signal"
        explanation = (
            f"Dixon-Coles model signal. Pick: {pick} | model probability {confidence}%"
            + (f" | conformal interval width {p.ci_width:.3f}" if p.ci_width is not None else "")
            + ". No live market price attached, so no market edge is claimed."
            " This signal is informational. Bet responsibly."
        )
    else:
        signal_type = "estimate"
        reason = (
            "insufficient sample"
            if min(p.home_team_matches, p.away_team_matches) < settings.DC_MIN_TEAM_MATCHES
            else "wide uncertainty interval"
        )
        explanation = (
            f"Dixon-Coles model estimate ({reason}). Model lean: {pick} | "
            f"probability {confidence}%. Not shown as a value-bet. Bet responsibly."
        )

    return {
        "external_event_id": p.match_id,
        "sport": "football",
        "competition": _competition(p.league, p.league_name),
        "league": p.league,
        "event_name": f"{p.home_team} vs {p.away_team}",
        "home_team": p.home_team,
        "away_team": p.away_team,
        "market": "1X2",
        "pick": pick,
        "bookmaker": "no market",
        "odds": None,
        "fair_odds": fair_odds,
        "edge_percent": None,
        "confidence_score": confidence,
        "risk_level": "medium",
        "status": _status_from_kickoff(p.kickoff),
        "signal_type": signal_type,
        "source": "model",
        "model_version": settings.DC_MODEL_VERSION,
        "plan_access": settings.DC_PLAN_ACCESS,
        "is_historical": False,
        "is_live": False,
        "is_paper": True,
        "is_verified": False,
        "is_demo": False,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "starts_at": p.kickoff,
        "expires_at": p.kickoff,
        "explanation": explanation,
        "neutral_venue": False,
        "world_cup_stage": _world_cup_stage(p.league_name),
        "source_table": settings.DC_SOURCE_TABLE,
        "source_id": p.match_id,
    }


def xg_prediction_to_unified_row(p: DCPrediction) -> dict:
    """Same unified_predictions schema as the DC row, tagged as the xG-enhanced
    model. Paper/parallel: distinct model_version + source_table, so it never
    overwrites the served Poisson v1 rows (promotion to client = explicit deploy)."""
    row = dc_prediction_to_unified_row(p)
    row["model_version"] = settings.XG_MODEL_VERSION
    row["source_table"] = settings.XG_SOURCE_TABLE
    return row


async def upsert_dc_predictions(predictions: list[DCPrediction]) -> int:
    """
    Upsert Dixon-Coles predictions into unified_predictions via PostgREST.

    Dedup key is (source_table, source_id) — matching the TS adapter — but with a
    DC-specific source_table, so these rows live alongside the Poisson v1 rows
    without overwriting them. Returns the number of rows successfully written.
    """
    base = _rest_base()
    if not base:
        return 0

    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    written = 0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for pred in predictions:
                row = dc_prediction_to_unified_row(pred)
                try:
                    resp = await client.post(
                        f"{base}/unified_predictions"
                        "?on_conflict=source_table,source_id",
                        json=row,
                        headers=headers,
                    )
                    if resp.status_code in (200, 201, 204):
                        written += 1
                    else:
                        logger.warning(
                            "dc unified upsert failed: %s %s",
                            resp.status_code,
                            resp.text[:200],
                        )
                except Exception as exc:
                    logger.warning("dc unified upsert error (row skipped): %s", exc)
    except Exception as exc:
        logger.warning("dc unified upsert client error: %s", exc)

    return written
