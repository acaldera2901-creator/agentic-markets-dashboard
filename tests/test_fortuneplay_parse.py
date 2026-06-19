"""parse_response FortunePlay/BetConstruct (#FORTUNEPLAY-ODDS-1).

Fixture dal payload REALE catturato il 2026-06-19 da /_sb_api/api/v2/matches
(USA-Australia, Mondiali). I `name` degli outcome sono quelli localizzati EN
('USA'/'Draw'/'Australia', 'Over 2.5') APPOSTA: il parse è per POSIZIONE, non
per nome (il nome cambia con la lingua → non ci si può basare). Verifica: quote
÷1000, 1X2 + U/O, tennis 2-vie senza pareggio, skip sport non-whitelist.
"""
from core.sportsbook import fortuneplay


# --- match reale (calcio, 1X2 + U/O goal 2.5), nomi outcome EN come da API ---
_SOCCER = {
    "id": 46402256,
    "urn_id": "bc:match:29493947",
    "start_time": "2026-06-19T19:00:00Z",
    "status": 0,
    "competitors": {"home": {"name": "USA"}, "away": {"name": "Australia"}},
    "tournament": {"sport": {"key": "soccer"}},
    "main_market": {
        "name": "Match Result",
        "outcomes": [
            {"name": "USA", "odds": 1600},
            {"name": "Draw", "odds": 4500},
            {"name": "Australia", "odds": 5000},
        ],
    },
    "secondary_market": {
        "name": "Total Goals",
        "specifier": "bc_id=2222928331|hcp=2.5",
        "outcomes": [
            {"name": "Over 2.5", "odds": 1890},
            {"name": "Under 2.5", "odds": 1920},
        ],
    },
}

# --- tennis 2-vie (schema identico, niente pareggio) ---
_TENNIS = {
    "urn_id": "bc:match:111",
    "start_time": "2026-06-19T16:15:00Z",
    "status": 1,
    "competitors": {"home": {"name": "Tommy Paul"}, "away": {"name": "Alejandro Davidovich"}},
    "tournament": {"sport": {"key": "tennis"}},
    "main_market": {"outcomes": [{"name": "Tommy Paul", "odds": 1380},
                                 {"name": "Alejandro Davidovich", "odds": 2800}]},
    "secondary_market": None,
}

# --- sport non trattato dal modello: va scartato ---
_BASKET = {
    "urn_id": "bc:match:222",
    "start_time": "2026-06-19T20:00:00Z",
    "competitors": {"home": {"name": "Lakers"}, "away": {"name": "Celtics"}},
    "tournament": {"sport": {"key": "basketball"}},
    "main_market": {"outcomes": [{"name": "1", "odds": 1500}, {"name": "2", "odds": 2500}]},
}


def test_soccer_1x2_and_totals():
    [ev] = fortuneplay.parse_response({"data": [_SOCCER]})
    assert ev.source == "fortuneplay"
    assert ev.sport == "soccer"
    assert ev.competitors == ["USA", "Australia"]
    # quote ÷1000
    assert ev.odds_home == 1.6
    assert ev.odds_draw == 4.5
    assert ev.odds_away == 5.0
    # U/O 2.5
    assert ev.total_line == 2.5
    assert ev.total_over == 1.89
    assert ev.total_under == 1.92
    assert ev.event_id == "bc:match:29493947"


def test_tennis_two_way_no_draw():
    [ev] = fortuneplay.parse_response({"data": [_TENNIS]})
    assert ev.sport == "tennis"
    assert ev.odds_home == 1.38
    assert ev.odds_away == 2.8
    assert ev.odds_draw is None
    assert ev.total_line is None


def test_skips_non_whitelisted_sport():
    assert fortuneplay.parse_response({"data": [_BASKET]}) == []


def test_skips_match_without_odds():
    bad = {**_SOCCER, "main_market": {"outcomes": []}}
    assert fortuneplay.parse_response({"data": [bad]}) == []


def test_snapshot_row_shape():
    [ev] = fortuneplay.parse_response({"data": [_SOCCER]})
    row = ev.to_snapshot_row()
    assert row["bookmaker"] == "fortuneplay"
    assert row["source"] == "fortuneplay"
    assert row["market"] == "match"
    assert row["odds_home"] == 1.6 and row["odds_draw"] == 4.5 and row["odds_away"] == 5.0
    assert row["total_line"] == 2.5
    assert row["team_pair_key"] and row["team_pair_key"].startswith("2026-06-19:")
