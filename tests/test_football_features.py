from datetime import date

from core.football_features import FootballFeatureStore
from core.understat_data import XGMatch


def _m(
    day: int,
    home: str,
    away: str,
    hg: int,
    ag: int,
    hxg: float,
    axg: float,
    hnpxg: float | None = None,
    anpxg: float | None = None,
    hppda: float | None = None,
    appda: float | None = None,
) -> XGMatch:
    return XGMatch(
        date=date(2024, 1, day),
        league="PL",
        home_team=home,
        away_team=away,
        home_goals=hg,
        away_goals=ag,
        home_xg=hxg,
        away_xg=axg,
        home_npxg=hnpxg,
        away_npxg=anpxg,
        home_ppda=hppda,
        away_ppda=appda,
    )


def test_match_context_is_point_in_time_and_ignores_future_results():
    matches = [
        _m(1, "Alpha", "Beta", 2, 0, 2.0, 0.6, 1.8, 0.5, 8.0, 14.0),
        _m(5, "Gamma", "Alpha", 1, 1, 1.0, 1.4, 0.9, 1.2, 12.0, 9.0),
        _m(8, "Beta", "Gamma", 0, 3, 0.7, 2.2, 0.6, 1.9, 15.0, 7.0),
        _m(20, "Alpha", "Beta", 0, 5, 0.2, 4.5, 0.2, 4.0, 20.0, 5.0),
    ]
    store = FootballFeatureStore(matches)

    before_future = store.match_context("Alpha", "Beta", "PL", date(2024, 1, 10))
    after_future = store.match_context("Alpha", "Beta", "PL", date(2024, 1, 25))

    assert before_future["home_matches_total"] == 2
    assert before_future["away_matches_total"] == 2
    assert after_future["home_matches_total"] == 3
    assert before_future["home_xg_avg"] != after_future["home_xg_avg"]
    assert before_future["away_xg_avg"] < after_future["away_xg_avg"]
    assert before_future["home_rest_days"] == 5
    assert before_future["away_rest_days"] == 2


def test_unknown_team_returns_neutral_low_quality_context():
    store = FootballFeatureStore([_m(1, "Alpha", "Beta", 1, 1, 1.1, 1.0)])
    ctx = store.match_context("Unknown", "Beta", "PL", date(2024, 1, 3))

    assert ctx["home_ppg"] == 1.5
    assert ctx["home_xg_avg"] == 1.3
    assert ctx["home_matches_total"] == 0
    assert ctx["feature_quality"] < 0.5


def test_context_contains_xg_luck_congestion_and_feature_snapshot_fields():
    store = FootballFeatureStore(
        [
            _m(1, "Alpha", "Beta", 3, 0, 1.2, 0.5, 1.0, 0.4),
            _m(3, "Alpha", "Gamma", 2, 2, 2.4, 1.0, 2.1, 0.8),
            _m(6, "Delta", "Alpha", 0, 1, 0.8, 1.6, 0.7, 1.4),
            _m(2, "Beta", "Gamma", 0, 1, 0.6, 1.7, 0.5, 1.5),
            _m(7, "Beta", "Delta", 2, 1, 2.0, 0.9, 1.8, 0.7),
        ]
    )
    ctx = store.match_context("Alpha", "Beta", "PL", date(2024, 1, 10))

    assert ctx["home_congestion_14d"] == 3
    assert ctx["away_congestion_14d"] == 3
    assert ctx["home_xg_luck"] > 0
    assert ctx["away_xg_luck"] < 0
    assert 0.0 < ctx["feature_quality"] <= 1.0
    assert "feature_snapshot" in ctx
    assert ctx["feature_snapshot"]["league"] == "PL"
