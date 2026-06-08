"""
Confidence-surfacing gate (Wave 1, APPROVE Andrea 2026-06-08).

Pure decision function. Decides ONLY whether a prediction is surfaced as a
directional pick or as a "no clear favourite" row. It is **probability-neutral**:
it never touches, returns, or recomputes any probability or confidence score —
the caller keeps serving and logging the exact same numbers. The gate flips a
publish flag, nothing else.

Floors live in config.settings (SURFACE_FLOOR_*), mirrored in lib/surfacing-gate.ts
for the TS club path. Floors are inclusive: confidence >= floor surfaces a pick.
Tennis has no floor (lab 2026-06-08: tennis confidence does not discriminate).
"""
from __future__ import annotations

from config.settings import settings


def surface_decision(
    *,
    sport: str,
    friendly: bool,
    confidence: int,
) -> tuple[bool, bool]:
    """Return ``(is_pick, below_threshold)`` for a row.

    ``confidence`` is the picked-outcome probability in whole percent.
    ``is_pick`` and ``below_threshold`` are always exact complements; both are
    returned so callers read intent directly without re-deriving it.
    """
    if sport.lower() == "tennis":
        return True, False

    floor = settings.SURFACE_FLOOR_FRIENDLY if friendly else settings.SURFACE_FLOOR_FOOTBALL
    is_pick = confidence >= floor
    return is_pick, not is_pick
