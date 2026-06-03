"""Tests for tennis loader + surface Elo."""
from datetime import date

from core.tennis_data import TennisMatch, parse_row
from models.tennis_elo import SurfaceElo


def test_parse_row_minimal():
    row = {
        "tourney_date": "20230102", "surface": "Hard",
        "winner_name": "Taylor Fritz", "loser_name": "Matteo Berrettini",
        "best_of": "3", "winner_rank": "9", "loser_rank": "16", "minutes": "135",
        "w_svpt": "85", "w_1stWon": "52", "w_2ndWon": "15",
        "l_svpt": "80", "l_1stWon": "45", "l_2ndWon": "12",
    }
    m = parse_row(row, "atp")
    assert m is not None
    assert m.date == date(2023, 1, 2)
    assert m.surface == "Hard"
    assert m.winner == "Taylor Fritz"
    assert m.winner_rank == 9
    assert m.w_svpt == 85


def test_parse_row_handles_missing_stats():
    row = {
        "tourney_date": "20230102", "surface": "", "winner_name": "A", "loser_name": "B",
        "winner_rank": "", "w_svpt": "",
    }
    m = parse_row(row, "wta")
    assert m is not None
    assert m.surface == "Unknown"
    assert m.winner_rank is None and m.w_svpt is None
    assert m.best_of == 3  # default


def test_parse_row_rejects_no_players_or_date():
    assert parse_row({"tourney_date": "20230102"}, "atp") is None
    assert parse_row({"winner_name": "A", "loser_name": "B"}, "atp") is None


def test_serve_won_pct():
    assert TennisMatch.serve_won_pct(52, 15, 85) == (52 + 15) / 85
    assert TennisMatch.serve_won_pct(None, 15, 85) is None
    assert TennisMatch.serve_won_pct(52, 15, 0) is None


def test_elo_even_at_start_and_rewards_winner():
    elo = SurfaceElo()
    assert abs(elo.expected("A", "B", "Hard") - 0.5) < 1e-9
    elo.update("A", "B", "Hard")
    assert elo.expected("A", "B", "Hard") > 0.5
    assert elo.rating("A", "Hard") > elo.rating("B", "Hard")


def test_elo_surface_specific():
    elo = SurfaceElo(surface_weight=0.5)
    for _ in range(5):
        elo.update("Clayer", "X", "Clay")
    # strong on clay, neutral on grass
    assert elo.expected("Clayer", "X", "Clay") > elo.expected("Clayer", "X", "Grass")
