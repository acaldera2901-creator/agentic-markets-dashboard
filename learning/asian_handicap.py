from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class HandicapLine:
    value: float
    is_split: bool   # True for quarter-ball lines (±0.25, ±0.75)


@dataclass
class HandicapResult:
    outcome: str        # "win" | "lose" | "push" | "half_win" | "half_lose"
    stake_return: float  # +1.0 full win, +0.5 half win, 0 push, -0.5 half lose, -1.0 full lose


def _is_quarter_ball(value: float) -> bool:
    remainder = abs(value) % 0.5
    return abs(remainder - 0.25) < 1e-9


class AsianHandicapEngine:
    """
    Parses Asian Handicap lines, settles bets, and converts match probabilities
    to AH win probabilities.

    Quarter-ball lines (±0.25, ±0.75) are split into two equal halves:
      +0.25 = half on 0 (push if draw) + half on +0.5 (win if draw or home wins)
    """

    # ── Parsing ───────────────────────────────────────────────────────────────

    def parse_handicap(self, handicap: str) -> HandicapLine:
        handicap = handicap.strip()
        try:
            value = float(handicap)
        except ValueError:
            raise ValueError(f"Cannot parse handicap '{handicap}'")
        return HandicapLine(value=value, is_split=_is_quarter_ball(value))

    # ── Settlement ────────────────────────────────────────────────────────────

    def settle(
        self,
        handicap: str,
        selection: str,
        home_goals: int,
        away_goals: int,
    ) -> HandicapResult:
        line = self.parse_handicap(handicap)
        adjusted_margin = self._adjusted_margin(
            selection, home_goals, away_goals, line.value
        )

        if line.is_split:
            return self._settle_split(adjusted_margin, line.value)
        return self._settle_simple(adjusted_margin)

    def _adjusted_margin(
        self, selection: str, home_goals: int, away_goals: int, handicap: float
    ) -> float:
        raw = home_goals - away_goals
        if selection == "home":
            return raw + handicap
        else:
            return away_goals - home_goals - handicap

    def _settle_simple(self, adjusted_margin: float) -> HandicapResult:
        if adjusted_margin > 0:
            return HandicapResult(outcome="win", stake_return=1.0)
        if adjusted_margin < 0:
            return HandicapResult(outcome="lose", stake_return=-1.0)
        return HandicapResult(outcome="push", stake_return=0.0)

    def _settle_split(self, adjusted_margin: float, line_value: float) -> HandicapResult:
        # Split into: line_value - 0.25 (whole/half neighbour) and line_value + 0.25
        lower = line_value - 0.25
        upper = line_value + 0.25

        # We already computed margin with line_value; recompute for the two sub-lines
        # adjusted_margin = raw_margin + line_value
        # For lower sub-line: raw_margin + lower = adjusted_margin - 0.25
        margin_lower = adjusted_margin - 0.25
        margin_upper = adjusted_margin + 0.25

        result_lower = self._settle_simple(margin_lower)
        result_upper = self._settle_simple(margin_upper)

        combined = (result_lower.stake_return + result_upper.stake_return) / 2

        if combined == 1.0:
            return HandicapResult(outcome="win", stake_return=1.0)
        if combined == -1.0:
            return HandicapResult(outcome="lose", stake_return=-1.0)
        if combined == 0.5:
            return HandicapResult(outcome="half_win", stake_return=0.5)
        if combined == -0.5:
            return HandicapResult(outcome="half_lose", stake_return=-0.5)
        return HandicapResult(outcome="push", stake_return=0.0)

    # ── Expected value ────────────────────────────────────────────────────────

    def expected_value(
        self,
        p_win: float,
        odds: float,
        p_push: float = 0.0,
        p_half_win: float = 0.0,
        p_half_lose: float = 0.0,
    ) -> float:
        p_lose = 1.0 - p_win - p_push - p_half_win - p_half_lose
        ev = (
            p_win * (odds - 1)
            + p_half_win * (odds - 1) * 0.5
            + p_push * 0.0
            + p_half_lose * (-0.5)
            + p_lose * (-1.0)
        )
        return ev

    # ── Match probability conversion ──────────────────────────────────────────

    def match_probs_to_ah_probability(
        self,
        p_home: float,
        p_draw: float,
        p_away: float,
        handicap: str,
    ) -> float:
        """
        Converts 1X2 probabilities to AH win probability for the home team.
        For -0.5: home must win → p_home
        For +0.5: home wins or draws → p_home + p_draw
        For 0: home wins fully, push on draw → p_home + p_draw * 0
        For -1: home wins by 2+ → approximated by scaling p_home
        """
        line = self.parse_handicap(handicap)
        h = line.value

        if abs(h + 0.5) < 1e-9:
            return p_home
        if abs(h - 0.5) < 1e-9:
            return p_home + p_draw
        if abs(h) < 1e-9:
            return p_home + p_draw * 0.5
        if abs(h + 0.25) < 1e-9:
            return p_home + p_draw * 0.25
        if abs(h - 0.25) < 1e-9:
            return p_home + p_draw * 0.75
        if h < -0.5:
            factor = max(0.0, 1.0 + h)
            return p_home * factor
        if h > 0.5:
            return p_home + p_draw + p_away * min(1.0, h - 0.5)
        return p_home
