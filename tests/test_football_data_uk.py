"""Tests for the football-data.co.uk loader (pure parsing — no network)."""
from datetime import date

from core.football_data_uk import (
    FDMatch,
    implied_probs,
    parse_csv,
    parse_row,
    season_code,
)


def test_season_code():
    assert season_code(2024) == "2425"
    assert season_code(2009) == "0910"
    assert season_code(1999) == "9900"


def test_parse_row_full():
    row = {
        "Date": "17/08/2024",
        "HomeTeam": "Man City",
        "AwayTeam": "Chelsea",
        "FTHG": "2",
        "FTAG": "0",
        "FTR": "H",
        "PSCH": "1.50",
        "PSCD": "4.50",
        "PSCA": "6.00",
        "AvgCH": "1.48",
        "AvgCD": "4.60",
        "AvgCA": "6.20",
    }
    m = parse_row(row, "PL")
    assert m is not None
    assert m.date == date(2024, 8, 17)
    assert m.league == "PL"
    assert m.home_team == "Man City"
    assert m.home_goals == 2 and m.away_goals == 0
    assert m.result == "H"
    assert m.psc_h == 1.50
    assert m.closing_home == 1.50  # Pinnacle primary


def test_parse_row_falls_back_to_avg_when_pinnacle_missing():
    row = {
        "Date": "17/08/2024",
        "HomeTeam": "A",
        "AwayTeam": "B",
        "FTHG": "1",
        "FTAG": "1",
        "FTR": "D",
        "PSCH": "",
        "PSCD": "",
        "PSCA": "",
        "AvgCH": "2.0",
        "AvgCD": "3.3",
        "AvgCA": "3.6",
    }
    m = parse_row(row, "PL")
    assert m is not None
    assert m.closing_home == 2.0
    assert m.closing_draw == 3.3
    assert m.closing_away == 3.6


def test_parse_row_rejects_incomplete():
    assert parse_row({"HomeTeam": "A", "AwayTeam": "B"}, "PL") is None  # no date/goals
    assert parse_row({"Date": "17/08/2024", "FTHG": "1", "FTAG": "0"}, "PL") is None  # no teams


def test_parse_csv_skips_trailing_blank_rows():
    text = (
        "Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,PSCH,PSCD,PSCA\n"
        "17/08/2024,A,B,1,0,H,1.9,3.5,4.0\n"
        ",,,,,,,,\n"
    )
    matches = parse_csv(text, "SA")
    assert len(matches) == 1
    assert matches[0].home_team == "A"


def test_implied_probs_normalizes_and_removes_overround():
    p = implied_probs(2.0, 4.0, 4.0)
    assert p is not None
    assert abs(sum(p) - 1.0) < 1e-9  # proper probability
    # 1/2.0=0.5 is the biggest inverse -> home most likely
    assert p[0] > p[1] and p[0] > p[2]


def test_implied_probs_none_on_missing():
    assert implied_probs(None, 3.0, 4.0) is None
    assert implied_probs(2.0, 0.0, 4.0) is None


def test_as_model_match_shape():
    m = FDMatch(
        date=date(2024, 8, 17), league="PL", home_team="A", away_team="B",
        home_goals=2, away_goals=1, result="H",
        psc_h=1.8, psc_d=3.6, psc_a=4.2, avg_h=None, avg_d=None, avg_a=None,
    )
    d = m.as_model_match()
    assert d == {
        "home_team": "A", "away_team": "B",
        "home_goals": 2, "away_goals": 1, "date": "2024-08-17",
    }
