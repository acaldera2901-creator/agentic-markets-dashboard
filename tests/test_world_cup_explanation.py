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


# ─── explanation text (why v2 — promoted 2026-06-08, settings-keyed tiers) ───
#
# The prose contract is the human rewrite (former build_wc_explanation_v2): a
# confidence-keyed lead, no internal jargon ("Poisson rates", "Expected goals:"),
# honest on coin-flips/xG contradictions. The 9 cases below are Michele's lab
# contract (tests/test_wc_explanation_v2.py @ 34e58fb), re-pointed at the
# promoted core function. Lead tiers read from settings (strong >= 65, favoured
# >= 56, else coin-flip) — the lab's 72/60/41 values straddle those boundaries.

def _clean(text):
    assert "None" not in text
    assert "nan" not in text.lower()
    assert text.strip().endswith("Bet responsibly.")


def test_strong_pick_is_human_no_jargon():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        venue={"travel_km_home": 8500, "tz_shift_home": -6},
    )
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=72)
    assert "Strongland" in t and "Weakistan" in t and "72%" in t
    assert "strong pick" in t
    assert "Poisson" not in t and "Expected goals:" not in t
    assert "body-clock shift" in t
    _clean(t)
    assert t.count(".") >= 3


def test_coinflip_is_called_honestly():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
    )
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=41)
    assert "coin-flip" in t and "no clear favourite" in t
    _clean(t)


def test_pick_contradicting_xg_is_acknowledged():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
    )
    enr["lambdas"] = {"home": 0.90, "away": 1.40}
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=49)
    assert "actually lean Weakistan" in t
    _clean(t)


def test_short_travel_and_small_tz_are_omitted():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        venue={"travel_km_home": 300, "tz_shift_home": 1},
    )
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=70)
    assert "trip" not in t and "body-clock" not in t
    _clean(t)


def test_altitude_and_heat_preserved():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        venue={"altitude_m": 2240, "altitude_delta_home": 0,
               "altitude_delta_away": 2200, "heat_risk": True},
    )
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=60)
    assert "2,240m altitude" in t and "heat" in t.lower()
    _clean(t)


def test_injuries_surface_humanly():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        squad={"injuries_away": ["Striker A", "Keeper B"]},
    )
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=70)
    assert "Weakistan are without Striker A, Keeper B" in t
    _clean(t)


def test_market_line_human():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        market={"p_home": 0.60, "p_draw": 0.25, "p_away": 0.15},
    )
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=72)
    assert "market sees" in t.lower() and "60%" in t
    _clean(t)


def test_single_side_form_keeps_casing():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(home_team="Strongland", away_team="Weakistan",
                              canonical_home="Strongland", canonical_away="Nowhere",
                              history=_history(), probs=probs)
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=72)
    assert "Strongland" in t
    assert " won " in t or "unbeaten" in t
    _clean(t)


def test_fail_soft_no_sources():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(home_team="Strongland", away_team="Weakistan",
                              canonical_home="Strongland", canonical_away="Nowhere",
                              history=_history(), probs=probs)
    t = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                             enrichment=enr, probs=probs, pick="HOME", confidence=72)
    assert "Strongland" in t
    _clean(t)


def test_strong_pick_tier_reads_from_settings(monkeypatch):
    # Single-source-of-truth: dropping the strong-pick bar must turn a previously
    # "favoured but open" lead into a "strong pick" one. Probability-neutral —
    # only the copy changes, not the 60% it prints.
    from config.settings import settings
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
    )
    base = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                                enrichment=enr, probs=probs, pick="HOME", confidence=60)
    assert "strong pick" not in base
    monkeypatch.setattr(settings, "WHY_STRONG_PICK_CONFIDENCE", 60)
    promoted = build_wc_explanation(home_team="Strongland", away_team="Weakistan",
                                    enrichment=enr, probs=probs, pick="HOME", confidence=60)
    assert "strong pick" in promoted
    assert "60%" in promoted
