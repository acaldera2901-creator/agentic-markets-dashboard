"""
Tests for core/surfacing_gate.surface_decision — the Wave 1 confidence floor.

Contract: probability-neutral. The function NEVER sees or returns a probability;
it only decides whether a row is surfaced as a directional pick (is_pick) or as a
"no clear favourite" row (below_threshold), keyed on the picked-outcome confidence
(whole percent) and the per-sport/competition floor in config.settings.

Boundaries (floors are inclusive — >= floor is a pick):
  * football WC / club:  55 -> below, 56 -> pick
  * friendlies:          60 -> below, 61 -> pick
  * tennis:              floor 60 (10y-lab correction; was "no floor" small-sample)
"""
import pytest

from config.settings import settings
from core.surfacing_gate import surface_decision


def test_wc_boundary_55_below_56_pick():
    assert surface_decision(sport="football", friendly=False, confidence=55) == (False, True)
    assert surface_decision(sport="football", friendly=False, confidence=56) == (True, False)


def test_wc_well_below_and_well_above():
    assert surface_decision(sport="football", friendly=False, confidence=40) == (False, True)
    assert surface_decision(sport="football", friendly=False, confidence=80) == (True, False)


def test_club_uses_same_football_floor_55_56():
    # Club football shares SURFACE_FLOOR_FOOTBALL (friendly=False, non-WC).
    assert surface_decision(sport="football", friendly=False, confidence=55) == (False, True)
    assert surface_decision(sport="football", friendly=False, confidence=56) == (True, False)


def test_friendly_boundary_60_below_61_pick():
    assert surface_decision(sport="football", friendly=True, confidence=60) == (False, True)
    assert surface_decision(sport="football", friendly=True, confidence=61) == (True, False)


def test_friendly_floor_is_stricter_than_competitive():
    # A 58% confidence is a pick competitively but below the friendly floor.
    assert surface_decision(sport="football", friendly=False, confidence=58) == (True, False)
    assert surface_decision(sport="football", friendly=True, confidence=58) == (False, True)


def test_tennis_floor_60():
    # 10y lab 2026-06-08 correction: tennis confidence IS monotone -> floor 60.
    assert surface_decision(sport="tennis", friendly=False, confidence=59) == (False, True)
    assert surface_decision(sport="tennis", friendly=False, confidence=60) == (True, False)
    assert surface_decision(sport="tennis", friendly=False, confidence=72) == (True, False)


def test_tennis_friendly_flag_is_ignored():
    # friendly flag never applies to tennis; the tennis floor governs either way.
    assert surface_decision(sport="tennis", friendly=True, confidence=10) == (False, True)
    assert surface_decision(sport="tennis", friendly=True, confidence=80) == (True, False)


def test_floors_read_from_settings_not_hardcoded(monkeypatch):
    # Single-source-of-truth: moving the floor in settings must move the boundary.
    monkeypatch.setattr(settings, "SURFACE_FLOOR_FOOTBALL", 70)
    assert surface_decision(sport="football", friendly=False, confidence=69) == (False, True)
    assert surface_decision(sport="football", friendly=False, confidence=70) == (True, False)


def test_sport_is_case_insensitive():
    assert surface_decision(sport="FOOTBALL", friendly=False, confidence=56) == (True, False)
    assert surface_decision(sport="Tennis", friendly=False, confidence=10) == (False, True)
    assert surface_decision(sport="Tennis", friendly=False, confidence=60) == (True, False)


def test_unknown_sport_defaults_to_football_floor():
    # Fail-safe: an unrecognised sport applies the football floor rather than
    # silently surfacing a low-confidence pick.
    assert surface_decision(sport="basketball", friendly=False, confidence=55) == (False, True)
    assert surface_decision(sport="basketball", friendly=False, confidence=56) == (True, False)
