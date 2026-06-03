"""Tests for the Understat xG loader (pure parsing)."""
from datetime import date

from core.understat_data import parse_row


def test_parse_row_full():
    row = {
        "date": "2023-08-11", "home_team": "Burnley", "away_team": "Manchester City",
        "home_xg": "0.311", "away_xg": "2.401", "home_goals": "0", "away_goals": "3",
    }
    m = parse_row(row, "PL")
    assert m is not None
    assert m.date == date(2023, 8, 11)
    assert m.home_team == "Burnley"
    assert m.home_xg == 0.311 and m.away_xg == 2.401
    assert m.result == "A"  # away won 0-3
    assert m.as_model_match()["date"] == "2023-08-11"


def test_parse_row_draw_and_rejects_bad():
    assert parse_row({"date": "2023-08-11", "home_team": "A", "away_team": "B",
                      "home_xg": "1.0", "away_xg": "1.0", "home_goals": "1", "away_goals": "1"},
                     "SA").result == "D"
    assert parse_row({"home_team": "A"}, "PL") is None  # missing fields
