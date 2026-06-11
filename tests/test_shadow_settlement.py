"""Tests for shadow-eval outcome resolution (#SPORTSBOOK-SHADOW-1)."""
from core.shadow_settlement import outcome_from_score, outcome_from_tennis


def test_outcome_from_score_home_win():
    assert outcome_from_score("3-0") == 0


def test_outcome_from_score_draw():
    assert outcome_from_score("2-2") == 1


def test_outcome_from_score_away_win():
    assert outcome_from_score("0-4") == 2


def test_outcome_from_score_bad():
    assert outcome_from_score(None) is None
    assert outcome_from_score("abc") is None
    assert outcome_from_score("") is None


def test_outcome_from_tennis():
    assert outcome_from_tennis("P1_WIN") == 0
    assert outcome_from_tennis("P2_WIN") == 2
    assert outcome_from_tennis("expired") is None
    assert outcome_from_tennis(None) is None
