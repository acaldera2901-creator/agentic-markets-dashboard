from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

_FACTOR_KEYS = (
    "data_completeness",
    "ci_width",
    "league_predictability",
    "match_type",
    "drawdown",
    "exposure",
    "variance_budget",
    "season_phase",
)


@dataclass
class StakeDecision:
    final_stake: float
    composite_multiplier: float
    factors: dict              # clamped factor values actually used
    skip_reason: Optional[str] # set when final_stake == 0 due to a blocking factor


class CompositeStakeCalculator:
    """
    Multiply a Kelly base stake by seven independent factors.

    Each factor must be in [0, 1]. Values outside that range are clamped.
    Missing factors default to 1.0 (no effect).
    Any factor == 0 short-circuits to zero stake.
    Result is additionally capped at max_bet_abs.
    """

    def __init__(self, max_bet_abs: float = 100.0) -> None:
        self.max_bet_abs = max(0.0, max_bet_abs)

    def compute(self, base_stake: float, factors: dict) -> StakeDecision:
        base_stake = max(0.0, base_stake)

        # Build clamped factor map, defaulting missing keys to 1.0
        clamped: dict = {}
        for key in _FACTOR_KEYS:
            raw = factors.get(key, 1.0)
            clamped[key] = max(0.0, min(1.0, float(raw)))

        # Compute composite multiplier
        multiplier = 1.0
        zero_factor: Optional[str] = None
        for key, val in clamped.items():
            if val == 0.0:
                zero_factor = key
                multiplier = 0.0
                break
            multiplier *= val

        final = min(base_stake * multiplier, self.max_bet_abs)

        skip_reason: Optional[str] = None
        if final == 0.0:
            if zero_factor:
                skip_reason = f"factor '{zero_factor}' is zero — bet blocked"
            elif base_stake == 0.0:
                skip_reason = "base_stake is zero"

        return StakeDecision(
            final_stake=final,
            composite_multiplier=multiplier,
            factors=clamped,
            skip_reason=skip_reason,
        )
