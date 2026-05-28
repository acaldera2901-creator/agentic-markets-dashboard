"""
Conservative national-team profile model for World Cup 2026.

This is not a standalone prediction engine. It creates explainable team
strength profiles from available international/World Cup history so the
main model can know whether national-team data is strong enough to publish.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass
class NationalTeamProfile:
    team: str
    matches: int
    points_per_match: float
    goals_for_per_match: float
    goals_against_per_match: float
    goal_diff_per_match: float
    recent_points_per_match: float
    data_quality: float


@dataclass
class NationalTeamMatchup:
    team_a: str
    team_b: str
    team_a_profile: dict[str, Any] | None
    team_b_profile: dict[str, Any] | None
    strength_delta: float | None
    recent_form_delta: float | None
    data_quality: float
    blocked_reason: str | None


def _points_for(goals_for: int, goals_against: int) -> int:
    if goals_for > goals_against:
        return 3
    if goals_for == goals_against:
        return 1
    return 0


def _team_rows(matches: list[dict[str, Any]], team: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for m in matches:
        home = m.get("home_team")
        away = m.get("away_team")
        if home != team and away != team:
            continue
        try:
            hg = int(m["home_goals"])
            ag = int(m["away_goals"])
        except Exception:
            continue
        if home == team:
            gf, ga = hg, ag
        else:
            gf, ga = ag, hg
        rows.append({"gf": gf, "ga": ga, "points": _points_for(gf, ga)})
    return rows


def build_profile(matches: list[dict[str, Any]], team: str) -> NationalTeamProfile | None:
    rows = _team_rows(matches, team)
    if not rows:
        return None
    recent = rows[-10:]
    n = len(rows)
    gf = sum(r["gf"] for r in rows) / n
    ga = sum(r["ga"] for r in rows) / n
    ppm = sum(r["points"] for r in rows) / n
    recent_ppm = sum(r["points"] for r in recent) / len(recent)
    # 20+ matches is strong enough for a basic national profile; below that
    # remains paper/monitor quality, not public signal quality.
    quality = min(1.0, n / 20)
    return NationalTeamProfile(
        team=team,
        matches=n,
        points_per_match=round(ppm, 3),
        goals_for_per_match=round(gf, 3),
        goals_against_per_match=round(ga, 3),
        goal_diff_per_match=round(gf - ga, 3),
        recent_points_per_match=round(recent_ppm, 3),
        data_quality=round(quality, 3),
    )


def matchup_profile(matches: list[dict[str, Any]], team_a: str, team_b: str) -> dict[str, Any]:
    a = build_profile(matches, team_a)
    b = build_profile(matches, team_b)
    if not a or not b:
        missing = []
        if not a:
            missing.append(team_a)
        if not b:
            missing.append(team_b)
        result = NationalTeamMatchup(
            team_a=team_a,
            team_b=team_b,
            team_a_profile=asdict(a) if a else None,
            team_b_profile=asdict(b) if b else None,
            strength_delta=None,
            recent_form_delta=None,
            data_quality=0.0,
            blocked_reason=f"missing national-team profile: {', '.join(missing)}",
        )
        return asdict(result)

    strength_delta = (a.points_per_match + a.goal_diff_per_match) - (
        b.points_per_match + b.goal_diff_per_match
    )
    recent_delta = a.recent_points_per_match - b.recent_points_per_match
    quality = min(a.data_quality, b.data_quality)
    blocked_reason = None if quality >= 0.75 else "national-team history quality below signal threshold"
    result = NationalTeamMatchup(
        team_a=team_a,
        team_b=team_b,
        team_a_profile=asdict(a),
        team_b_profile=asdict(b),
        strength_delta=round(strength_delta, 3),
        recent_form_delta=round(recent_delta, 3),
        data_quality=round(quality, 3),
        blocked_reason=blocked_reason,
    )
    return asdict(result)

