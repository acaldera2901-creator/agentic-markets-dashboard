"""World Football Elo -> 1X2 probabilities for national teams (v2 candidate).

Shadow model `football-worldcup-v2-elo`. NOT served. It exists to be A/B-logged
against the served Poisson v1 (core/world_cup_probability) until a promotion-gate
green + human APPROVE moves it to the serve path.

Why Elo: the 10-year walk-forward lab (scripts/lab_backtest_10y.py, spec
docs/superpowers/specs/2026-06-07-wc-elo-model-lab.md) showed the served model's
flaw is the strength signal, not the Poisson grid — 5y goal-rate averages are not
opponent-adjusted (a 3-0 vs San Marino counts like a 3-0 vs France). Elo fixes
exactly that. The winning candidate `elo2` (logit on [elo_diff, |elo_diff|], the
|diff| term being a draw-awareness feature) reached, on the WC-relevant cut
(neutral venue, 2021+ +iso): Brier 0.5936 -> 0.5452, acc 0.515 -> 0.574, beating
the served model in 10 of 11 fold years.

Determinism / no leakage: ratings, logit coefficients and isotonic knots are all
FROZEN. The logit coefficients below are the last walk-forward fit (all matches
date < 2026-01-01); the ratings snapshot + isotonic knots (fit pre-2021, the lab's
OOS train split) live in data/national_teams/wc_elo_artifacts.json. Regenerate
all three with scripts/freeze_wc_elo_artifacts.py after a CSV refresh.

Pure module: the only I/O is reading the static JSON artifact once (lru_cache).
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

from core.world_cup_history import canonical_team_name

_ARTIFACTS_PATH = Path(__file__).resolve().parent.parent / "data" / "national_teams" / "wc_elo_artifacts.json"

MODEL_VERSION = "football-worldcup-v2-elo"

ELO_HOME = 100.0  # World Football Elo home term, dropped on neutral ground

# Frozen `elo2` logit coefficients — last walk-forward fit (all matches with
# date < 2026-01-01), from scripts/freeze_wc_elo_artifacts.py / the lab's elo2
# candidate. Features: [elo_diff, |elo_diff|]. Classes are [0=home, 1=draw,
# 2=away]. Hardcoded (not read from JSON) so a tampered/stale JSON cannot
# silently change the served-candidate probabilities; the JSON carries only the
# data-derived artifacts (ratings, isotonic). If you re-freeze, update BOTH.
_LOGIT_CLASSES: tuple[int, int, int] = (0, 1, 2)
_LOGIT_COEF: tuple[tuple[float, float], ...] = (
    (0.003235565894215748, 0.00012766859726312416),
    (5.902430737441399e-06, -0.00037270757052401394),
    (-0.003241468324962905, 0.00024503897336140563),
)
_LOGIT_INTERCEPT: tuple[float, float, float] = (
    0.16162136683716652,
    -0.13457251147910992,
    -0.02704885535859847,
)


@lru_cache(maxsize=1)
def _artifacts() -> dict:
    return json.loads(_ARTIFACTS_PATH.read_text())


@lru_cache(maxsize=1)
def _ratings() -> dict[str, float]:
    return {k: float(v) for k, v in _artifacts()["ratings"].items()}


@lru_cache(maxsize=1)
def _isotonic() -> dict[int, tuple[list[float], list[float]]]:
    iso = _artifacts()["isotonic"]
    return {int(k): (v["x"], v["y"]) for k, v in iso.items()}


def _interp(xs: list[float], ys: list[float], x: float) -> float:
    """Monotone piecewise-linear isotonic eval, clipped to the fitted range."""
    if not xs:
        return x
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    lo, hi = 0, len(xs) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if xs[mid] <= x:
            lo = mid
        else:
            hi = mid
    span = xs[hi] - xs[lo]
    if span <= 0:
        return ys[lo]
    t = (x - xs[lo]) / span
    return ys[lo] + t * (ys[hi] - ys[lo])


def _logit_probs(elo_diff: float) -> tuple[float, float, float]:
    feats = (elo_diff, abs(elo_diff))
    logits = [
        _LOGIT_INTERCEPT[i] + _LOGIT_COEF[i][0] * feats[0] + _LOGIT_COEF[i][1] * feats[1]
        for i in range(3)
    ]
    m = max(logits)
    exps = [math.exp(z - m) for z in logits]
    s = sum(exps)
    soft = [e / s for e in exps]
    by_class = {_LOGIT_CLASSES[i]: soft[i] for i in range(3)}
    return by_class[0], by_class[1], by_class[2]


# Plateau guard (finding F2, ri-verifica michele-claude msg_mq3y1c4y): i knot
# estremi dell'isotonica congelata valgono y=0.0/1.0, quindi un mismatch fuori
# scala (Spain–San Marino) veniva servito come 1.00/0.00/0.00 — lo stesso bug
# del caso Bolivia–Algeria che ha originato #CALIB-3 sul path v1. Mai servire
# certezze: clamp a [EPS, 1-EPS] e rinormalizzazione.
_CAL_EPS = 0.01


def _calibrate(p_home: float, p_draw: float, p_away: float) -> tuple[float, float, float]:
    iso = _isotonic()
    cal = [
        min(max(_interp(*iso[0], p_home), _CAL_EPS), 1.0 - _CAL_EPS),
        min(max(_interp(*iso[1], p_draw), _CAL_EPS), 1.0 - _CAL_EPS),
        min(max(_interp(*iso[2], p_away), _CAL_EPS), 1.0 - _CAL_EPS),
    ]
    s = sum(cal)
    if s <= 0:
        return p_home, p_draw, p_away
    return cal[0] / s, cal[1] / s, cal[2] / s


def team_rating(name: str) -> float | None:
    """Frozen Elo rating for a fixture-feed team name, or None if unknown."""
    canon = canonical_team_name(name)
    ratings = _ratings()
    if canon in ratings:
        return ratings[canon]
    return ratings.get(name)


def predict_wc_match(
    home: str,
    away: str,
    *,
    neutral: bool = True,
) -> tuple[float, float, float] | None:
    """Calibrated 1X2 probabilities (p_home, p_draw, p_away) from frozen Elo.

    neutral=True drops the home advantage term (the World Cup case). Returns None
    when either team has no frozen rating (new/renamed team) -> the caller must
    fall back to the served Poisson path. Fail-closed: no rating, no probability.
    """
    rh = team_rating(home)
    ra = team_rating(away)
    if rh is None or ra is None:
        return None
    elo_diff = rh - ra + (0.0 if neutral else ELO_HOME)
    p_home, p_draw, p_away = _logit_probs(elo_diff)
    return _calibrate(p_home, p_draw, p_away)
