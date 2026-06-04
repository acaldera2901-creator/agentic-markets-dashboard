from agents.tennis_model_agent import tennis_fixture_identity
from core.espn_tennis_client import _parse_notes
from core.tennis_names import canonical_player_key, clean_player_name
from models.elo_surface import EloSurfaceModel


def test_espn_notes_strip_score_and_retirement_suffix():
    parsed = _parse_notes("Matteo Arnaldi bt Matteo Berrettini 7-5 5-2 ret", "Men's Singles")

    assert parsed is not None
    assert parsed["player1"] == "Matteo Arnaldi"
    assert parsed["player2"] == "Matteo Berrettini"
    assert parsed["match_status"] == "completed"


def test_clean_player_name_removes_seed_country_and_scores():
    assert clean_player_name("(8) Iga Swiatek (POL) 6-4 6-2") == "Iga Swiatek"


def test_canonical_player_key_collapses_provider_punctuation():
    assert canonical_player_key("Félix Auger-Aliassime") == "felix auger aliassime"
    assert canonical_player_key("Felix Auger Aliassime") == "felix auger aliassime"


def test_elo_predict_uses_canonical_name_lookup():
    elo = EloSurfaceModel()
    elo.ratings["Felix Auger Aliassime"] = {
        "overall": 1700.0,
        "clay": 1680.0,
        "grass": 1650.0,
        "hard": 1710.0,
        "clay_matches": 20,
        "grass_matches": 8,
        "hard_matches": 30,
        "matches": 100,
    }
    elo.ratings["Opponent"] = {
        "overall": 1500.0,
        "clay": 1500.0,
        "grass": 1500.0,
        "hard": 1500.0,
        "clay_matches": 20,
        "grass_matches": 20,
        "hard_matches": 20,
        "matches": 80,
    }

    pred = elo.predict("Felix Auger-Aliassime", "Opponent", "clay")

    assert pred["p1"] > 0.7


def test_fixture_identity_dedupes_inverted_pairs():
    a = {
        "player1": "Matteo Berrettini",
        "player2": "Matteo Arnaldi",
        "tournament": "Roland Garros",
        "scheduled_at": "2026-06-04T12:00:00Z",
    }
    b = {
        "player1": "Matteo Arnaldi",
        "player2": "Matteo Berrettini",
        "tournament": "Roland Garros",
        "scheduled_at": "2026-06-04T12:00:00Z",
    }

    assert tennis_fixture_identity(a) == tennis_fixture_identity(b)
