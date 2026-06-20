import json
import pathlib

from core.tennis_oddspapi_client import parse_oddspapi_match_odds

SAMPLE = json.loads((pathlib.Path(__file__).parent / "fixtures" / "oddspapi_odds_sample.json").read_text())


def test_parse_real_sample_returns_sane_two_way():
    r = parse_oddspapi_match_odds(SAMPLE)
    assert r is not None
    # Sample has no pinnacle; betfair-ex is skipped (1.03/1.03, overround ~1.94).
    # First sane book in iteration order is 1xbet (overround ~1.08, well within [0.90, 1.30]).
    assert r["odds_p1"] == 1.4
    assert r["odds_p2"] == 2.734
    assert r["bookmaker"] == "1xbet"
    overround = 1 / r["odds_p1"] + 1 / r["odds_p2"]
    assert overround <= 1.30


def test_parse_prefers_pinnacle_when_present():
    bk = SAMPLE.get("bookmakerOdds", {})
    r = parse_oddspapi_match_odds(SAMPLE)
    if "pinnacle" in bk:
        assert r["bookmaker"] == "pinnacle"


def test_parse_empty_or_no_market_returns_none():
    assert parse_oddspapi_match_odds({"bookmakerOdds": {}}) is None
    assert parse_oddspapi_match_odds({}) is None


def test_overround_guard_rejects_exchange_artefact():
    # Synthetic payload: one book with 1.03/1.03 (overround ~1.94, artefact),
    # followed by one book with a sane 2-way (1.40/2.90, overround ~1.06).
    payload = {
        "bookmakerOdds": {
            "betfair-ex": {
                "markets": {
                    "121": {
                        "outcomes": {
                            "121": {"players": {"0": {"price": "1.03"}}},
                            "122": {"players": {"0": {"price": "1.03"}}},
                        }
                    }
                }
            },
            "some-sane-book": {
                "markets": {
                    "121": {
                        "outcomes": {
                            "121": {"players": {"0": {"price": "1.40"}}},
                            "122": {"players": {"0": {"price": "2.90"}}},
                        }
                    }
                }
            },
        }
    }
    r = parse_oddspapi_match_odds(payload)
    assert r is not None
    # betfair-ex artefact must be skipped; sane book selected
    assert r["bookmaker"] == "some-sane-book"
    assert r["odds_p1"] == 1.40
    assert r["odds_p2"] == 2.90
    overround = 1 / r["odds_p1"] + 1 / r["odds_p2"]
    assert 0.90 <= overround <= 1.30
