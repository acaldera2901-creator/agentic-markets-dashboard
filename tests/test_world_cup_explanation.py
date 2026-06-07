"""
Tests for core/world_cup_explanation — the WC paper-row explanation +
Deep-Analysis enrichment builder. Asserts: real numbers only (no fabrication),
all schema fields present, NaN-free, and fail-soft when a source is missing.
"""
import math

from core.world_cup_explanation import build_wc_enrichment, build_wc_explanation
from core.world_cup_probability import national_match_probabilities
from core.world_cup_team_model import recent_form


def _history():
    """Strongland wins, Weakistan loses — chronologically ordered."""
    rows = []
    for i in range(12):
        rows.append({"home_team": "Strongland", "away_team": f"F{i}",
                     "home_goals": 3, "away_goals": 0})
    for i in range(12):
        rows.append({"home_team": f"F{i}", "away_team": "Weakistan",
                     "home_goals": 2, "away_goals": 0})
    return rows


def _no_nan(obj):
    if isinstance(obj, float):
        assert not math.isnan(obj), "NaN leaked into enrichment"
    elif isinstance(obj, dict):
        for v in obj.values():
            _no_nan(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_nan(v)


# ─── recent_form ─────────────────────────────────────────────────────────────

def test_recent_form_counts_wdl():
    f = recent_form(_history(), "Strongland", last_n=5)
    assert f["w"] == 5 and f["d"] == 0 and f["l"] == 0
    assert f["played"] == 5
    assert f["last"] == ["W", "W", "W", "W", "W"]
    assert f["gf"] == 15 and f["ga"] == 0


def test_recent_form_missing_team_is_none():
    assert recent_form(_history(), "Atlantis") is None


# ─── enrichment schema ──────────────────────────────────────────────────────

def test_enrichment_has_all_fields():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        venue={"travel_km_home": 8500, "rest_days_home": 4, "tz_shift_home": -6,
               "host_advantage": None},
        squad={"injuries_home": ["Player X"], "revealed_home": True},
        group="C",
    )
    for key in ("form_home", "form_away", "venue", "squad", "lambdas", "matches",
                "market", "group", "model"):
        assert key in enr, f"missing {key}"
    assert enr["kind"] == "world_cup"
    assert enr["lambdas"]["home"] == probs["lambda_a"]
    assert enr["venue"]["travel_km_home"] == 8500
    assert enr["squad"]["injuries_home"] == ["Player X"]
    assert enr["group"] == "C"
    _no_nan(enr)


def test_enrichment_fail_soft_no_venue_no_squad():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
    )
    assert enr["venue"]["travel_km_home"] is None
    assert enr["squad"]["injuries_home"] == []
    assert enr["squad"]["revealed_home"] is False
    assert enr["market"] is None
    _no_nan(enr)


def test_enrichment_missing_team_form_is_none():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Nowhere",
        history=_history(), probs=probs,
    )
    assert enr["form_home"] is not None
    assert enr["form_away"] is None  # fail-soft, not a crash


# ─── explanation text ────────────────────────────────────────────────────────

def test_explanation_is_specific_and_clean():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        venue={"travel_km_home": 8500, "rest_days_home": 4, "tz_shift_home": -6},
    )
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=72,
    )
    assert "Strongland" in text and "Weakistan" in text
    assert "72%" in text
    assert "W-" in text  # form line present
    assert "Expected goals" in text
    assert "nan" not in text.lower()
    assert "None" not in text
    assert text.strip().endswith("Bet responsibly.")
    # 2-4 substantive sentences + the disclaimer
    assert text.count(".") >= 3


def test_explanation_fail_soft_when_sources_missing():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Nowhere",
        history=_history(), probs=probs,
    )
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=72,
    )
    # No away form, no venue, no squad — must still be a clean, valid sentence.
    assert "Strongland" in text
    assert "None" not in text
    assert "nan" not in text.lower()
    assert text.strip().endswith("Bet responsibly.")


def test_explanation_altitude_line_at_azteca():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        venue={"altitude_m": 2240, "altitude_delta_home": 0,
               "altitude_delta_away": 2200, "host_advantage": None},
    )
    assert enr["venue"]["altitude_m"] == 2240
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=60,
    )
    assert "2,240m altitude" in text
    assert "Weakistan" in text
    assert "None" not in text
    assert "nan" not in text.lower()
    assert text.strip().endswith("Bet responsibly.")


def test_explanation_no_altitude_line_at_sea_level():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        venue={"altitude_m": 30, "altitude_delta_home": 0, "altitude_delta_away": 5},
    )
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=60,
    )
    assert "altitude" not in text.lower()


def test_explanation_heat_risk_line():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        venue={"heat_risk": True, "indoor": False},
    )
    assert enr["venue"]["heat_risk"] is True
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=60,
    )
    assert "heat" in text.lower()
    assert "None" not in text


def test_explanation_no_heat_line_when_false_or_absent():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    for venue in ({"heat_risk": False}, {}):
        enr = build_wc_enrichment(
            home_team="Strongland", away_team="Weakistan",
            canonical_home="Strongland", canonical_away="Weakistan",
            history=_history(), probs=probs, venue=venue,
        )
        text = build_wc_explanation(
            home_team="Strongland", away_team="Weakistan",
            enrichment=enr, probs=probs, pick="HOME", confidence=60,
        )
        assert "heat" not in text.lower()


def test_explanation_market_line_when_odds_present():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        market={"p_home": 0.60, "p_draw": 0.25, "p_away": 0.15},
    )
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=72,
    )
    assert "60%" in text and "Market" in text
