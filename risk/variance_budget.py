from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Optional


def utcnow() -> datetime.datetime:
    """Thin wrapper so tests can mock time."""
    return datetime.datetime.now(datetime.timezone.utc)


def _week_start(dt: datetime.datetime) -> datetime.datetime:
    """Return Monday 00:00 UTC of the week containing dt."""
    monday = dt.date() - datetime.timedelta(days=dt.weekday())
    return datetime.datetime(monday.year, monday.month, monday.day,
                             tzinfo=datetime.timezone.utc)


@dataclass
class VarianceBudgetState:
    variance_budget_factor: float  # [0, 1] → passed to CompositeStakeCalculator
    used_variance: float
    remaining_variance: float
    week_start: datetime.datetime
    exhausted: bool


class WeeklyVarianceBudget:
    """
    Tracks the weekly sum of binomial variance: sum of p*(1-p) across bets.

    evaluate()  — read-only snapshot for CompositeStakeCalculator
    commit(p)   — register one bet's variance contribution
    reset()     — manual reset (also fires automatically on Monday week rollover)
    """

    def __init__(self, max_weekly_variance: float = 2.0) -> None:
        self.max_weekly_variance = max_weekly_variance
        self._used: float = 0.0
        self._week_start: datetime.datetime = _week_start(utcnow())

    # ── Public interface ──────────────────────────────────────────────────────

    def evaluate(self, win_probability: float) -> VarianceBudgetState:
        self._maybe_reset()
        return self._build_state()

    def commit(self, win_probability: float) -> None:
        self._maybe_reset()
        self._used += self.bet_variance(win_probability)

    def reset(self) -> None:
        self._used = 0.0
        self._week_start = _week_start(utcnow())

    # ── Variance helpers ──────────────────────────────────────────────────────

    @staticmethod
    def bet_variance(p: float) -> float:
        """Binomial variance contribution of a single bet with win probability p."""
        p = max(0.0, min(1.0, p))
        return p * (1.0 - p)

    # ── Persistence ───────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "used_variance": self._used,
            "max_weekly_variance": self.max_weekly_variance,
            "week_start": self._week_start.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "WeeklyVarianceBudget":
        instance = cls.__new__(cls)
        instance.max_weekly_variance = float(data["max_weekly_variance"])
        instance._used = float(data["used_variance"])
        instance._week_start = datetime.datetime.fromisoformat(data["week_start"])
        return instance

    # ── Internal ─────────────────────────────────────────────────────────────

    def _maybe_reset(self) -> None:
        current_week = _week_start(utcnow())
        if current_week > self._week_start:
            self._used = 0.0
            self._week_start = current_week

    def _build_state(self) -> VarianceBudgetState:
        used = self._used
        max_var = self.max_weekly_variance
        remaining = max(0.0, max_var - used)
        factor = max(0.0, min(1.0, 1.0 - used / max_var)) if max_var > 0 else 0.0
        exhausted = used >= max_var
        return VarianceBudgetState(
            variance_budget_factor=factor,
            used_variance=used,
            remaining_variance=remaining,
            week_start=self._week_start,
            exhausted=exhausted,
        )
