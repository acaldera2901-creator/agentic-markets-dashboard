"""
Tennis market blend — 2-way analogue of core/market_blend.py.

p_blend = α·p_model + (1−α)·p_market, market de-vigged first. α=0.3 (market
dominates), matching the football alpha and the 10-year tennis lab (2026-06-08)
which showed blending the closing odds nearly DOUBLES the publishable volume at
a 72% hit-rate. Fail-closed: missing/invalid odds → identity (no fabricated market).

Used by the SHADOW path only (tennis-market-blend-shadow) — the served tennis
model is unchanged until a promotion gate is approved.
"""
from __future__ import annotations

TENNIS_MARKET_BLEND_ALPHA = 0.3


def devig_2way(odds_p1: float | None, odds_p2: float | None) -> dict[str, float] | None:
    """De-vig 2-way decimal odds into a normalised {p1, p2}. None if unusable."""
    try:
        o1, o2 = float(odds_p1 or 0), float(odds_p2 or 0)
    except (TypeError, ValueError):
        return None
    if o1 <= 1.0 or o2 <= 1.0:
        return None
    inv1, inv2 = 1.0 / o1, 1.0 / o2
    s = inv1 + inv2
    if s <= 0:
        return None
    return {"p1": inv1 / s, "p2": inv2 / s}


def blend_tennis(
    p1: float,
    p2: float,
    market: dict[str, float] | None,
    alpha: float = TENNIS_MARKET_BLEND_ALPHA,
) -> tuple[float, float]:
    """Convex blend of model and de-vigged market (simplex-preserving).

    No market (or alpha>=1) → identity. Result is renormalised so p1+p2==1.
    """
    if not market or alpha >= 1:
        return (p1, p2)
    a = max(0.0, min(1.0, alpha))
    b1 = a * p1 + (1 - a) * market["p1"]
    b2 = a * p2 + (1 - a) * market["p2"]
    s = b1 + b2
    if s <= 0:
        return (p1, p2)
    return (b1 / s, b2 / s)
