import pytest
from context.league_strength import LeagueStrengthAnalyzer

SAMPLE_MATCHES = (
    [{"home_goals": 2, "away_goals": 1, "home_xg": 1.8, "away_xg": 0.9,
      "home_odds": 1.80, "away_odds": 4.50, "draw_odds": 3.60, "result": "home"}
     for _ in range(30)]
    + [{"home_goals": 0, "away_goals": 2, "home_xg": 0.7, "away_xg": 2.1,
        "home_odds": 2.10, "away_odds": 3.20, "draw_odds": 3.40, "result": "away"}
       for _ in range(20)]
    + [{"home_goals": 1, "away_goals": 1, "home_xg": 1.2, "away_xg": 1.3,
        "home_odds": 2.50, "away_odds": 2.60, "draw_odds": 3.20, "result": "draw"}
       for _ in range(10)]
)


def test_profile_output_keys():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("PL", "Premier League", SAMPLE_MATCHES)
    required = {"league_id", "league_name", "strength_tier", "market_efficiency",
                "predictability_score", "avg_xg_per_game", "result_volatility",
                "liquidity_score", "recommended_edge_min"}
    assert required.issubset(profile.keys())


def test_top5_league_gets_tier1():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("PL", "Premier League", SAMPLE_MATCHES)
    assert profile["strength_tier"] == 1


def test_insufficient_data_returns_none_tier():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("XX", "Unknown League", SAMPLE_MATCHES[:10])
    assert profile["strength_tier"] is None


def test_avg_xg_computed():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("SA", "Serie A", SAMPLE_MATCHES)
    assert profile["avg_xg_per_game"] is not None
    assert 0 < profile["avg_xg_per_game"] < 10


def test_result_volatility_positive():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("SA", "Serie A", SAMPLE_MATCHES)
    assert profile["result_volatility"] >= 0


def test_recommended_edge_min_between_0_and_1():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("PL", "Premier League", SAMPLE_MATCHES)
    assert 0 < profile["recommended_edge_min"] < 1.0


def test_market_efficiency_between_0_and_1():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("PL", "Premier League", SAMPLE_MATCHES)
    assert 0.0 <= profile["market_efficiency"] <= 1.0


def test_upset_rate_computed():
    analyzer = LeagueStrengthAnalyzer()
    upset_rate = analyzer._compute_upset_rate(SAMPLE_MATCHES)
    assert 0.0 <= upset_rate <= 1.0


def test_fallback_xg_from_shots():
    matches_no_xg = [
        {"home_goals": 2, "away_goals": 1, "home_shots_on_target": 5, "away_shots_on_target": 3,
         "home_odds": 1.80, "away_odds": 4.50, "draw_odds": 3.60, "result": "home"}
        for _ in range(30)
    ]
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("SA", "Serie A", matches_no_xg)
    assert profile["avg_xg_per_game"] is not None
