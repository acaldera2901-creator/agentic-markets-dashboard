from datetime import date

from agents.tennis_model_agent import TennisModelAgent
from core.tennis_data import TennisMatch
from core.tennis_features import TennisFeatureStore


def _match(day: date, winner: str, loser: str) -> TennisMatch:
    return TennisMatch(
        date=day,
        tour="atp",
        surface="Hard",
        winner=winner,
        loser=loser,
        best_of=3,
        winner_rank=10,
        loser_rank=30,
        minutes=90,
        w_svpt=70,
        w_1st_won=44,
        w_2nd_won=14,
        l_svpt=65,
        l_1st_won=30,
        l_2nd_won=8,
    )


def test_score_fixture_v4_adds_features_odds_edge_and_snapshot():
    agent = TennisModelAgent()
    agent.feature_store = TennisFeatureStore.from_matches(
        [
            _match(date(2026, 1, 1), "Player A", "Player B"),
            _match(date(2026, 1, 3), "Player A", "Player C"),
            _match(date(2026, 1, 6), "Player B", "Player D"),
        ],
        cutoff=date(2026, 1, 10),
    )
    agent.elo.ratings["Player A"] = {
        "overall": 1700.0,
        "hard": 1700.0,
        "clay": 1600.0,
        "grass": 1600.0,
        "hard_matches": 30,
        "clay_matches": 5,
        "grass_matches": 5,
        "matches": 40,
    }
    agent.elo.ratings["Player B"] = {
        "overall": 1500.0,
        "hard": 1500.0,
        "clay": 1500.0,
        "grass": 1500.0,
        "hard_matches": 30,
        "clay_matches": 5,
        "grass_matches": 5,
        "matches": 40,
    }

    pred = agent._score_fixture({
        "match_id": "tennis:test:1",
        "player1": "Player A",
        "player2": "Player B",
        "surface": "hard",
        "tournament": "ATP Test Open",
        "round": "Quarterfinals",
        "scheduled_at": "2026-01-10T12:00:00Z",
        "p1_rank": 10,
        "p2_rank": 30,
        "odds_p1": 1.95,
        "odds_p2": 2.10,
    })

    assert pred is not None
    assert pred["model_version"] == "elo_surface_v4_features_odds"
    assert pred["serve_form_p1"] > pred["serve_form_p2"]
    assert pred["return_form_p1"] >= pred["return_form_p2"]
    assert pred["feature_quality"] > 0
    assert pred["odds_p1"] == 1.95
    assert pred["odds_p2"] == 2.10
    assert pred["edge"] is not None
    assert pred["best_selection"] in {"P1", "P2", None}
    assert "feature_snapshot" in pred
