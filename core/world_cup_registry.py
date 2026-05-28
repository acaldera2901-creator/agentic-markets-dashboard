"""
World Cup 2026 coverage registry and diagnostics helpers.

This module is intentionally data-light: it does not create predictions.
It gives agents a shared source of truth for provider coverage, required
readiness gates and structured heartbeat details.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


WORLD_CUP_CODE = "WC"
WORLD_CUP_API_FOOTBALL_LEAGUE_ID = 1
WORLD_CUP_SEASON = 2026
WORLD_CUP_EXPECTED_MATCHES = 104
WORLD_CUP_START_UTC = "2026-06-11T00:00:00+00:00"
WORLD_CUP_END_UTC = "2026-07-19T23:59:59+00:00"


@dataclass(frozen=True)
class WorldCupGate:
    key: str
    description: str
    required_for_signal: bool = True


@dataclass(frozen=True)
class WorldCupRegistry:
    competition_code: str = WORLD_CUP_CODE
    competition_name: str = "FIFA World Cup 2026"
    season: int = WORLD_CUP_SEASON
    expected_matches: int = WORLD_CUP_EXPECTED_MATCHES
    start_utc: str = WORLD_CUP_START_UTC
    end_utc: str = WORLD_CUP_END_UTC
    status: str = "monitor_only"
    fixture_sources: tuple[str, ...] = ("football-data.org", "api-football", "fifa-static-fallback")
    odds_sources: tuple[str, ...] = ("matchbook", "the-odds-api")
    settlement_sources: tuple[str, ...] = ("football-data.org", "api-football")
    gates: tuple[WorldCupGate, ...] = (
        WorldCupGate("fixture_feed", "World Cup fixtures are available with UTC kickoff."),
        WorldCupGate("odds_feed", "At least one odds provider returns matchable markets."),
        WorldCupGate("venue_context", "Venue, host country and neutral/host context are known."),
        WorldCupGate("national_team_model", "National-team strength baseline exists."),
        WorldCupGate("stage_context", "Group/knockout stage is known."),
        WorldCupGate("settlement_feed", "Result settlement source is available."),
        WorldCupGate("history_writer", "Settled signals can move into history."),
    )


REGISTRY = WorldCupRegistry()


def is_world_cup_code(code: str | None) -> bool:
    return (code or "").upper() == WORLD_CUP_CODE


def api_football_season_for(code: str, fallback_year: int) -> int:
    """World Cup season is the tournament year; domestic leagues keep existing season logic."""
    if is_world_cup_code(code):
        return WORLD_CUP_SEASON
    return fallback_year


def readiness_from_counts(
    fixtures: int,
    odds_markets: int,
    matched_odds: int,
    national_model_ready: bool = False,
    venue_context_ready: bool = False,
    settlement_ready: bool = False,
) -> dict[str, Any]:
    fixture_feed = fixtures > 0
    odds_feed = odds_markets > 0 and matched_odds > 0
    history_writer = settlement_ready
    gates = {
        "fixture_feed": fixture_feed,
        "odds_feed": odds_feed,
        "venue_context": venue_context_ready,
        "national_team_model": national_model_ready,
        "stage_context": fixture_feed,
        "settlement_feed": settlement_ready,
        "history_writer": history_writer,
    }
    required = {g.key for g in REGISTRY.gates if g.required_for_signal}
    ready_for_signal = all(gates.get(key) for key in required)
    missing = [key for key in required if not gates.get(key)]
    return {
        "ready_for_signal": ready_for_signal,
        "status": "signal_ready" if ready_for_signal else "monitor_only",
        "gates": gates,
        "missing": missing,
        "blocked_reason": None if ready_for_signal else ", ".join(missing),
    }


def build_cycle_detail(
    *,
    league_counts: dict[str, dict[str, int]],
    source_errors: list[str] | None = None,
    national_model_ready: bool = False,
    venue_context_ready: bool = False,
    settlement_ready: bool = False,
) -> str:
    """Return compact JSON-safe heartbeat detail for dashboard/Supabase."""
    wc = league_counts.get(WORLD_CUP_CODE, {})
    readiness = readiness_from_counts(
        fixtures=int(wc.get("fixtures", 0)),
        odds_markets=int(wc.get("odds_markets", 0)),
        matched_odds=int(wc.get("matched_odds", 0)),
        national_model_ready=national_model_ready,
        venue_context_ready=venue_context_ready,
        settlement_ready=settlement_ready,
    )
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "type": "data_collector_cycle",
        "world_cup": {
            "registry": asdict(REGISTRY),
            "fixtures": int(wc.get("fixtures", 0)),
            "odds_markets": int(wc.get("odds_markets", 0)),
            "matched_odds": int(wc.get("matched_odds", 0)),
            "published_events": int(wc.get("published_events", 0)),
            "readiness": readiness,
        },
        "leagues": league_counts,
        "source_errors": source_errors or [],
    }
    import json

    return json.dumps(payload, separators=(",", ":"), default=str)[:4000]
