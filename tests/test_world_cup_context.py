from core.world_cup_context import build_world_cup_context


def test_world_cup_context_blocks_publication_when_fixture_context_is_incomplete():
    context = build_world_cup_context(
        fixture={
            "league": {"round": "Group A - Matchday 1"},
            "fixture": {"venue": {"name": "Estadio Azteca", "city": "Mexico City"}},
        },
        team_a="Mexico",
        team_b="Canada",
    )

    assert context["is_world_cup"] is True
    assert context["stage"] == "group"
    assert context["group_name"] == "A"
    assert context["matchday_in_group"] == 1
    assert context["host_advantage_team"] == "Mexico"
    assert context["publication_status"] == "monitor_only"
    assert "rest_days_team_a" in context["missing_context_fields"]


def test_world_cup_context_reaches_completeness_with_venue_fields():
    context = build_world_cup_context(
        fixture={
            "league": {"round": "Group A - Matchday 1"},
            "fixture": {"venue": {"name": "Estadio Azteca", "city": "Mexico City"}},
        },
        team_a="Mexico",
        team_b="South Africa",
        venue_fields={
            "rest_days_team_a": 4,
            "rest_days_team_b": 5,
            "travel_distance_km_team_a": 20,
            "travel_distance_km_team_b": 14500,
            "timezone_shift_team_a": 0,
            "timezone_shift_team_b": 8,
        },
    )

    assert context["data_completeness_score"] >= 0.78
    assert context["publication_status"] == "context_ready"
    assert context["missing_context_fields"] == []
    assert context["rest_days_team_a"] == 4
    assert context["travel_distance_km_team_b"] == 14500
