"""Tests for core/world_cup_elo_model (v2 shadow candidate)."""
from __future__ import annotations

import math

import pytest

from core import world_cup_elo_model as m


def test_frozen_coefficients_match_artifact():
    """The hardcoded logit must equal the frozen-artifact logit (no drift)."""
    art = m._artifacts()["logit"]
    assert tuple(art["classes"]) == m._LOGIT_CLASSES
    assert art["intercept"] == pytest.approx(list(m._LOGIT_INTERCEPT))
    for got, exp in zip(art["coef"], m._LOGIT_COEF):
        assert got == pytest.approx(list(exp))


def test_probabilities_shape_and_sum():
    p = m.predict_wc_match("Argentina", "France", neutral=True)
    assert p is not None
    assert len(p) == 3
    assert all(0.0 <= x <= 1.0 for x in p)
    assert math.isclose(sum(p), 1.0, abs_tol=1e-9)


def test_unknown_team_returns_none():
    assert m.predict_wc_match("Atlantis", "France") is None
    assert m.predict_wc_match("Argentina", "Wakanda") is None


def test_stronger_team_higher_win_prob():
    """Argentina (~2186) crush San Marino (~915): p_home dominates on neutral."""
    p = m.predict_wc_match("Argentina", "San Marino", neutral=True)
    assert p is not None
    p_home, p_draw, p_away = p
    assert p_home > 0.9
    assert p_home > p_away
    assert p_home > p_draw


def test_ratings_sanity_argentina_beats_san_marino():
    assert m.team_rating("Argentina") > m.team_rating("San Marino")
    assert m.team_rating("Brazil") > m.team_rating("San Marino")


def test_determinism_same_input_same_output():
    a = m.predict_wc_match("Brazil", "Argentina", neutral=True)
    b = m.predict_wc_match("Brazil", "Argentina", neutral=True)
    assert a == b


def test_home_advantage_shifts_toward_home():
    """Non-neutral adds +100 Elo home -> p_home rises vs the neutral case."""
    neutral = m.predict_wc_match("Mexico", "United States", neutral=True)
    home = m.predict_wc_match("Mexico", "United States", neutral=False)
    assert neutral is not None and home is not None
    assert home[0] > neutral[0]


def test_logit_monotone_in_elo_diff():
    """Larger Elo diff -> monotonically higher p_home, lower p_away (raw)."""
    lo = m._logit_probs(0.0)
    mid = m._logit_probs(200.0)
    hi = m._logit_probs(600.0)
    assert lo[0] < mid[0] < hi[0]
    assert lo[2] > mid[2] > hi[2]
    for p in (lo, mid, hi):
        assert math.isclose(sum(p), 1.0, abs_tol=1e-9)


def test_no_certainties_on_extreme_mismatch():
    """F2 (ri-verifica michele-claude): il plateau dell'isotonica congelata
    produceva 1.00/0.00/0.00 su mismatch fuori scala (Spain-San Marino).
    Il clamp [_CAL_EPS, 1-_CAL_EPS] garantisce: mai certezze servite."""
    res = m.predict_wc_match("Spain", "San Marino", neutral=False)
    assert res is not None
    p_home, p_draw, p_away = res
    assert p_home < 1.0 and p_draw > 0.0 and p_away > 0.0
    assert math.isclose(p_home + p_draw + p_away, 1.0, abs_tol=1e-9)
    # ogni esito resta quotabile (almeno ~mezzo punto percentuale post-renorm)
    assert min(p_home, p_draw, p_away) >= 0.005


def test_clamp_does_not_distort_normal_range():
    """Il clamp F2 deve essere invisibile sui match normali (nessun knot
    estremo toccato): Mexico-United States resta identico pre/post guard
    entro la tolleranza di rinormalizzazione."""
    res = m.predict_wc_match("Mexico", "United States", neutral=True)
    assert res is not None
    assert all(0.02 < p < 0.95 for p in res)
