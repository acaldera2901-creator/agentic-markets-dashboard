# tests/test_tennis_api_client.py
import pytest
from core.tennis_api_client import TennisAPIClient, normalize_player_name


def test_normalize_player_name():
    assert normalize_player_name("Carlos Alcaraz") == "carlos alcaraz"
    assert normalize_player_name("  Novak Djokovic  ") == "novak djokovic"


def test_parse_fixture_returns_canonical_shape():
    client = TennisAPIClient(rapidapi_key="test", supabase_url=None, supabase_key=None)
    raw = {
        "id": 99,
        "date": "2026-06-01T14:00:00",
        "tournament": {"name": "Roland Garros", "surface": "Clay"},
        "round": {"name": "Quarterfinals"},
        "players": {
            "home": {"name": "Carlos Alcaraz", "ranking": 3},
            "away": {"name": "Novak Djokovic", "ranking": 2},
        },
    }
    result = client._parse_fixture(raw)
    assert result is not None
    assert result["player1"] == "Carlos Alcaraz"
    assert result["player2"] == "Novak Djokovic"
    assert result["surface"] == "clay"
    assert result["round"] == "Quarterfinals"
    assert result["p1_rank"] == 3
    assert result["p2_rank"] == 2
    assert "match_id" in result
    assert result["match_id"] == "tennis:rapidapi:99"


def test_parse_fixture_returns_none_without_player_names():
    client = TennisAPIClient(rapidapi_key="test", supabase_url=None, supabase_key=None)
    raw = {"id": 1, "players": {"home": {}, "away": {}}}
    assert client._parse_fixture(raw) is None


def test_parse_fixture_maps_surface_correctly():
    client = TennisAPIClient(rapidapi_key="test", supabase_url=None, supabase_key=None)
    for surface_in, surface_out in [("Clay", "clay"), ("Hard", "hard"), ("Grass", "grass"), ("Indoor Hard", "hard")]:
        raw = {
            "id": 1, "date": "2026-06-01T14:00:00",
            "tournament": {"name": "Test", "surface": surface_in},
            "round": {"name": "R1"},
            "players": {
                "home": {"name": "Player A", "ranking": 1},
                "away": {"name": "Player B", "ranking": 2},
            },
        }
        result = client._parse_fixture(raw)
        assert result["surface"] == surface_out, f"Expected {surface_out} for {surface_in}"
