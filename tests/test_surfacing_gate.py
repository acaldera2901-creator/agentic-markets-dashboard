"""
Tests for core/surfacing_gate.surface_decision — the Wave 1 confidence floor.

Contract: probability-neutral. The function NEVER sees or returns a probability;
it only decides whether a row is surfaced as a directional pick (is_pick) or as a
"no clear favourite" row (below_threshold), keyed on the picked-outcome confidence
(whole percent) and the per-sport/competition floor in config.settings.

Boundaries (floors are inclusive — >= floor is a pick):
  * football WC / club:  55 -> below, 56 -> pick
  * friendlies:          60 -> below, 61 -> pick
  * tennis (#TENNIS-SEG-FLOOR-1 2026-06-11, segment-aware by tournament name):
      hi tier (Slam/Masters/1000/Finals/Olympics)  61 -> below, 62 -> pick
      lower tiers                                  63 -> below, 64 -> pick
      lower tiers on grass                         65 -> below, 66 -> pick
"""
import pytest

from config.settings import settings
from core.surfacing_gate import surface_decision, tennis_floor_for


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


def test_tennis_hi_tier_floor_62():
    # #FLOOR-62 (APPROVE Andrea 2026-06-09) stays on the HIGH tier — held-out
    # 2023+ the hi segments hold 73-77% at 62 (#TENNIS-SEG-FLOOR-1).
    assert surface_decision(sport="tennis", friendly=False, confidence=61,
                            tournament="Wimbledon") == (False, True)
    assert surface_decision(sport="tennis", friendly=False, confidence=62,
                            tournament="Wimbledon") == (True, False)
    assert surface_decision(sport="tennis", friendly=False, confidence=62,
                            tournament="Cincinnati Open") == (True, False)


def test_tennis_lower_tier_floor_64():
    # Lower tiers (250/500/WTA minors) sat at 69-70% at 62 → floor 64.
    assert surface_decision(sport="tennis", friendly=False, confidence=63,
                            tournament="Hamburg Open") == (False, True)
    assert surface_decision(sport="tennis", friendly=False, confidence=64,
                            tournament="Hamburg Open") == (True, False)


def test_tennis_lower_tier_grass_floor_66():
    # The weakest cell (lab 2026-06-11): low-tier grass (the June swing) —
    # 69.4% at 62 vs 73.8% at 66 held-out. Wimbledon stays hi (62).
    assert surface_decision(sport="tennis", friendly=False, confidence=65,
                            tournament="Libéma Open") == (False, True)
    assert surface_decision(sport="tennis", friendly=False, confidence=66,
                            tournament="Libéma Open") == (True, False)
    assert tennis_floor_for("Terra Wortmann Open") == settings.SURFACE_FLOOR_TENNIS_LO_GRASS
    assert tennis_floor_for("Wimbledon") == settings.SURFACE_FLOOR_TENNIS


def test_tennis_unknown_tournament_fails_closed_to_lower_tier():
    # No/unknown tournament → the STRICTER lower-tier floor, never the hi one.
    assert surface_decision(sport="tennis", friendly=False, confidence=63) == (False, True)
    assert surface_decision(sport="tennis", friendly=False, confidence=64) == (True, False)
    assert tennis_floor_for(None) == settings.SURFACE_FLOOR_TENNIS_LO
    assert tennis_floor_for("Mystery Cup") == settings.SURFACE_FLOOR_TENNIS_LO


def test_tennis_friendly_flag_is_ignored():
    # friendly flag never applies to tennis; the tennis floor governs either way.
    assert surface_decision(sport="tennis", friendly=True, confidence=10,
                            tournament="Wimbledon") == (False, True)
    assert surface_decision(sport="tennis", friendly=True, confidence=80,
                            tournament="Wimbledon") == (True, False)


def test_floors_read_from_settings_not_hardcoded(monkeypatch):
    # Single-source-of-truth: moving the floor in settings must move the boundary.
    monkeypatch.setattr(settings, "SURFACE_FLOOR_FOOTBALL", 70)
    assert surface_decision(sport="football", friendly=False, confidence=69) == (False, True)
    assert surface_decision(sport="football", friendly=False, confidence=70) == (True, False)


def test_sport_is_case_insensitive():
    assert surface_decision(sport="FOOTBALL", friendly=False, confidence=56) == (True, False)
    assert surface_decision(sport="Tennis", friendly=False, confidence=10) == (False, True)
    assert surface_decision(sport="Tennis", friendly=False, confidence=62,
                            tournament="WIMBLEDON") == (True, False)


def test_unknown_sport_defaults_to_football_floor():
    # Fail-safe: an unrecognised sport applies the football floor rather than
    # silently surfacing a low-confidence pick.
    assert surface_decision(sport="basketball", friendly=False, confidence=55) == (False, True)
    assert surface_decision(sport="basketball", friendly=False, confidence=56) == (True, False)


# ── #SUMMER-LEAGUES-1 (APPROVE Andrea 2026-06-12): per-league club floors ──────

def test_club_floor_for_summer_league_overrides():
    from core.surfacing_gate import club_floor_for
    # Stricter lab floors: only Allsvenskan + League of Ireland move to 60.
    assert club_floor_for("Allsvenskan") == 60
    assert club_floor_for("League of Ireland") == 60
    # The other summer leagues hold the quality bar at the standard 56.
    assert club_floor_for("Eliteserien") == 56
    assert club_floor_for("Veikkausliiga") == 56
    assert club_floor_for("Chinese Super League") == 56
    # Existing leagues are untouched.
    assert club_floor_for("Premier League") == 56
    assert club_floor_for("Serie A") == 56
    # Fail-soft: unknown/None competition uses the standard club floor.
    assert club_floor_for(None) == 56
    assert club_floor_for("") == 56


def test_club_floor_for_is_case_insensitive():
    from core.surfacing_gate import club_floor_for
    assert club_floor_for("ALLSVENSKAN") == 60
    assert club_floor_for("league OF ireland Premier Division") == 60


def test_summer_league_registries_are_consistent():
    # The five summer-league codes must exist in every registry the collector
    # and settlement read, or a league silently gets fixtures without odds
    # (or vice versa).
    from core.espn_soccer_client import ESPN_LEAGUE_CODES
    from core.odds_api_client import SPORT_KEYS
    from core.football_api_client import LEAGUE_IDS
    for code in ("ELI", "ALL", "VEI", "LOI", "CSL"):
        assert code in ESPN_LEAGUE_CODES, f"{code} missing from ESPN_LEAGUE_CODES"
        assert code in SPORT_KEYS, f"{code} missing from SPORT_KEYS"
        assert code in LEAGUE_IDS, f"{code} missing from LEAGUE_IDS"
        assert code in settings.LEAGUES, f"{code} missing from settings.LEAGUES"
