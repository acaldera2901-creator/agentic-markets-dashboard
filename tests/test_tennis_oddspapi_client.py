import json
import pathlib

from core.tennis_oddspapi_client import parse_oddspapi_match_odds

SAMPLE = json.loads((pathlib.Path(__file__).parent / "fixtures" / "oddspapi_odds_sample.json").read_text())


def test_parse_real_sample_returns_two_way():
    r = parse_oddspapi_match_odds(SAMPLE)
    assert r is not None
    # Sample has no pinnacle; anchor falls to betfair-ex (first in ANCHOR_ORDER present).
    # betfair-ex has both prices at 1.03 (confirmed from real fixture).
    assert r["odds_p1"] == 1.03
    assert r["odds_p2"] == 1.03
    assert r["bookmaker"] == "betfair-ex"


def test_parse_prefers_pinnacle_when_present():
    bk = SAMPLE.get("bookmakerOdds", {})
    r = parse_oddspapi_match_odds(SAMPLE)
    if "pinnacle" in bk:
        assert r["bookmaker"] == "pinnacle"


def test_parse_empty_or_no_market_returns_none():
    assert parse_oddspapi_match_odds({"bookmakerOdds": {}}) is None
    assert parse_oddspapi_match_odds({}) is None
