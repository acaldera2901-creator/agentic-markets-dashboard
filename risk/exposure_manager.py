from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Optional


@dataclass
class ExposureState:
    exposure_factor: float   # [0, 1] — passed to CompositeStakeCalculator
    blocked: bool
    block_reason: Optional[str]
    league_exposure: float   # current open stake on this league
    matchday_exposure: float # current open stake on this matchday
    total_exposure: float    # sum of all open stakes


class ExposureManager:
    """
    Tracks open stake exposure per league and per matchday.

    evaluate() is read-only — it computes a factor without changing state.
    commit()   registers a new open stake after a bet is placed.
    release()  removes a settled/cancelled stake from the books.
    """

    def __init__(
        self,
        max_league_pct: float = 0.20,
        max_matchday_pct: float = 0.15,
        max_total_pct: float = 0.40,
    ) -> None:
        self.max_league_pct = max_league_pct
        self.max_matchday_pct = max_matchday_pct
        self.max_total_pct = max_total_pct

        self._league: dict[str, float] = defaultdict(float)
        self._matchday: dict[str, float] = defaultdict(float)
        self._total: float = 0.0

    # ── Public interface ──────────────────────────────────────────────────────

    def evaluate(
        self,
        bankroll: float,
        new_stake: float,
        league_id: str,
        matchday_id: str,
    ) -> ExposureState:
        league_now = self._league[league_id]
        matchday_now = self._matchday[matchday_id]
        total_now = self._total

        league_max = self.max_league_pct * bankroll
        matchday_max = self.max_matchday_pct * bankroll
        total_max = self.max_total_pct * bankroll

        # Check breaches for proposed new_stake
        if league_now + new_stake > league_max + 1e-9:
            return self._blocked(
                league_now, matchday_now, total_now,
                f"league '{league_id}' exposure limit reached "
                f"({league_now + new_stake:.2f} > {league_max:.2f})",
            )

        if matchday_now + new_stake > matchday_max + 1e-9:
            return self._blocked(
                league_now, matchday_now, total_now,
                f"matchday '{matchday_id}' exposure limit reached "
                f"({matchday_now + new_stake:.2f} > {matchday_max:.2f})",
            )

        if total_now + new_stake > total_max + 1e-9:
            return self._blocked(
                league_now, matchday_now, total_now,
                f"total exposure limit reached "
                f"({total_now + new_stake:.2f} > {total_max:.2f})",
            )

        # Compute factor as the tightest headroom ratio across all three limits
        factor = self._headroom_factor(
            bankroll, league_now, matchday_now, total_now
        )

        return ExposureState(
            exposure_factor=factor,
            blocked=False,
            block_reason=None,
            league_exposure=league_now,
            matchday_exposure=matchday_now,
            total_exposure=total_now,
        )

    def commit(self, stake: float, league_id: str, matchday_id: str) -> None:
        """Register an open bet stake."""
        self._league[league_id] += stake
        self._matchday[matchday_id] += stake
        self._total += stake

    def release(self, stake: float, league_id: str, matchday_id: str) -> None:
        """Remove a settled or cancelled stake."""
        self._league[league_id] = max(0.0, self._league[league_id] - stake)
        self._matchday[matchday_id] = max(0.0, self._matchday[matchday_id] - stake)
        self._total = max(0.0, self._total - stake)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _headroom_factor(
        self,
        bankroll: float,
        league_now: float,
        matchday_now: float,
        total_now: float,
    ) -> float:
        if bankroll <= 0:
            return 1.0
        league_max = self.max_league_pct * bankroll
        matchday_max = self.max_matchday_pct * bankroll
        total_max = self.max_total_pct * bankroll

        ratios = []
        if league_max > 0:
            ratios.append(1.0 - league_now / league_max)
        if matchday_max > 0:
            ratios.append(1.0 - matchday_now / matchday_max)
        if total_max > 0:
            ratios.append(1.0 - total_now / total_max)

        factor = min(ratios) if ratios else 1.0
        return max(0.0, min(1.0, factor))

    @staticmethod
    def _blocked(
        league: float,
        matchday: float,
        total: float,
        reason: str,
    ) -> ExposureState:
        return ExposureState(
            exposure_factor=0.0,
            blocked=True,
            block_reason=reason,
            league_exposure=league,
            matchday_exposure=matchday,
            total_exposure=total,
        )
