"""Point-in-time football feature store for live pre-match enrichment.

The live football stack already has strong historical data in the Understat
cache. This module turns that cache into leakage-safe team features that can be
attached to upcoming fixtures before the model/adjuster runs.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Iterable, Sequence

from core.understat_data import XGMatch, load
from models.match_features import congestion, form_ppg, rest_days, result_char

DEFAULT_PPG = 1.5
DEFAULT_XG = 1.3
DEFAULT_PPDA = 11.0
ROLLING_MATCHES = 10
QUALITY_FULL_MATCHES = 8


def _as_date(value: date | datetime | str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()


def _norm(value: str) -> str:
    return " ".join(value.lower().replace("&", "and").split())


def _avg(values: Sequence[float], default: float) -> float:
    return sum(values) / len(values) if values else default


@dataclass
class _TeamHistory:
    dates: list[date] = field(default_factory=list)
    results: list[str] = field(default_factory=list)
    xg_for: list[float] = field(default_factory=list)
    xg_against: list[float] = field(default_factory=list)
    npxg_for: list[float] = field(default_factory=list)
    npxg_against: list[float] = field(default_factory=list)
    ppda: list[float] = field(default_factory=list)
    goals_for: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class TeamSnapshot:
    team: str
    matches_total: int
    ppg: float
    xg_avg: float
    xga_avg: float
    npxg_avg: float
    npxga_avg: float
    ppda: float
    xg_luck: float
    rest_days: int
    congestion_14d: int
    reliability: float


class FootballFeatureStore:
    """Build rolling team features from Understat matches without future leakage."""

    def __init__(self, matches: Iterable[XGMatch] | None = None) -> None:
        self._matches = sorted(list(matches) if matches is not None else load(), key=lambda m: m.date)
        self._alias: dict[str, str] = {}
        for m in self._matches:
            self._alias.setdefault(_norm(m.home_team), m.home_team)
            self._alias.setdefault(_norm(m.away_team), m.away_team)

    def _canonical(self, name: str) -> str:
        return self._alias.get(_norm(name), name)

    def _histories_before(self, league: str, cutoff: date) -> dict[str, _TeamHistory]:
        histories: dict[str, _TeamHistory] = defaultdict(_TeamHistory)
        for m in self._matches:
            if m.league != league or m.date >= cutoff:
                continue
            home = histories[m.home_team]
            away = histories[m.away_team]

            home.dates.append(m.date)
            home.results.append(result_char(m.home_goals, m.away_goals))
            home.xg_for.append(m.home_xg)
            home.xg_against.append(m.away_xg)
            home.npxg_for.append(m.home_npxg if m.home_npxg is not None else m.home_xg)
            home.npxg_against.append(m.away_npxg if m.away_npxg is not None else m.away_xg)
            if m.home_ppda is not None:
                home.ppda.append(m.home_ppda)
            home.goals_for.append(m.home_goals)

            away.dates.append(m.date)
            away.results.append(result_char(m.away_goals, m.home_goals))
            away.xg_for.append(m.away_xg)
            away.xg_against.append(m.home_xg)
            away.npxg_for.append(m.away_npxg if m.away_npxg is not None else m.away_xg)
            away.npxg_against.append(m.home_npxg if m.home_npxg is not None else m.home_xg)
            if m.away_ppda is not None:
                away.ppda.append(m.away_ppda)
            away.goals_for.append(m.away_goals)
        return histories

    def team_snapshot(self, team: str, league: str, cutoff: date | datetime | str) -> TeamSnapshot:
        cutoff_date = _as_date(cutoff)
        canonical = self._canonical(team)
        history = self._histories_before(league, cutoff_date).get(canonical, _TeamHistory())
        recent_xg_for = history.xg_for[-ROLLING_MATCHES:]
        recent_xg_against = history.xg_against[-ROLLING_MATCHES:]
        recent_npxg_for = history.npxg_for[-ROLLING_MATCHES:]
        recent_npxg_against = history.npxg_against[-ROLLING_MATCHES:]
        recent_goals_for = history.goals_for[-ROLLING_MATCHES:]
        recent_ppda = history.ppda[-ROLLING_MATCHES:]

        xg_avg = _avg(recent_xg_for, DEFAULT_XG)
        goals_avg = _avg([float(g) for g in recent_goals_for], DEFAULT_XG)
        matches_total = len(history.dates)
        reliability = min(1.0, matches_total / QUALITY_FULL_MATCHES)

        return TeamSnapshot(
            team=canonical,
            matches_total=matches_total,
            ppg=round(form_ppg(history.results, last_n=5), 4) if matches_total else DEFAULT_PPG,
            xg_avg=round(xg_avg, 4),
            xga_avg=round(_avg(recent_xg_against, DEFAULT_XG), 4),
            npxg_avg=round(_avg(recent_npxg_for, DEFAULT_XG), 4),
            npxga_avg=round(_avg(recent_npxg_against, DEFAULT_XG), 4),
            ppda=round(_avg(recent_ppda, DEFAULT_PPDA), 4),
            xg_luck=round(goals_avg - xg_avg, 4),
            rest_days=rest_days(history.dates[-1] if history.dates else None, cutoff_date),
            congestion_14d=congestion(history.dates, cutoff_date, window_days=14),
            reliability=round(reliability, 4),
        )

    def match_context(
        self,
        home: str,
        away: str,
        league: str,
        kickoff: date | datetime | str,
    ) -> dict:
        home_s = self.team_snapshot(home, league, kickoff)
        away_s = self.team_snapshot(away, league, kickoff)
        feature_quality = round((home_s.reliability + away_s.reliability) / 2.0, 4)
        snapshot = {
            "league": league,
            "home_team": home_s.team,
            "away_team": away_s.team,
            "home_matches_total": home_s.matches_total,
            "away_matches_total": away_s.matches_total,
            "home_xg_avg": home_s.xg_avg,
            "away_xg_avg": away_s.xg_avg,
            "home_xga_avg": home_s.xga_avg,
            "away_xga_avg": away_s.xga_avg,
            "home_npxg_avg": home_s.npxg_avg,
            "away_npxg_avg": away_s.npxg_avg,
            "home_ppda": home_s.ppda,
            "away_ppda": away_s.ppda,
            "home_rest_days": home_s.rest_days,
            "away_rest_days": away_s.rest_days,
            "home_congestion_14d": home_s.congestion_14d,
            "away_congestion_14d": away_s.congestion_14d,
            "feature_quality": feature_quality,
        }
        return {
            "home_ppg": home_s.ppg,
            "away_ppg": away_s.ppg,
            "home_xg_avg": home_s.xg_avg,
            "away_xg_avg": away_s.xg_avg,
            "home_xga_avg": home_s.xga_avg,
            "away_xga_avg": away_s.xga_avg,
            "home_npxg_avg": home_s.npxg_avg,
            "away_npxg_avg": away_s.npxg_avg,
            "home_ppda": home_s.ppda,
            "away_ppda": away_s.ppda,
            "home_xg_luck": home_s.xg_luck,
            "away_xg_luck": away_s.xg_luck,
            "home_rest_days": home_s.rest_days,
            "away_rest_days": away_s.rest_days,
            "home_congestion_14d": home_s.congestion_14d,
            "away_congestion_14d": away_s.congestion_14d,
            "home_matches_total": home_s.matches_total,
            "away_matches_total": away_s.matches_total,
            "feature_quality": feature_quality,
            "feature_snapshot": snapshot,
        }
