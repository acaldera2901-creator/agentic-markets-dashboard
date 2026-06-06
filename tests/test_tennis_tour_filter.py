# tests/test_tennis_tour_filter.py
"""#020 — tennis board curation: main draw + main tour only.

Qualifying is detected from the REAL ESPN round field; minor circuits from the
explicit config denylist (accent-folded). Drops are reported, never silent.
"""
from core.tennis_tour_filter import (
    filter_main_tour,
    is_denylisted,
    is_qualifying,
    parse_denylist,
)

DENY = parse_denylist("itf,challenger,125,memorial,trofeo,makarska,puglie,ilkley,fontana")


def _fx(tournament, round_name=""):
    return {"tournament": tournament, "round": round_name, "player1": "A", "player2": "B"}


def test_qualifying_detected_from_round_field():
    assert is_qualifying(_fx("Libéma Open", "Qualifying 1st Round"))
    assert is_qualifying(_fx("Makarska Open", "Qualifying Final"))
    assert not is_qualifying(_fx("Libéma Open", "Round 1"))
    assert not is_qualifying(_fx("Roland Garros", "Final"))


def test_denylist_matches_accent_folded_names():
    assert is_denylisted(_fx("Open delle Puglie Trofeo"), DENY)
    assert is_denylisted(_fx("Makarska Open"), DENY)
    assert is_denylisted(_fx("Memorial Eugenio Fontana"), DENY)
    assert is_denylisted(_fx("Lexus Ilkley Open"), DENY)
    assert not is_denylisted(_fx("Libéma Open"), DENY)
    assert not is_denylisted(_fx("The HSBC Championships"), DENY)
    assert not is_denylisted(_fx("Boss Open"), DENY)
    assert not is_denylisted(_fx("Roland Garros"), DENY)


def test_filter_keeps_main_draw_main_tour_and_reports_drops():
    fixtures = [
        _fx("Libéma Open", "Round 1"),
        _fx("Libéma Open", "Qualifying 1st Round"),
        _fx("Makarska Open", "Round 1"),
        _fx("Roland Garros", "Final"),
    ]
    kept, report = filter_main_tour(fixtures, denylist=DENY)
    assert [f["tournament"] for f in kept] == ["Libéma Open", "Roland Garros"]
    assert report["qualifying"] == 1
    assert report["minor"] == 1
    assert report["dropped_tournaments"] == {"Libéma Open": 1, "Makarska Open": 1}


def test_include_qualifying_flag_respected():
    fixtures = [_fx("Boss Open", "Qualifying Final")]
    kept, report = filter_main_tour(fixtures, denylist=DENY, include_qualifying=True)
    assert len(kept) == 1 and report["qualifying"] == 0
