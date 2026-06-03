"""Match features derivable from data we ALREADY have (results + dates).

No external data needed — these are computed incrementally in walk-forward order
so they never leak future information:

  - PiRating: margin-weighted home/away Elo (port of lib/pi-rating.ts).
  - rest / congestion: days since last match and matches in a recent window
    (fatigue — genuinely orthogonal to the goals-only Poisson).
  - form points: points per game over the last N matches.

External features still missing (xG, lineups, injuries, odds movement) are tracked
separately in docs/research/prediction-upgrade-2026-06.md.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from typing import Dict, List


class PiRating:
    """Incremental margin-weighted Elo with separate home/away ratings."""

    def __init__(self, k_base: float = 20.0) -> None:
        self.k_base = k_base
        self._home: Dict[str, float] = defaultdict(float)
        self._away: Dict[str, float] = defaultdict(float)

    def expected_home(self, home: str, away: str) -> float:
        diff = self._home[home] - self._away[away]
        return 1.0 / (1.0 + 10 ** (-diff / 400.0))

    def rating_diff(self, home: str, away: str) -> float:
        return self._home[home] - self._away[away]

    def update(self, home: str, away: str, home_goals: int, away_goals: int) -> None:
        expected = self.expected_home(home, away)
        actual = 1.0 if home_goals > away_goals else 0.5 if home_goals == away_goals else 0.0
        margin = math.sqrt(abs(home_goals - away_goals) + 1)
        delta = self.k_base * margin * (actual - expected)
        self._home[home] += delta
        self._away[away] -= delta


def rest_days(last_played: date | None, current: date, cap: int = 30) -> int:
    """Days since a team last played; capped so a long break / season start is bounded."""
    if last_played is None:
        return cap
    return min((current - last_played).days, cap)


def congestion(recent_dates: List[date], current: date, window_days: int = 14) -> int:
    """Number of matches a team played within `window_days` before `current`."""
    return sum(1 for d in recent_dates if 0 < (current - d).days <= window_days)


def form_ppg(results: List[str], last_n: int = 5) -> float:
    """Points-per-game over the last N results (W=3, D=1, L=0). 1.0 if no history."""
    if not results:
        return 1.0
    pts = {"W": 3, "D": 1, "L": 0}
    window = results[-last_n:]
    return sum(pts[r] for r in window) / len(window)


def result_char(goals_for: int, goals_against: int) -> str:
    return "W" if goals_for > goals_against else "D" if goals_for == goals_against else "L"
