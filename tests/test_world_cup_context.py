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
