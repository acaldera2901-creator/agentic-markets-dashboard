import json, pathlib
from core.goalscorer_odds_normalize import parse_event_odds, PlayerOddRow

FIX = json.loads((pathlib.Path(__file__).parent / "fixtures" / "odds_api_goalscorer_wc.json").read_text())

def test_parses_real_fixture():
    rows = parse_event_odds(FIX, match_id="wc:spain-ksa", sport_key="soccer_fifa_world_cup")
    assert rows, "deve estrarre righe dal fixture reale"
    # 5 book x 17 giocatori (alcuni book possono variare) -> almeno > 17
    assert len(rows) > 17
    books = {r.bookmaker for r in rows}
    assert {"fanduel", "draftkings"} <= books
    r0 = rows[0]
    assert r0.market == "anytime_goalscorer"
    assert r0.match_id == "wc:spain-ksa"
    assert r0.player_id is None
    assert r0.price > 1.0
    assert abs(r0.implied_prob - 1.0 / r0.price) < 1e-9
    assert all(r.player_name for r in rows)  # description -> player_name sempre presente

def test_skips_non_yes_and_bad_price():
    ev = {"id":"e","bookmakers":[{"key":"bk","markets":[{"key":"player_goal_scorer_anytime","outcomes":[
        {"name":"Yes","description":"Good","price":2.0},
        {"name":"No","description":"Ignored","price":1.5},
        {"name":"Yes","description":"BadPrice","price":1.0},
    ]}]}]}
    rows = parse_event_odds(ev, match_id="m", sport_key="s")
    names = {r.player_name for r in rows}
    assert names == {"Good"}

def test_empty_bookmakers_yields_no_rows():
    assert parse_event_odds({"id":"e","bookmakers":[]}, match_id="m", sport_key="s") == []
