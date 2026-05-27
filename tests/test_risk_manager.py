"""Unit tests for agents/risk_manager.py"""
import pytest
from agents.risk_manager import (
    kelly_stake,
    resolve_edge_threshold,
    data_completeness_score,
    is_within_limits,
    EXPECTED_FEATURES,
)


class TestKellyStake:
    def test_zero_edge_returns_zero(self):
        assert kelly_stake(0.0, 2.0, 500.0) == 0.0

    def test_negative_edge_returns_zero(self):
        assert kelly_stake(-0.05, 2.0, 500.0) == 0.0

    def test_full_kelly_formula(self):
        # Standard Kelly: f* = edge*odds / (odds-1)
        # edge=0.10, odds=2.0 → kelly_full = 0.10*2.0/(2-1) = 0.20
        # fractional = 0.20 * 0.25 * 500 = 25.0
        stake = kelly_stake(0.10, 2.0, 500.0, kelly_fraction=0.25, max_bet_pct=0.10)
        assert stake == pytest.approx(25.0, rel=1e-3)

    def test_cap_applied(self):
        # Very large edge → stake capped at max_bet_pct * bankroll
        stake = kelly_stake(0.50, 1.5, 500.0, kelly_fraction=0.25, max_bet_pct=0.03)
        cap = 0.03 * 500.0
        assert stake <= cap

    def test_fractional_kelly_smaller_than_full(self):
        full = kelly_stake(0.10, 2.0, 500.0, kelly_fraction=1.0, max_bet_pct=1.0)
        fractional = kelly_stake(0.10, 2.0, 500.0, kelly_fraction=0.25, max_bet_pct=1.0)
        assert fractional < full

    def test_legacy_test_still_passes(self):
        # Standard Kelly: edge=0.05, odds=3.0 → kelly_full = 0.05*3.0/(3-1) = 0.075
        # fractional = 0.075 * 0.25 * 500 = 9.375 → capped at max_bet_pct(3%)*500 = 15
        stake = kelly_stake(edge=0.05, odds=3.0, bankroll=500.0, kelly_fraction=0.25)
        assert abs(stake - 9.375) < 0.1

    def test_legacy_capped_at_max_fraction(self):
        stake = kelly_stake(edge=0.4, odds=2.0, bankroll=500.0, kelly_fraction=0.25, max_bet_pct=0.02)
        assert stake <= 10.0


class TestResolveEdgeThreshold:
    def test_pinnacle_in_notes_returns_sharp(self):
        data = {"notes": "edge=0.03 on home via Pinnacle odds"}
        threshold, tier = resolve_edge_threshold(data)
        assert tier == "sharp"
        assert threshold < 0.05

    def test_default_soft_tier(self):
        data = {"notes": "some bookmaker odds"}
        threshold, tier = resolve_edge_threshold(data)
        assert tier == "soft"
        assert threshold >= 0.04

    def test_source_field_pinnacle(self):
        data = {"source": "pinnacle", "notes": ""}
        _, tier = resolve_edge_threshold(data)
        assert tier == "sharp"


class TestDataCompletenessScore:
    def test_complete_data(self):
        complete = {f: "value" for f in EXPECTED_FEATURES}
        score, missing = data_completeness_score(complete)
        assert score == 1.0
        assert missing == []

    def test_missing_fields_reduce_score(self):
        partial = {f: "value" for f in EXPECTED_FEATURES[:6]}
        score, missing = data_completeness_score(partial)
        assert score < 1.0
        assert len(missing) == len(EXPECTED_FEATURES) - 6

    def test_empty_data_zero_score(self):
        score, missing = data_completeness_score({})
        assert score == pytest.approx(0.0, abs=0.01)
        assert len(missing) == len(EXPECTED_FEATURES)

    def test_score_range(self):
        score, _ = data_completeness_score({"match_id": "abc"})
        assert 0.0 <= score <= 1.0


class TestIsWithinLimits:
    def test_within_limits(self):
        assert is_within_limits(0.05, 25.0, 500.0, 0.10) is True

    def test_at_limit(self):
        assert is_within_limits(0.05, 25.0, 500.0, 0.10) is True

    def test_over_limit(self):
        assert is_within_limits(0.09, 25.0, 500.0, 0.10) is False

    def test_empty_exposure(self):
        assert is_within_limits(0.0, 10.0, 500.0, 0.10) is True

    def test_legacy_passes(self):
        assert is_within_limits(current_exposure=0.05, new_stake=10.0, bankroll=500.0, max_exposure=0.10) is True

    def test_legacy_fails_when_over(self):
        assert is_within_limits(current_exposure=0.09, new_stake=10.0, bankroll=500.0, max_exposure=0.10) is False
