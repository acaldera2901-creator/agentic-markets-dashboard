"""
Market blend — Python mirror of lib/poisson-model.ts (APPROVE msg_mq1m1b9v).

p_served = α·p_model + (1−α)·p_market, with the market de-vigged first.
α=0.3: the market dominates — the calibration report (2026-06-06) showed the
de-vigged market is the best calibrator we have; the model contributes the
30% tilt. Fail-closed: missing/invalid odds → no market → identity blend,
so a row can never gain fabricated market information.

Keep this file in sync with the TS constants: MARKET_BLEND_ALPHA must equal
lib/poisson-model.ts MARKET_BLEND_ALPHA.
"""
from __future__ import annotations

MARKET_BLEND_ALPHA = 0.3


def devig_1x2(
    odds_home: float | None,
    odds_draw: float | None,
    odds_away: float | None,
) -> dict[str, float] | None:
    """De-vig decimal 1X2 odds into a normalized probability triple.

    Returns None when any leg is missing or non-positive — callers must never
    fabricate a market.
    """
    try:
        oh, od, oa = float(odds_home or 0), float(odds_draw or 0), float(odds_away or 0)
    except (TypeError, ValueError):
        return None
    if oh <= 0 or od <= 0 or oa <= 0:
        return None
    inv_h, inv_d, inv_a = 1.0 / oh, 1.0 / od, 1.0 / oa
    s = inv_h + inv_d + inv_a
    if s <= 0:
        return None
    return {"home": inv_h / s, "draw": inv_d / s, "away": inv_a / s}


def blend_with_market(
    p_home: float,
    p_draw: float,
    p_away: float,
    market: dict[str, float] | None,
    alpha: float = MARKET_BLEND_ALPHA,
) -> tuple[float, float, float]:
    """Convex blend of model and market probabilities (simplex-preserving)."""
    if not market or alpha >= 1:
        return (p_home, p_draw, p_away)
    a = max(0.0, min(1.0, alpha))
    return (
        a * p_home + (1 - a) * market["home"],
        a * p_draw + (1 - a) * market["draw"],
        a * p_away + (1 - a) * market["away"],
    )
