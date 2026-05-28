"""
World Cup data quality scoring.

This module turns available fixture/model/odds/context data into an explicit
publishability gate. It does not invent missing information; it gives every
missing layer a visible score penalty and blocked reason.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class WorldCupDataQuality:
    fixture_quality: float
    odds_quality: float
    team_identity_quality: float
    historical_depth_quality: float
    venue_context_quality: float
    squad_news_quality: float
    settlement_quality: float
    total_score: float
    publication_tier: str
    blocked_reasons: list[str]
    required_next: list[str]
    odds_snapshot: dict[str, Any] | None
    provider_event_id: str | None
    provider_source: str | None
    calculated_at: str


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _has_text(value: Any) -> bool:
    return bool(str(value or "").strip())


def _odds_snapshot_from_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    odds = payload.get("odds") or {}
    if not isinstance(odds, dict):
        return None

    home = _safe_float(odds.get("odds_home"))
    draw = _safe_float(odds.get("odds_draw"))
    away = _safe_float(odds.get("odds_away"))
    if not (home and draw and away):
        return None

    overround = round((1.0 / home) + (1.0 / draw) + (1.0 / away) - 1.0, 4)
    return {
        "provider": odds.get("source") or odds.get("provider") or "odds_feed",
        "bookmaker": odds.get("bookmaker") or odds.get("exchange") or "",
        "market": "h2h_90m",
        "odds_home": home,
        "odds_draw": draw,
        "odds_away": away,
        "overround": overround,
        "captured_at": payload.get("collected_at") or datetime.now(timezone.utc).isoformat(),
        "is_closing": False,
    }


def _score_fixture(payload: dict[str, Any]) -> tuple[float, list[str]]:
    missing: list[str] = []
    required = {
        "match_id": payload.get("match_id"),
        "home_team": payload.get("home_team"),
        "away_team": payload.get("away_team"),
        "kickoff": payload.get("kickoff"),
        "league": payload.get("league"),
    }
    for key, value in required.items():
        if not _has_text(value):
            missing.append(f"missing_{key}")
    return (1.0 - (len(missing) / len(required))), missing


def _score_odds(snapshot: dict[str, Any] | None) -> tuple[float, list[str]]:
    if not snapshot:
        return 0.0, ["missing_odds_snapshot"]
    missing: list[str] = []
    if not snapshot.get("bookmaker"):
        missing.append("missing_bookmaker")
    overround = _safe_float(snapshot.get("overround"), 1.0)
    if overround <= 0:
        missing.append("invalid_overround")
    if overround > 0.10:
        missing.append("high_market_overround")
    if overround <= 0.04:
        score = 1.0
    elif overround <= 0.07:
        score = 0.85
    elif overround <= 0.10:
        score = 0.70
    else:
        score = 0.45
    if "missing_bookmaker" in missing:
        score -= 0.10
    return max(score, 0.0), missing


def _score_context(context: dict[str, Any]) -> tuple[float, list[str]]:
    if not context:
        return 0.0, ["missing_world_cup_context"]
    score = _safe_float(context.get("data_completeness_score"), 0.0)
    missing = [f"missing_{field}" for field in context.get("missing_context_fields", [])]
    return max(min(score, 1.0), 0.0), missing


def _score_team_identity(payload: dict[str, Any], context: dict[str, Any]) -> tuple[float, list[str]]:
    missing: list[str] = []
    if not _has_text(payload.get("home_team")):
        missing.append("missing_home_team_identity")
    if not _has_text(payload.get("away_team")):
        missing.append("missing_away_team_identity")
    if context and context.get("stage") == "unknown":
        missing.append("unknown_tournament_stage")
    return max(1.0 - (0.25 * len(missing)), 0.0), missing


def _publication_tier(score: float) -> str:
    if score < 0.65:
        return "monitor_only"
    if score < 0.78:
        return "paper_only"
    if score < 0.85:
        return "signal_allowed"
    return "premium_candidate"


def compute_world_cup_data_quality(
    *,
    payload: dict[str, Any],
    context: dict[str, Any] | None = None,
    national_matchup: dict[str, Any] | None = None,
    settlement_ready: bool = False,
    squad_news_ready: bool = False,
) -> dict[str, Any]:
    context = context or {}
    national_matchup = national_matchup or {}
    odds_snapshot = _odds_snapshot_from_payload(payload)

    fixture_quality, fixture_missing = _score_fixture(payload)
    odds_quality, odds_missing = _score_odds(odds_snapshot)
    team_identity_quality, identity_missing = _score_team_identity(payload, context)
    historical_depth_quality = _safe_float(national_matchup.get("data_quality"), 0.0)
    venue_context_quality, context_missing = _score_context(context)
    squad_news_quality = 1.0 if squad_news_ready else 0.0
    settlement_quality = 1.0 if settlement_ready else 0.0

    total = round(
        (0.20 * fixture_quality)
        + (0.20 * odds_quality)
        + (0.15 * team_identity_quality)
        + (0.15 * historical_depth_quality)
        + (0.10 * venue_context_quality)
        + (0.10 * squad_news_quality)
        + (0.10 * settlement_quality),
        3,
    )
    blocked_reasons = [
        *fixture_missing,
        *odds_missing,
        *identity_missing,
        *context_missing,
    ]
    if historical_depth_quality < 0.75:
        blocked_reasons.append("national_team_history_quality_below_threshold")
    if not squad_news_ready:
        blocked_reasons.append("squad_news_not_connected")
    if not settlement_ready:
        blocked_reasons.append("settlement_not_ready")

    required_next: list[str] = []
    if odds_quality < 0.78:
        required_next.append("connect reliable odds and closing odds snapshots")
    if venue_context_quality < 0.78:
        required_next.append("complete venue/weather/travel/rest context")
    if historical_depth_quality < 0.75:
        required_next.append("connect national-team history/rating dataset")
    if not squad_news_ready:
        required_next.append("connect squad/injury/lineup provider or admin override")
    if not settlement_ready:
        required_next.append("connect settlement/history writer")

    return asdict(
        WorldCupDataQuality(
            fixture_quality=round(fixture_quality, 3),
            odds_quality=round(odds_quality, 3),
            team_identity_quality=round(team_identity_quality, 3),
            historical_depth_quality=round(historical_depth_quality, 3),
            venue_context_quality=round(venue_context_quality, 3),
            squad_news_quality=round(squad_news_quality, 3),
            settlement_quality=round(settlement_quality, 3),
            total_score=total,
            publication_tier=_publication_tier(total),
            blocked_reasons=blocked_reasons,
            required_next=required_next,
            odds_snapshot=odds_snapshot,
            provider_event_id=str(payload.get("provider_event_id") or payload.get("match_id") or ""),
            provider_source=str(payload.get("provider_source") or ""),
            calculated_at=datetime.now(timezone.utc).isoformat(),
        )
    )


def world_cup_data_quality_status_detail(quality: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "world_cup_data_quality",
        "ts": datetime.now(timezone.utc).isoformat(),
        "total_score": quality.get("total_score"),
        "publication_tier": quality.get("publication_tier"),
        "blocked_reasons": quality.get("blocked_reasons", []),
        "required_next": quality.get("required_next", []),
        "provider_event_id": quality.get("provider_event_id"),
        "provider_source": quality.get("provider_source"),
        "odds_snapshot": quality.get("odds_snapshot"),
    }
