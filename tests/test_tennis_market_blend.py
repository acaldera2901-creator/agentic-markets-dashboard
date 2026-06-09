"""Tests for core/tennis_market_blend (shadow market-blend, 2-way)."""
import math

from core.tennis_market_blend import devig_2way, blend_tennis, TENNIS_MARKET_BLEND_ALPHA


def test_devig_normalises_and_strips_vig():
    m = devig_2way(1.5, 2.5)  # raw inv: 0.667 + 0.40 = 1.067 (6.7% vig)
    assert m is not None
    assert abs(m["p1"] + m["p2"] - 1.0) < 1e-9
    assert m["p1"] > m["p2"]            # 1.5 is the favourite
    assert abs(m["p1"] - (1/1.5)/((1/1.5)+(1/2.5))) < 1e-9


def test_devig_fail_closed_on_bad_odds():
    assert devig_2way(None, 2.0) is None
    assert devig_2way(1.0, 2.0) is None     # <=1.0 invalid
    assert devig_2way(0, 0) is None
    assert devig_2way("x", 2.0) is None


def test_blend_identity_without_market():
    assert blend_tennis(0.7, 0.3, None) == (0.7, 0.3)


def test_blend_pulls_toward_market_and_normalises():
    market = devig_2way(3.0, 1.4)           # market favours p2 heavily
    b1, b2 = blend_tennis(0.70, 0.30, market, alpha=0.3)
    assert abs(b1 + b2 - 1.0) < 1e-9
    assert b1 < 0.70                        # pulled down toward the market
    assert b2 > 0.30


def test_alpha_default_is_03():
    assert TENNIS_MARKET_BLEND_ALPHA == 0.3
