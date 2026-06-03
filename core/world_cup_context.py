"""
World Cup 2026 context engine.

This module enriches fixtures with tournament-specific context without
publishing picks. It is deliberately conservative: unknown context is
represented as missing data, not invented as fact.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from core.world_cup_registry import WORLD_CUP_CODE


HOST_TEAMS = {
    "canada": "Canada",
    "mexico": "Mexico",
    "united states": "United States",
    "usa": "United States",
    "us": "United States",
}

HOST_CITY_COUNTRY = {
    "atlanta": "USA",
    "boston": "USA",
    "dallas": "USA",
    "houston": "USA",
    "kansas city": "USA",
    "los angeles": "USA",
    "miami": "USA",
    "new york": "USA",
    "new jersey": "USA",
    "philadelphia": "USA",
    "san francisco": "USA",
    "bay area": "USA",
    "seattle": "USA",
    "toronto": "Canada",
    "vancouver": "Canada",
    "guadalajara": "Mexico",
    "mexico city": "Mexico",
    "monterrey": "Mexico",
}


@dataclass
class WorldCupContext:
    is_world_cup: bool
    stage: str
    group_name: str | None
    matchday_in_group: int | None
    knockout_round: str | None
    venue: str | None
    host_city: str | None
    venue_country: str | None
    neutral_venue: bool
    host_advantage_team: str | None
    rest_days_team_a: int | None
    rest_days_team_b: int | None
    travel_distance_km_team_a: int | None
    travel_distance_km_team_b: int | None
    timezone_shift_team_a: int | None
    timezone_shift_team_b: int | None
    motivation_label_team_a: str
    motivation_label_team_b: str
    market_warning: str | None
    data_completeness_score: float
    missing_context_fields: list[str]
    publication_status: str
    blocked_reason: str | None


def normalize_team(name: str | None) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def _safe_get(data: dict[str, Any], *path: str) -> Any:
    value: Any = data
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def _round_text(fixture: dict[str, Any]) -> str:
    candidates = [
        _safe_get(fixture, "league", "round"),
        fixture.get("round"),
        fixture.get("stage"),
        fixture.get("matchday"),
    ]
    return " ".join(str(v) for v in candidates if v).strip()


def infer_stage(fixture: dict[str, Any]) -> tuple[str, str | None, int | None, str | None]:
    text = _round_text(fixture).lower()
    group_match = re.search(r"group\s+([a-h])", text, re.IGNORECASE)
    group_name = group_match.group(1).upper() if group_match else None

    matchday = None
    md = re.search(r"(?:matchday|round)\s*(\d)", text, re.IGNORECASE)
    if md:
        try:
            matchday = int(md.group(1))
        except ValueError:
            matchday = None

    if "final" in text and "semi" not in text and "third" not in text:
        return "final", group_name, matchday, "final"
    if "third" in text:
        return "third_place", group_name, matchday, "third_place"
    if "semi" in text:
        return "semi", group_name, matchday, "semi"
    if "quarter" in text:
        return "quarter", group_name, matchday, "quarter"
    if "round of 16" in text or "round16" in text:
        return "round16", group_name, matchday, "round16"
    if "round of 32" in text or "round32" in text:
        return "round32", group_name, matchday, "round32"
    if "group" in text:
        return "group", group_name, matchday, None
    return "unknown", group_name, matchday, None


def _venue_text(fixture: dict[str, Any]) -> tuple[str | None, str | None]:
    venue = (
        _safe_get(fixture, "fixture", "venue", "name")
        or fixture.get("venue")
        or _safe_get(fixture, "venue", "name")
    )
    city = (
        _safe_get(fixture, "fixture", "venue", "city")
        or fixture.get("city")
        or _safe_get(fixture, "venue", "city")
    )
    return (str(venue) if venue else None, str(city) if city else None)


def infer_venue_country(venue: str | None, city: str | None) -> str | None:
    haystack = normalize_team(f"{venue or ''} {city or ''}")
    for key, country in HOST_CITY_COUNTRY.items():
        if key in haystack:
            return country
    return None


def infer_host_advantage(team_a: str, team_b: str, venue_country: str | None) -> tuple[bool, str | None]:
    host_country_to_team = {
        "USA": "united states",
        "Canada": "canada",
        "Mexico": "mexico",
    }
    expected = host_country_to_team.get(venue_country or "")
    if not expected:
        return True, None
    a = normalize_team(team_a)
    b = normalize_team(team_b)
    if expected in a or HOST_TEAMS.get(a, "").lower() == expected:
        return False, team_a
    if expected in b or HOST_TEAMS.get(b, "").lower() == expected:
        return False, team_b
    return True, None


def motivation_labels(stage: str, matchday: int | None) -> tuple[str, str]:
    if stage != "group":
        if stage in {"round32", "round16", "quarter", "semi", "third_place", "final"}:
            return "knockout_elimination", "knockout_elimination"
        return "unknown", "unknown"
    if matchday == 3:
        return "scenario_dependent", "scenario_dependent"
    if matchday == 2:
        return "points_pressure", "points_pressure"
    return "baseline_group", "baseline_group"


def market_warning(stage: str) -> str | None:
    if stage in {"round32", "round16", "quarter", "semi", "third_place", "final"}:
        return "Knockout fixture: distinguish 90-minute 1X2 from to-qualify markets."
    return None


def build_world_cup_context(
    *,
    fixture: dict[str, Any],
    team_a: str,
    team_b: str,
    venue_fields: dict[str, Any] | None = None,
) -> dict[str, Any]:
    stage, group_name, matchday, knockout_round = infer_stage(fixture)
    venue, city = _venue_text(fixture)
    venue_country = infer_venue_country(venue, city)
    neutral_venue, host_team = infer_host_advantage(team_a, team_b, venue_country)
    motivation_a, motivation_b = motivation_labels(stage, matchday)

    vf = venue_fields or {}
    rest_a = vf.get("rest_days_team_a")
    rest_b = vf.get("rest_days_team_b")
    travel_a = vf.get("travel_distance_km_team_a")
    travel_b = vf.get("travel_distance_km_team_b")
    tz_a = vf.get("timezone_shift_team_a")
    tz_b = vf.get("timezone_shift_team_b")

    missing: list[str] = []
    required = {
        "stage": stage if stage != "unknown" else None,
        "venue": venue,
        "host_city": city,
        "venue_country": venue_country,
        "rest_days_team_a": rest_a,
        "rest_days_team_b": rest_b,
        "travel_distance_km_team_a": travel_a,
        "travel_distance_km_team_b": travel_b,
        "timezone_shift_team_a": tz_a,
        "timezone_shift_team_b": tz_b,
    }
    for key, value in required.items():
        if value is None:
            missing.append(key)

    completeness = round((len(required) - len(missing)) / len(required), 3)
    blocked_reason = ", ".join(missing) if completeness < 0.78 else None

    ctx = WorldCupContext(
        is_world_cup=True,
        stage=stage,
        group_name=group_name,
        matchday_in_group=matchday,
        knockout_round=knockout_round,
        venue=venue,
        host_city=city,
        venue_country=venue_country,
        neutral_venue=neutral_venue,
        host_advantage_team=host_team,
        rest_days_team_a=rest_a,
        rest_days_team_b=rest_b,
        travel_distance_km_team_a=travel_a,
        travel_distance_km_team_b=travel_b,
        timezone_shift_team_a=tz_a,
        timezone_shift_team_b=tz_b,
        motivation_label_team_a=motivation_a,
        motivation_label_team_b=motivation_b,
        market_warning=market_warning(stage),
        data_completeness_score=completeness,
        missing_context_fields=missing,
        publication_status="monitor_only" if blocked_reason else "context_ready",
        blocked_reason=blocked_reason,
    )
    return asdict(ctx)


def world_cup_status_detail(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "world_cup_context",
        "ts": datetime.now(timezone.utc).isoformat(),
        "code": WORLD_CUP_CODE,
        "stage": context.get("stage"),
        "venue": context.get("venue"),
        "venue_country": context.get("venue_country"),
        "host_advantage_team": context.get("host_advantage_team"),
        "motivation": {
            "team_a": context.get("motivation_label_team_a"),
            "team_b": context.get("motivation_label_team_b"),
        },
        "data_completeness_score": context.get("data_completeness_score"),
        "missing_context_fields": context.get("missing_context_fields", []),
        "publication_status": context.get("publication_status"),
        "blocked_reason": context.get("blocked_reason"),
    }
