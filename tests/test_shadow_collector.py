"""Tests for the shadow-eval collector's pure assembly (#SPORTSBOOK-SHADOW-1).

The collector joins served predictions to the latest Stake/Roobet quotes by
team_pair_key and emits one shadow row per (prediction, book). The join +
row assembly is pure and tested here; the DB I/O is a thin async wrapper.
"""
from core.shadow_collector import (
    football_pair_key_for,
    tennis_pair_key_for,
    build_rows_for_football,
    build_rows_for_tennis,
)


def test_tennis_pair_key_matches_scraper_recipe():
    # scraper uses canonical_player_key + sorted + date prefix
    k = tennis_pair_key_for("Ajla Tomljanovic", "Dayana Yastremska", "2026-06-11T10:00:00+00:00")
    assert k == "2026-06-11:ajla tomljanovic|dayana yastremska"


def test_football_pair_key_matches_recipe():
    k = football_pair_key_for("Arsenal FC", "Chelsea FC", "2026-06-11T18:00:00+00:00")
    # FC stripped, lowercased, sorted
    assert k == "2026-06-11:arsenal|chelsea"


def test_build_football_rows_one_per_matched_book():
    pred = {
        "id": "u1", "sport": "football", "league": "PL",
        "home_team": "Arsenal", "away_team": "Chelsea",
        "starts_at": "2026-06-11T18:00:00+00:00",
        "p_home": 0.5, "p_draw": 0.3, "p_away": 0.2,
    }
    # book quotes keyed by (book): only stake has a quote
    books = {
        "stake": {"odds_home": 2.0, "odds_draw": 3.5, "odds_away": 4.0},
    }
    rows = build_rows_for_football(pred, books)
    # one row per requested book leg (stake matched, roobet unmatched, combined)
    by_book = {r["book"]: r for r in rows}
    assert by_book["stake"]["matched"] is True
    assert by_book["roobet"]["matched"] is False
    # unmatched -> shadow == baseline (identity, no fabricated market)
    assert by_book["roobet"]["shadow_p_home"] == 0.5
    assert by_book["stake"]["team_pair_key"] == "2026-06-11:arsenal|chelsea"
    assert by_book["stake"]["ref_source"] == "unified_predictions"


def test_build_tennis_rows():
    pred = {
        "match_id": "tennis:1", "player1": "Ajla Tomljanovic",
        "player2": "Dayana Yastremska", "scheduled_at": "2026-06-11T10:00:00+00:00",
        "p1": 0.6, "p2": 0.4,
    }
    books = {"roobet": {"odds_p1": 1.6, "odds_p2": 2.4}}
    rows = build_rows_for_tennis(pred, books)
    by_book = {r["book"]: r for r in rows}
    assert by_book["roobet"]["matched"] is True
    assert by_book["roobet"]["sport"] == "tennis"
    assert by_book["roobet"]["base_p_home"] == 0.6  # p1 stored in home slot
    assert by_book["stake"]["matched"] is False


def test_unmatched_everything_when_no_books():
    pred = {
        "id": "u2", "sport": "football", "league": "PL",
        "home_team": "A", "away_team": "B",
        "starts_at": "2026-06-11T18:00:00+00:00",
        "p_home": 0.4, "p_draw": 0.3, "p_away": 0.3,
    }
    rows = build_rows_for_football(pred, {})
    assert all(r["matched"] is False for r in rows)
