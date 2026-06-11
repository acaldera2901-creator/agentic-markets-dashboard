import json
import pathlib

from core.sportsbook.stake import parse_response

FIX = pathlib.Path(__file__).parent / "fixtures"


def test_parse_soccer_1x2():
    payload = json.loads((FIX / "stake_altenar_soccer.json").read_text())
    events = parse_response(payload, "soccer")
    assert len(events) >= 1
    for e in events:
        assert e.source == "stake" and e.sport == "soccer"
        assert len(e.competitors) == 2 and all(e.competitors)
        assert e.odds_home and e.odds_away          # 1X2 presente
        assert e.odds_draw is None or e.odds_draw > 1.0


def test_parse_tennis_match_winner():
    payload = json.loads((FIX / "stake_altenar_tennis.json").read_text())
    events = parse_response(payload, "tennis")
    assert len(events) >= 1
    e = events[0]
    assert e.sport == "tennis"
    assert e.odds_home and e.odds_away
    assert e.odds_draw is None                       # 2 vie, niente pareggio
