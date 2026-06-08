"""
Tests for the PROPOSED human rewrite (scripts/proposed_wc_explanation_v2). Preserves
the honesty/safety contract; the prose contract is the new human style. Run:
  PYTHONUTF8=1 python -m pytest tests/test_wc_explanation_v2.py -q
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from proposed_wc_explanation_v2 import build_wc_enrichment, build_wc_explanation_v2  # noqa: E402
from core.world_cup_probability import national_match_probabilities  # noqa: E402


def _history():
    rows = []
    for i in range(12):
        rows.append({"home_team": "Strongland", "away_team": f"F{i}", "home_goals": 3, "away_goals": 0})
    for i in range(12):
        rows.append({"home_team": f"F{i}", "away_team": "Weakistan", "home_goals": 2, "away_goals": 0})
    return rows


def _enr(**venue_squad):
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    return probs, build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs, **venue_squad)


def _clean(text):
    assert "None" not in text
    assert "nan" not in text.lower()
    assert text.strip().endswith("Bet responsibly.")


def test_strong_pick_is_human_no_jargon():
    probs, enr = _enr(venue={"travel_km_home": 8500, "tz_shift_home": -6})
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=72)
    assert "Strongland" in t and "Weakistan" in t and "72%" in t
    assert "strong pick" in t
    assert "Poisson" not in t and "Expected goals:" not in t
    assert "body-clock shift" in t
    _clean(t)
    assert t.count(".") >= 3


def test_coinflip_is_called_honestly():
    probs, enr = _enr()
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=41)
    assert "coin-flip" in t and "no clear favourite" in t
    _clean(t)


def test_pick_contradicting_xg_is_acknowledged():
    probs, enr = _enr()
    enr["lambdas"] = {"home": 0.90, "away": 1.40}
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=49)
    assert "actually lean Weakistan" in t
    _clean(t)


def test_short_travel_and_small_tz_are_omitted():
    probs, enr = _enr(venue={"travel_km_home": 300, "tz_shift_home": 1})
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=70)
    assert "trip" not in t and "body-clock" not in t
    _clean(t)


def test_altitude_and_heat_preserved():
    probs, enr = _enr(venue={"altitude_m": 2240, "altitude_delta_home": 0,
                             "altitude_delta_away": 2200, "heat_risk": True})
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=60)
    assert "2,240m altitude" in t and "heat" in t.lower()
    _clean(t)


def test_injuries_surface_humanly():
    probs, enr = _enr(squad={"injuries_away": ["Striker A", "Keeper B"]})
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=70)
    assert "Weakistan are without Striker A, Keeper B" in t
    _clean(t)


def test_market_line_human():
    probs, enr = _enr(market={"p_home": 0.60, "p_draw": 0.25, "p_away": 0.15})
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=72)
    assert "market sees" in t.lower() and "60%" in t
    _clean(t)


def test_single_side_form_keeps_casing():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(home_team="Strongland", away_team="Weakistan",
                              canonical_home="Strongland", canonical_away="Nowhere",
                              history=_history(), probs=probs)
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=72)
    assert "Strongland" in t
    assert " won " in t or "unbeaten" in t
    _clean(t)


def test_fail_soft_no_sources():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(home_team="Strongland", away_team="Weakistan",
                              canonical_home="Strongland", canonical_away="Nowhere",
                              history=_history(), probs=probs)
    t = build_wc_explanation_v2(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=72)
    assert "Strongland" in t
    _clean(t)
