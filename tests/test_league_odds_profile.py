import pytest
from context.league_odds_profile import LeagueOddsProfiler

SAMPLE = (
    [{"result": "home", "home_odds": 1.80, "draw_odds": 3.60, "away_odds": 4.50,
      "total_goals": 3, "both_scored": True} for _ in range(40)]
    + [{"result": "draw", "home_odds": 2.80, "draw_odds": 3.20, "away_odds": 2.90,
        "total_goals": 2, "both_scored": True} for _ in range(20)]
    + [{"result": "away", "home_odds": 3.50, "draw_odds": 3.40, "away_odds": 2.10,
        "total_goals": 1, "both_scored": False} for _ in range(15)]
)


def test_profile_output_keys():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("PL", SAMPLE)
    required = {"home_win_pct", "draw_pct", "away_win_pct", "avg_home_odds",
                "avg_draw_odds", "avg_away_odds", "over25_pct", "btts_pct",
                "home_advantage_index", "value_zone"}
    assert required.issubset(profile.keys())


def test_home_win_pct_correct():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("PL", SAMPLE)
    assert abs(profile["home_win_pct"] - 40 / 75) < 0.01


def test_over25_pct_computed():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("PL", SAMPLE)
    assert 0 <= profile["over25_pct"] <= 1.0


def test_odds_anomaly_true_when_above_threshold():
    profiler = LeagueOddsProfiler()
    profiler.compute_profile("PL", SAMPLE)
    result = profiler.detect_anomaly("PL", outcome="home", current_odds=3.50)
    assert result is True


def test_odds_anomaly_false_when_normal():
    profiler = LeagueOddsProfiler()
    profiler.compute_profile("PL", SAMPLE)
    result = profiler.detect_anomaly("PL", outcome="home", current_odds=1.85)
    assert result is False


def test_value_zone_is_string():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("PL", SAMPLE)
    assert profile["value_zone"] in ("home", "away", "draw", "over", "btts", "none")


def test_insufficient_data_returns_defaults():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("XX", SAMPLE[:5])
    assert profile["home_win_pct"] is None
