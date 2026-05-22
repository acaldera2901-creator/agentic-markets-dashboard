"""
Unit tests for learning.data_trust.DataTrustEngine
Run: pytest tests/test_data_trust.py -v
"""
import datetime
import pytest
from learning.data_trust import DataTrustEngine, DataTrustScore, FallbackChain


@pytest.fixture
def engine():
    return DataTrustEngine()


def _ts(minutes_ago: int) -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes_ago)


# ── DataTrustScore structure ──────────────────────────────────────────────────

class TestDataTrustScoreStructure:
    def test_score_returned(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(10))
        assert isinstance(s, DataTrustScore)

    def test_score_has_feature_name(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(10))
        assert s.feature_name == "understat_xg"

    def test_score_has_value(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(10))
        assert s.value == 1.5

    def test_score_has_trust_score_between_0_and_1(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(10))
        assert 0.0 <= s.trust_score <= 1.0

    def test_score_has_staleness_minutes(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(30))
        assert s.staleness_minutes == pytest.approx(30, abs=2)

    def test_score_has_source(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(10))
        assert s.source == "understat"

    def test_score_has_validation_flags(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(10))
        assert isinstance(s.validation_flags, list)

    def test_score_has_fallback_used(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(10))
        assert isinstance(s.fallback_used, bool)


# ── Understat rules ───────────────────────────────────────────────────────────

class TestUnderstatRules:
    def test_fresh_normal_xg_high_trust(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(20))
        assert s.trust_score >= 0.85

    def test_stale_48h_reduces_trust(self, engine):
        s = engine.score("understat_xg", 1.5, source="understat", updated_at=_ts(49 * 60))
        assert s.trust_score <= 0.55
        assert "stale_48h" in s.validation_flags

    def test_xg_zero_both_teams_on_3plus_matches_low_trust(self, engine):
        s = engine.score(
            "understat_xg", 0.0,
            source="understat", updated_at=_ts(10),
            extra={"consecutive_zero_xg_matches": 4},
        )
        assert s.trust_score <= 0.35
        assert "suspect_zero_xg" in s.validation_flags

    def test_xg_outlier_above_5_reduced_trust(self, engine):
        s = engine.score("understat_xg", 5.5, source="understat", updated_at=_ts(10))
        assert s.trust_score <= 0.65
        assert "outlier_xg" in s.validation_flags

    def test_normal_xg_no_flags(self, engine):
        s = engine.score("understat_xg", 1.8, source="understat", updated_at=_ts(10))
        assert "stale_48h" not in s.validation_flags
        assert "outlier_xg" not in s.validation_flags


# ── API-Football lineup rules ─────────────────────────────────────────────────

class TestApiFootballLineupRules:
    def test_confirmed_lineup_high_trust(self, engine):
        s = engine.score(
            "api_football_lineup", {"status": "confirmed", "players": list(range(11))},
            source="api_football", updated_at=_ts(5),
        )
        assert s.trust_score >= 0.90

    def test_predicted_lineup_far_from_kickoff_low_trust(self, engine):
        s = engine.score(
            "api_football_lineup",
            {"status": "predicted", "players": list(range(11))},
            source="api_football", updated_at=_ts(5),
            extra={"minutes_to_kickoff": 200},   # >3h
        )
        assert s.trust_score <= 0.45
        assert "predicted_lineup_early" in s.validation_flags

    def test_incomplete_lineup_very_low_trust(self, engine):
        s = engine.score(
            "api_football_lineup",
            {"status": "confirmed", "players": list(range(8))},  # <9 players
            source="api_football", updated_at=_ts(5),
        )
        assert s.trust_score <= 0.25
        assert "incomplete_lineup" in s.validation_flags

    def test_incomplete_lineup_sets_fallback_used(self, engine):
        s = engine.score(
            "api_football_lineup",
            {"status": "confirmed", "players": list(range(8))},
            source="api_football", updated_at=_ts(5),
        )
        assert s.fallback_used is True


# ── Pinnacle odds rules ───────────────────────────────────────────────────────

