# tests/test_market_blend_alpha.py
"""#BLEND-ALPHA-0914 — parita' Python del peso del modello nel blend e delle leghe a zero.
Specchio di lib/market-blend-alpha.test.ts; i valori sono una decisione con APPROVE."""
from core.market_blend import (
    MARKET_BLEND_ALPHA,
    MODEL_OFF_LEAGUES,
    blend_alpha_for,
    blend_with_market,
    devig_1x2,
)


def test_default_alpha_is_0_1():
    assert MARKET_BLEND_ALPHA == 0.1


def test_model_off_leagues_serve_pure_market():
    assert MODEL_OFF_LEAGUES == frozenset({"DNK", "BEL", "NED", "LOI", "EFLC", "WC"})
    for code in MODEL_OFF_LEAGUES:
        assert blend_alpha_for(code) == 0.0


def test_neutral_leagues_keep_full_alpha():
    for code in ("MLS", "BRA", "BL2", "EL1", "UNL", "CNL", "FRIENDLY"):
        assert blend_alpha_for(code) == MARKET_BLEND_ALPHA
    assert blend_alpha_for(None) == MARKET_BLEND_ALPHA


def test_wc_served_is_the_devigged_market():
    market = devig_1x2(2.10, 3.30, 3.80)
    ph, pd, pa = blend_with_market(0.46, 0.27, 0.27, market, alpha=blend_alpha_for("WC"))
    assert abs(ph - market["home"]) < 1e-12
    assert abs(pd - market["draw"]) < 1e-12
    assert abs(pa - market["away"]) < 1e-12


def test_no_market_stays_identity_even_when_alpha_is_zero():
    assert blend_with_market(0.46, 0.27, 0.27, None, alpha=0.0) == (0.46, 0.27, 0.27)
