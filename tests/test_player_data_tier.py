from core.player_data_tier import (
    LEAGUE_DATA_TIER, MIN_APPEARANCES, tier_for_league, is_eligible,
)

def test_top5_are_tier1():
    for code in ("PL", "SA", "PD", "BL1", "FL1"):
        assert LEAGUE_DATA_TIER[code]["tier"] == 1

def test_summer_leagues_are_tier2():
    for code in ("ELI", "ALL", "VEI", "LOI", "CSL"):
        assert LEAGUE_DATA_TIER[code]["tier"] == 2

def test_unknown_league_fails_closed():
    assert tier_for_league("ZZZ") == 0

def test_eligible_requires_min_appearances():
    assert is_eligible(MIN_APPEARANCES, "2026-06-19", "2026-06-20") is True
    assert is_eligible(MIN_APPEARANCES - 1, "2026-06-19", "2026-06-20") is False

def test_eligible_fails_on_stale_or_missing_date():
    assert is_eligible(10, None, "2026-06-20") is False
    assert is_eligible(10, "2026-05-01", "2026-06-20") is False  # >30 giorni
