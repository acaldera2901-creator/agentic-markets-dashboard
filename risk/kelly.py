from __future__ import annotations

from config.settings import settings


def kelly_stake(
    edge: float,
    odds: float,
    bankroll: float,
    kelly_fraction: float = None,
    max_bet_pct: float = None,
) -> float:
    """
    Fractional Kelly sizing with absolute cap.
    stake = min(kelly_fraction × kelly_full, max_bet_pct × bankroll)
    """
    if edge <= 0:
        return 0.0
    kelly_fraction = kelly_fraction if kelly_fraction is not None else settings.KELLY_FRACTION
    max_bet_pct = max_bet_pct if max_bet_pct is not None else settings.MAX_BET_PCT
    kelly_full = (edge * odds) / (odds - 1)
    fractional = kelly_full * kelly_fraction * bankroll
    cap = max_bet_pct * bankroll
    return min(fractional, cap)
