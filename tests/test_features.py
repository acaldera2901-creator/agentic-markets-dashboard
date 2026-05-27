"""Unit tests for models/features.py"""
import pytest
from models.features import (
    motivation_score,
    xg_luck_streak,
    ah_odds_movement,
    normalize_referee_foul_rate,
    build_feature_bundle,
)


class TestMotivationScore:
    def test_title_contender_high_motivation(self):
        score = motivation_score(1, 20, 10)
        assert score >= 0.70

    def test_mid_table_low_motivation(self):
        score = motivation_score(10, 20, 19)
        assert score < 0.50

    def test_relegation_zone_high_motivation(self):
        score = motivation_score(18, 20, 8)
        assert score >= 0.60

    def test_season_just_started_lower_urgency(self):
        # Early season: same position but lower urgency multiplier
        early = motivation_score(1, 20, 37, 38)
        late = motivation_score(1, 20, 5, 38)
        assert early <= late

    def test_output_range(self):
        for pos in range(1, 21):
            for remaining in [5, 15, 30, 37]:
                score = motivation_score(pos, 20, remaining)
                assert 0.0 <= score <= 1.0

    def test_zero_teams_returns_neutral(self):
        score = motivation_score(1, 0, 10)
        assert score == 0.5


class TestXGLuckStreak:
    def test_positive_luck_means_underperforming(self):
        # xG=2.0, scored 1.0 → positive luck (should score more)
        result = xg_luck_streak([2.0, 1.5, 2.2, 1.8, 1.6], [1.0, 1.0, 1.0, 1.0, 1.0])
        assert result is not None
        assert result > 0

    def test_negative_luck_means_overperforming(self):
        # xG=1.0, scored 2.0 → negative luck (regression expected)
        result = xg_luck_streak([1.0, 0.8, 1.2, 0.9, 1.1], [2.0, 2.0, 2.0, 2.0, 2.0])
        assert result is not None
        assert result < 0

    def test_neutral_performance(self):
        xg = [1.5, 1.5, 1.5, 1.5, 1.5]
        goals = [1.5, 1.5, 1.5, 1.5, 1.5]
        result = xg_luck_streak(xg, goals)
        assert result == pytest.approx(0.0, abs=1e-6)

    def test_insufficient_data_returns_none(self):
        assert xg_luck_streak([1.5], [1.5]) is None
        assert xg_luck_streak([], []) is None

    def test_uses_last_n_only(self):
        # First 10 matches are irrelevant, last 5 matter
        long_xg = [10.0] * 10 + [1.5, 1.5, 1.5, 1.5, 1.5]
        long_goals = [10.0] * 10 + [1.0, 1.0, 1.0, 1.0, 1.0]
        result = xg_luck_streak(long_xg, long_goals, last_n=5)
        assert result == pytest.approx(0.5, abs=0.01)


class TestAHOddsMovement:
    def test_home_backed_positive(self):
        # Opening home 2.0 (50%), current 1.80 (55.6%) → moved toward home
        result = ah_odds_movement(2.0, 1.80, 2.0, 2.20)
        assert result is not None
        assert result > 0

    def test_away_backed_negative(self):
        # Opening home 1.80 (55.6%), current 2.0 (50%) → moved away from home
        result = ah_odds_movement(1.80, 2.0, 2.20, 1.80)
        assert result is not None
        assert result < 0

    def test_no_movement(self):
        result = ah_odds_movement(2.0, 2.0, 2.0, 2.0)
        assert result == pytest.approx(0.0, abs=1e-6)

    def test_missing_data_returns_none(self):
        assert ah_odds_movement(None, 2.0, 2.0, 2.0) is None
        assert ah_odds_movement(2.0, None, 2.0, 2.0) is None


class TestRefereeNormalization:
    def test_lenient_referee_low(self):
        result = normalize_referee_foul_rate(18.0)
        assert result == pytest.approx(0.0, abs=0.01)

    def test_strict_referee_high(self):
        result = normalize_referee_foul_rate(36.0)
        assert result == pytest.approx(1.0, abs=0.01)

    def test_average_is_mid(self):
        result = normalize_referee_foul_rate(27.0)
        assert result is not None
        assert 0.4 < result < 0.6

    def test_none_returns_none(self):
        assert normalize_referee_foul_rate(None) is None

    def test_clamps_out_of_range(self):
        assert normalize_referee_foul_rate(5.0) == 0.0
        assert normalize_referee_foul_rate(50.0) == 1.0


class TestBuildFeatureBundle:
    def test_full_bundle(self):
        bundle = build_feature_bundle(
            home_position=3,
            away_position=15,
            total_teams=20,
            matches_remaining=12,
            home_xg_history=[1.5, 2.0, 1.2, 1.8, 1.6],
            home_goals_history=[1.0, 1.0, 1.0, 2.0, 1.0],
            away_xg_history=[0.8, 1.2, 0.9, 1.1, 1.0],
            away_goals_history=[1.5, 2.0, 1.5, 1.5, 1.5],
            ah_opening_home=2.0,
            ah_current_home=1.85,
            ah_opening_away=2.0,
            ah_current_away=2.15,
            referee_fouls_per_game=26.0,
        )
        assert "motivation_home" in bundle
        assert "motivation_away" in bundle
        assert "xg_luck_home" in bundle
        assert "xg_luck_away" in bundle
        assert "ah_odds_movement" in bundle
        assert "referee_foul_rate" in bundle

    def test_empty_bundle_no_crash(self):
        bundle = build_feature_bundle()
        assert isinstance(bundle, dict)
