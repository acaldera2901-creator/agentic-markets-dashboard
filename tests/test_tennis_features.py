from datetime import date

from core.tennis_data import TennisMatch
from core.tennis_features import TennisFeatureStore


def _match(
    day: date,
    winner: str,
    loser: str,
    surface: str = "Hard",
    w_svpt: int = 60,
    w_1st_won: int = 35,
    w_2nd_won: int = 10,
    l_svpt: int = 60,
    l_1st_won: int = 25,
    l_2nd_won: int = 8,
    winner_rank: int | None = 10,
    loser_rank: int | None = 20,
) -> TennisMatch:
    return TennisMatch(
        date=day,
        tour="atp",
        surface=surface,
        winner=winner,
        loser=loser,
        best_of=3,
        winner_rank=winner_rank,
        loser_rank=loser_rank,
        minutes=90,
        w_svpt=w_svpt,
        w_1st_won=w_1st_won,
        w_2nd_won=w_2nd_won,
        l_svpt=l_svpt,
        l_1st_won=l_1st_won,
        l_2nd_won=l_2nd_won,
    )


def test_feature_store_uses_only_matches_before_fixture_date():
    store = TennisFeatureStore.from_matches(
        [
            _match(date(2026, 1, 1), "A", "B"),
            _match(date(2026, 2, 1), "B", "A", w_1st_won=50, w_2nd_won=8, l_1st_won=12, l_2nd_won=3),
        ],
        cutoff=date(2026, 1, 15),
    )

    a = store.player_features("A", "hard")
    b = store.player_features("B", "hard")

    assert a.serve_form > b.serve_form
    assert a.matches_total == 1
    assert b.matches_total == 1


def test_match_context_includes_serve_return_reliability_and_fatigue():
    store = TennisFeatureStore.from_matches(
        [
            _match(date(2026, 1, 1), "A", "B"),
            _match(date(2026, 1, 5), "A", "C", surface="Clay", w_svpt=70, w_1st_won=42, w_2nd_won=12),
            _match(date(2026, 1, 10), "B", "D", surface="Hard", w_svpt=55, w_1st_won=32, w_2nd_won=8),
        ],
        cutoff=date(2026, 1, 12),
    )

    context = store.match_context("A", "B", "hard", date(2026, 1, 12))

    assert context["serve_form_p1"] > 0
    assert context["return_form_p1"] > 0
    assert context["surface_matches_p1"] == 1
    assert context["surface_reliability_p1"] > 0
    assert context["p1_rest_days"] == 7
    assert context["p2_rest_days"] == 2
    assert context["h2h_p1_wins"] == 1
    assert context["h2h_p2_wins"] == 0
    assert 0 < context["feature_quality"] <= 1


def test_unknown_player_gets_neutral_features():
    store = TennisFeatureStore.from_matches([], cutoff=date(2026, 1, 12))

    features = store.player_features("Unknown", "hard")

    assert features.serve_form == 0.62
    assert features.return_form == 0.38
    assert features.reliability == 0.0
