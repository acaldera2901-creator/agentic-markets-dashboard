from datetime import date

from core.world_cup_history import (
    canonical_team_name,
    load_national_history,
    WC2026_TEAMS,
)
from core.world_cup_team_model import build_profile, matchup_profile


def test_canonical_name_maps_api_aliases_to_dataset_names():
    assert canonical_team_name("USA") == "United States"
    assert canonical_team_name("Bosnia & Herzegovina") == "Bosnia and Herzegovina"
    assert canonical_team_name("Türkiye") == "Turkey"
    assert canonical_team_name("Korea Republic") == "South Korea"
    # idempotent / passthrough for already-canonical names
    assert canonical_team_name("Brazil") == "Brazil"
    assert canonical_team_name("  brazil ") == "Brazil"


def test_load_national_history_returns_matchup_rows():
    matches = load_national_history()
    assert isinstance(matches, list)
    assert len(matches) > 1000
    sample = matches[0]
    assert set(sample.keys()) >= {"home_team", "away_team", "home_goals", "away_goals", "date"}
    assert isinstance(sample["home_goals"], int)
    assert isinstance(sample["away_goals"], int)


def test_first_eight_fixture_teams_reach_signal_quality():
    matches = load_national_history()
    first_eight = [
        ("Mexico", "South Africa"),
        ("South Korea", "Czech Republic"),
        ("Canada", "Bosnia and Herzegovina"),
        ("United States", "Paraguay"),
        ("Qatar", "Switzerland"),
        ("Brazil", "Morocco"),
        ("Haiti", "Scotland"),
        ("Australia", "Turkey"),
    ]
    for home, away in first_eight:
        result = matchup_profile(matches, home, away)
        assert result["blocked_reason"] is None, (home, away, result["blocked_reason"])
        assert result["data_quality"] >= 0.75, (home, away, result["data_quality"])


def test_at_least_30_of_32_teams_reach_signal_quality():
    matches = load_national_history()
    qualified = 0
    for team in WC2026_TEAMS:
        profile = build_profile(matches, canonical_team_name(team))
        if profile and profile.data_quality >= 0.75:
            qualified += 1
    assert qualified >= 30, f"only {qualified}/{len(WC2026_TEAMS)} teams at signal quality"


def test_history_respects_recency_cutoff():
    matches = load_national_history(since="2018-01-01")
    for m in matches:
        assert m["date"] >= date(2018, 1, 1)
