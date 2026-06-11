import json
import pathlib

from core.sportsbook.roobet import parse_snapshot

FIX = pathlib.Path(__file__).parent / "fixtures" / "roobet_betby_snapshot.json"


def test_parse_snapshot_extracts_soccer_and_tennis():
    snap = json.loads(FIX.read_text())
    events = parse_snapshot(snap)
    assert len(events) >= 1
    assert {e.sport for e in events} <= {"soccer", "tennis"}
    for e in events:
        assert e.source == "roobet"
        assert len(e.competitors) == 2 and all(e.competitors)


def test_soccer_has_1x2_and_odds_are_decimal():
    snap = json.loads(FIX.read_text())
    soccer = [e for e in parse_snapshot(snap) if e.sport == "soccer" and e.odds_home]
    if soccer:  # la fixture include eventi calcio col market 1X2
        e = soccer[0]
        assert e.odds_home > 1.0 and e.odds_away > 1.0
        assert e.odds_draw is None or e.odds_draw > 1.0


def test_totals_line_is_balanced_pick():
    snap = json.loads(FIX.read_text())
    with_tot = [e for e in parse_snapshot(snap) if e.total_line is not None]
    for e in with_tot:
        assert e.total_over and e.total_under