class TestPinnacleOddsRules:
    def test_normal_odds_high_trust(self, engine):
        s = engine.score(
            "pinnacle_odds", {"odds": 2.05, "bid": 2.03, "ask": 2.07},
            source="pinnacle", updated_at=_ts(5),
        )
        assert s.trust_score >= 0.85

    def test_stale_odds_near_kickoff_low_trust(self, engine):
        s = engine.score(
            "pinnacle_odds", {"odds": 2.05, "bid": 2.03, "ask": 2.07},
            source="pinnacle", updated_at=_ts(70),
            extra={"minutes_to_kickoff": 30},
        )
        assert s.trust_score <= 0.55
        assert "stale_near_kickoff" in s.validation_flags

    def test_invalid_odds_below_1_01(self, engine):
        s = engine.score(
            "pinnacle_odds", {"odds": 1.00},
            source="pinnacle", updated_at=_ts(5),
        )
        assert s.trust_score == pytest.approx(0.0)
        assert "invalid_odds_range" in s.validation_flags

    def test_invalid_odds_above_50(self, engine):
        s = engine.score(
            "pinnacle_odds", {"odds": 55.0},
            source="pinnacle", updated_at=_ts(5),
        )
        assert s.trust_score == pytest.approx(0.0)

    def test_wide_bid_ask_spread_low_trust(self, engine):
        s = engine.score(
            "pinnacle_odds", {"odds": 2.05, "bid": 1.95, "ask": 2.15},  # ~5% spread
            source="pinnacle", updated_at=_ts(5),
        )
        assert s.trust_score <= 0.75
        assert "wide_spread" in s.validation_flags


# ── Perplexity rules ──────────────────────────────────────────────────────────

class TestPerplexityRules:
    def test_default_trust_is_0_6(self, engine):
        s = engine.score("news_injury", "Salah out for 2 weeks",
                         source="perplexity", updated_at=_ts(15))
        assert s.trust_score == pytest.approx(0.6)

    def test_confirmed_by_api_football_raises_trust(self, engine):
        s = engine.score(
            "news_injury", "Salah out for 2 weeks",
            source="perplexity", updated_at=_ts(15),
            extra={"api_football_confirms": True},
        )
        assert s.trust_score >= 0.88

    def test_contradicts_api_football_lowers_trust(self, engine):
        s = engine.score(
            "news_injury", "Salah playing",
            source="perplexity", updated_at=_ts(15),
            extra={"api_football_contradicts": True},
        )
        assert s.trust_score <= 0.25
        assert s.fallback_used is True


# ── Prediction trust propagation ─────────────────────────────────────────────

class TestPredictionTrustPropagation:
    def test_aggregate_trust_weighted_average(self, engine):
        scores = [
            DataTrustScore("f1", 1.0, 0.9, 5, "understat", [], False, None),
            DataTrustScore("f2", 1.0, 0.8, 5, "pinnacle",  [], False, None),
            DataTrustScore("f3", 1.0, 0.7, 5, "api_football", [], False, None),
        ]
        weights = {"f1": 0.5, "f2": 0.3, "f3": 0.2}
        agg = engine.aggregate_trust(scores, weights)
        expected = 0.9 * 0.5 + 0.8 * 0.3 + 0.7 * 0.2
        assert agg == pytest.approx(expected)

    def test_aggregate_trust_missing_weight_defaults_to_equal(self, engine):
        scores = [
            DataTrustScore("f1", 1.0, 0.9, 5, "understat", [], False, None),
            DataTrustScore("f2", 1.0, 0.8, 5, "pinnacle",  [], False, None),
        ]
        agg = engine.aggregate_trust(scores, {})   # no weights → equal
        assert agg == pytest.approx(0.85)

    def test_stake_reduction_below_0_65(self, engine):
        scores = [DataTrustScore("f1", 1.0, 0.60, 5, "x", [], False, None)]
        action = engine.stake_action(scores, weights={})
        assert action["reduce_stake_pct"] == pytest.approx(0.30)

    def test_auto_skip_below_0_50(self, engine):
        scores = [DataTrustScore("f1", 1.0, 0.45, 5, "x", [], False, None)]
        action = engine.stake_action(scores, weights={})
        assert action["skip"] is True

    def test_no_action_above_0_65(self, engine):
        scores = [DataTrustScore("f1", 1.0, 0.90, 5, "x", [], False, None)]
        action = engine.stake_action(scores, weights={})
        assert action["skip"] is False
        assert action["reduce_stake_pct"] == pytest.approx(0.0)


# ── Fallback chain ────────────────────────────────────────────────────────────

class TestFallbackChain:
    def test_understat_fallback_chain_defined(self):
        assert "understat_xg" in FallbackChain
        assert len(FallbackChain["understat_xg"]) > 0

    def test_pinnacle_fallback_chain_defined(self):
        assert "pinnacle_odds" in FallbackChain

    def test_lineup_fallback_chain_defined(self):
        assert "api_football_lineup" in FallbackChain
