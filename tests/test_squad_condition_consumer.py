"""
Tests for the Squad Condition Watch CONSUMERS (② of the spec):
  - why-layer enrichment (core/world_cup_explanation) — a squad sentence fires
    ONLY when there is a real signal (rotation / XI-value ratio / injuries)
  - quality-gate cap (core/world_cup_data_quality.cap_tier_for_availability) —
    availability UNKNOWN caps the publication tier

Both consumers are PROBABILITY-NEUTRAL: this file asserts that wiring squad
condition into the enrichment never touches p_home/p_draw/p_away or the lambdas
(pattern P1 altitude / P2 heat).
"""
import math

from config.settings import settings
from core.world_cup_data_quality import cap_tier_for_availability
from core.world_cup_explanation import build_wc_enrichment, build_wc_explanation
from core.world_cup_probability import national_match_probabilities


def _history():
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
        assert not math.isnan(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _no_nan(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_nan(v)


# ─── tier cap ────────────────────────────────────────────────────────────────

def test_cap_lowers_signal_when_availability_unknown():
    assert cap_tier_for_availability("signal_allowed", availability_known=False) == "paper_only"
    assert cap_tier_for_availability("premium_candidate", availability_known=False) == "paper_only"


def test_cap_noop_when_availability_known():
    assert cap_tier_for_availability("signal_allowed", availability_known=True) == "signal_allowed"
    assert cap_tier_for_availability("premium_candidate", availability_known=True) == "premium_candidate"


def test_cap_never_raises_a_lower_tier():
    # monitor_only / paper_only are already at or below the cap — untouched.
    assert cap_tier_for_availability("monitor_only", availability_known=False) == "monitor_only"
    assert cap_tier_for_availability("paper_only", availability_known=False) == "paper_only"


# ─── why-layer: squad condition sentence only on real signal ─────────────────

def test_enrichment_carries_squad_condition_fields():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        squad={
            "injuries_home": ["Player X", "Player Y"],
            "xi_value_ratio_home": 0.62,
            "rotation_flag_home": True,
        },
    )
    assert enr["squad"]["xi_value_ratio_home"] == 0.62
    assert enr["squad"]["rotation_flag_home"] is True
    assert enr["squad"]["injuries_home"] == ["Player X", "Player Y"]
    _no_nan(enr)


def test_explanation_rotation_line_when_xi_value_low():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        squad={"xi_value_ratio_home": 0.62, "rotation_flag_home": True},
    )
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=70,
    )
    assert "62%" in text
    assert "best-11" in text
    assert "None" not in text and "nan" not in text.lower()
    assert text.strip().endswith("Bet responsibly.")


def test_explanation_injury_line_when_confirmed_injuries():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        squad={"injuries_away": ["Star Player"]},
    )
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=70,
    )
    assert "Star Player" in text
    assert "None" not in text


def test_explanation_no_squad_line_without_signal():
    # No injuries, no rotation, no XI-value ratio -> no squad sentence at all.
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    enr = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
    )
    text = build_wc_explanation(
        home_team="Strongland", away_team="Weakistan",
        enrichment=enr, probs=probs, pick="HOME", confidence=70,
    )
    assert "best-11" not in text
    assert "rotates" not in text.lower()


# ─── probability-neutrality (the load-bearing assertion) ─────────────────────

def test_squad_condition_does_not_touch_probabilities():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    base = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
    )
    with_squad = build_wc_enrichment(
        home_team="Strongland", away_team="Weakistan",
        canonical_home="Strongland", canonical_away="Weakistan",
        history=_history(), probs=probs,
        squad={
            "injuries_home": ["A", "B"],
            "xi_value_ratio_home": 0.55,
            "rotation_flag_home": True,
            "xi_value_ratio_away": 0.95,
        },
    )
    # lambdas + matches (the only probability-bearing fields) are byte-identical
    assert base["lambdas"] == with_squad["lambdas"]
    assert base["matches"] == with_squad["matches"]
    # the underlying probs object is never mutated by enrichment
    assert probs == national_match_probabilities(_history(), "Strongland", "Weakistan")
