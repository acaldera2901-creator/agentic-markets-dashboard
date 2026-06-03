from datetime import datetime, timezone

from core.world_cup_venue_context import (
    enrich_venue_context,
    haversine_km,
    venue_coords,
    team_coords,
)


def test_haversine_known_distance():
    # Mexico City -> Atlanta is ~2150 km
    d = haversine_km((19.43, -99.13), (33.75, -84.39))
    assert 2000 <= d <= 2300


def test_venue_and_team_coords_present_for_first_eight():
    for city in ["Mexico City", "Atlanta", "Dallas", "Houston", "Miami", "Toronto"]:
        assert venue_coords(city) is not None, city
    for team in ["Mexico", "Brazil", "United States", "South Korea", "Morocco", "Australia"]:
        assert team_coords(team) is not None, team


def test_enrich_returns_all_six_fields():
    fixture = {
        "team_a": "Brazil",
        "team_b": "Morocco",
        "host_city": "Dallas",
    }
    out = enrich_venue_context(
        fixture,
        team_a="Brazil",
        team_b="Morocco",
        host_city="Dallas",
        team_a_prev_kickoff=datetime(2026, 6, 8, 18, 0, tzinfo=timezone.utc),
        team_b_prev_kickoff=datetime(2026, 6, 7, 21, 0, tzinfo=timezone.utc),
        kickoff=datetime(2026, 6, 12, 19, 0, tzinfo=timezone.utc),
    )
    for key in (
        "rest_days_team_a",
        "rest_days_team_b",
        "travel_distance_km_team_a",
        "travel_distance_km_team_b",
        "timezone_shift_team_a",
        "timezone_shift_team_b",
    ):
        assert out[key] is not None, key
        assert isinstance(out[key], int), key
    assert out["rest_days_team_a"] == 4
    assert out["rest_days_team_b"] == 5
    assert out["travel_distance_km_team_a"] > 5000  # Brazil -> Dallas
    assert out["timezone_shift_team_a"] != 0


def test_enrich_first_match_has_no_rest_days_but_keeps_travel():
    # No previous kickoff -> rest_days unknown, but travel/timezone still resolvable.
    out = enrich_venue_context(
        {},
        team_a="Mexico",
        team_b="South Africa",
        host_city="Mexico City",
        team_a_prev_kickoff=None,
        team_b_prev_kickoff=None,
        kickoff=datetime(2026, 6, 11, 19, 0, tzinfo=timezone.utc),
    )
    assert out["rest_days_team_a"] is None
    assert out["travel_distance_km_team_a"] is not None
    # Host nation playing at home -> ~0 travel, 0 tz shift
    assert out["travel_distance_km_team_a"] < 600
    assert out["timezone_shift_team_a"] == 0
