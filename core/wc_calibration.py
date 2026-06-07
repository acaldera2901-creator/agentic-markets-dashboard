"""#CALIB-2 (APPROVE Andrea 2026-06-07): isotonic calibration of the served
World Cup national model (wc-poisson-rates-v1).

The curve in config/calibration/wc_neutral_isotonic.json was fitted on a
walk-forward replay of core/world_cup_probability.national_match_probabilities
over NEUTRAL-venue internationals only (1313 predictions, 2021-2026) — the
correct distribution for a World Cup, where qualifier-style home advantage
must NOT leak in. Validated on 3 temporal holdouts: ECE -15/-20%, Brier never
worse (scripts/experiment_wc_calibration.py). It corrects the measured
directional bias of the neutral model (team_a under-predicted ~2.5pp even on
neutral ground) — something temperature scaling cannot express.

Fail-safe by construction: missing/invalid artifact, or any value outside
[0,1], degrades to the identity. Deleting the JSON file is the rollback.

Applied PRE market-blend in agents/model.py (same architecture as the club
football temperature scaling in lib/calibration.ts, #CALIB-1).
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger("wc_calibration")

ARTIFACT = Path(__file__).resolve().parent.parent / "config" / "calibration" / "wc_neutral_isotonic.json"
_GRID_STEP = 0.005
_GRID_LEN = 201


@lru_cache(maxsize=1)
def _load_maps() -> dict[str, list[float]] | None:
    try:
        data = json.loads(ARTIFACT.read_text())
        maps = data.get("maps") or {}
        for key in ("team_a", "draw", "team_b"):
            arr = maps.get(key)
            if not isinstance(arr, list) or len(arr) != _GRID_LEN:
                raise ValueError(f"bad map for {key}")
            if any((not isinstance(v, (int, float))) or v < 0 or v > 1 for v in arr):
                raise ValueError(f"out-of-range values in {key}")
        logger.info(
            "WC isotonic calibration loaded (n_train=%s, fitted_at=%s)",
            data.get("n_train"), data.get("fitted_at"),
        )
        return {k: maps[k] for k in ("team_a", "draw", "team_b")}
    except Exception as exc:
        logger.warning("WC calibration artifact unavailable -> identity (%s)", exc)
        return None


def _lookup(arr: list[float], p: float) -> float:
    idx = round(max(0.0, min(1.0, p)) / _GRID_STEP)
    return arr[max(0, min(_GRID_LEN - 1, int(idx)))]


def calibrate_wc_probabilities(
    p_team_a: float, p_draw: float, p_team_b: float
) -> tuple[float, float, float]:
    """Map the raw WC model triple through the neutral isotonic curve.

    Returns a renormalized triple; identity when the artifact is missing or
    the mapped values cannot form a distribution.
    """
    maps = _load_maps()
    if maps is None:
        return (p_team_a, p_draw, p_team_b)
    ca = _lookup(maps["team_a"], p_team_a)
    cd = _lookup(maps["draw"], p_draw)
    cb = _lookup(maps["team_b"], p_team_b)
    total = ca + cd + cb
    if not total > 0:
        return (p_team_a, p_draw, p_team_b)
    # Boundary-plateau guard (#FRIENDLY-1 finding, Bolivia-Algeria 0/0/100):
    # inputs outside the fitted support hit the isotonic plateaus and come back
    # as a degenerate 0%/100% claim the raw model never made (raw was 4/9/87).
    # An input this extreme is out-of-distribution for the curve -> identity,
    # same fail-safe contract as a missing artifact. No served WC row is in
    # this regime today (mid-range probs), so WC serving is unchanged.
    for raw, mapped in ((p_team_a, ca), (p_draw, cd), (p_team_b, cb)):
        if (mapped <= 0.0 and raw > 0.0) or (mapped >= 1.0 and raw < 1.0):
            return (p_team_a, p_draw, p_team_b)
    return (ca / total, cd / total, cb / total)
