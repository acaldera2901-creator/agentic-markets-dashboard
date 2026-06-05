from core.tennis_odds_api_client import merge_tennis_odds, parse_tennis_odds_events


def test_parse_tennis_odds_events_extracts_h2h_prices():
    rows = parse_tennis_odds_events([
        {
            "id": "evt1",
            "sport_key": "tennis_atp_french_open",
            "commence_time": "2026-06-04T12:00:00Z",
            "home_team": "Carlos Alcaraz",
            "away_team": "Novak Djokovic",
            "bookmakers": [
                {
                    "key": "book",
                    "markets": [
                        {
                            "key": "h2h",
                            "outcomes": [
                                {"name": "Carlos Alcaraz", "price": 1.75},
                                {"name": "Novak Djokovic", "price": 2.15},
                            ],
                        }
                    ],
                }
            ],
        }
    ])

    assert rows == [{
        "odds_event_id": "evt1",
        "sport_key": "tennis_atp_french_open",
        "player1": "Carlos Alcaraz",
        "player2": "Novak Djokovic",
        "scheduled_at": "2026-06-04T12:00:00Z",
        "odds_p1": 1.75,
        "odds_p2": 2.15,
        "bookmaker": "book",
    }]


def test_merge_tennis_odds_matches_inverted_player_order():
    fixtures = [{
        "match_id": "tennis:rapidapi:1",
        "player1": "Novak Djokovic",
        "player2": "Carlos Alcaraz",
        "scheduled_at": "2026-06-04T12:30:00Z",
    }]
    odds = [{
        "odds_event_id": "evt1",
        "sport_key": "tennis_atp_french_open",
        "player1": "Carlos Alcaraz",
        "player2": "Novak Djokovic",
        "scheduled_at": "2026-06-04T12:00:00Z",
        "odds_p1": 1.75,
        "odds_p2": 2.15,
        "bookmaker": "book",
    }]

    merged = merge_tennis_odds(fixtures, odds)

    assert merged[0]["odds_p1"] == 2.15
    assert merged[0]["odds_p2"] == 1.75
    assert merged[0]["odds_provider"] == "the_odds_api"
    assert merged[0]["odds_event_id"] == "evt1"
