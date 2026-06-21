from core.goalscorer_match_resolver import (
    build_match_resolver,
    build_player_resolver,
    odds_sport_keys_for,
)

PREDS = [
    {"match_id": "wc:spain-ksa", "home_team": "Spain", "away_team": "Saudi Arabia",
     "date_iso": "2026-06-21T16:00:00Z"},
    {"match_id": "wc:congo-cv", "home_team": "DR Congo", "away_team": "Cape Verde",
     "date_iso": "2026-06-22T19:00:00Z"},
]


def test_sport_keys_dedup_and_known():
    assert odds_sport_keys_for(["WC", "PL", "WC", "ZZZ"]) == [
        "soccer_fifa_world_cup", "soccer_epl"
    ]


def test_resolver_matches_same_order():
    r = build_match_resolver(PREDS)
    assert r({"home_team": "Spain", "away_team": "Saudi Arabia",
              "commence_time": "2026-06-21T16:00:00Z"}) == "wc:spain-ksa"


def test_resolver_matches_inverted_order():
    # token-sorted: home/away invertiti devono comunque matchare
    r = build_match_resolver(PREDS)
    assert r({"home_team": "Saudi Arabia", "away_team": "Spain",
              "commence_time": "2026-06-21T16:00:00Z"}) == "wc:spain-ksa"


def test_resolver_timezone_tolerance():
    # commence_time il giorno dopo (fuso) deve ancora matchare entro +/-1
    r = build_match_resolver(PREDS)
    assert r({"home_team": "Cape Verde", "away_team": "DR Congo",
              "commence_time": "2026-06-23T00:30:00Z"}) == "wc:congo-cv"


def test_resolver_no_match_returns_none():
    r = build_match_resolver(PREDS)
    assert r({"home_team": "Brazil", "away_team": "Argentina",
              "commence_time": "2026-06-21T16:00:00Z"}) is None
    # squadre giuste ma data troppo lontana
    assert r({"home_team": "Spain", "away_team": "Saudi Arabia",
              "commence_time": "2026-07-01T16:00:00Z"}) is None


def test_resolver_skips_predictions_without_id_or_date():
    r = build_match_resolver([
        {"match_id": None, "home_team": "A", "away_team": "B", "date_iso": "2026-06-21T16:00:00Z"},
        {"match_id": "x", "home_team": "A", "away_team": "B", "date_iso": "bad-date"},
    ])
    assert r({"home_team": "A", "away_team": "B", "commence_time": "2026-06-21T16:00:00Z"}) is None


def test_player_resolver():
    rp = build_player_resolver([
        {"player_id": "276", "name": "Lamine Yamal"},
        {"player_id": "9", "name": "Álvaro Morata"},
    ])
    assert rp("  LAMINE  Yamal ") == "276"
    assert rp("Unknown Guy") is None
