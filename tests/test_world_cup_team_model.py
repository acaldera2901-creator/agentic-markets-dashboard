from core.world_cup_team_model import matchup_profile


def _match(home_team, away_team, home_goals, away_goals):
    return {
        "home_team": home_team,
        "away_team": away_team,
        "home_goals": home_goals,
        "away_goals": away_goals,
    }


def test_matchup_profile_blocks_when_a_national_team_has_no_history():
    result = matchup_profile(
        matches=[
            _match("Brazil", "Argentina", 2, 1),
            _match("Brazil", "Uruguay", 1, 1),
        ],
        team_a="Brazil",
        team_b="France",
    )

    assert result["team_a_profile"] is not None
    assert result["team_b_profile"] is None
    assert result["data_quality"] == 0.0
    assert result["blocked_reason"] == "missing national-team profile: France"


def test_matchup_profile_allows_review_when_both_teams_have_enough_history():
    matches = []
    for _ in range(20):
        matches.append(_match("Brazil", "Chile", 2, 0))
        matches.append(_match("France", "Germany", 1, 1))

    result = matchup_profile(matches, team_a="Brazil", team_b="France")

    assert result["team_a_profile"]["matches"] == 20
    assert result["team_b_profile"]["matches"] == 20
    assert result["data_quality"] == 1.0
    assert result["blocked_reason"] is None
    assert result["strength_delta"] > 0
