from agents.data_collector import DataCollectorAgent


class _FakeFootballFeatures:
    def match_context(self, home, away, league, kickoff):
        return {
            "home_ppg": 2.1,
            "away_ppg": 0.8,
            "home_xg_avg": 1.9,
            "away_xg_avg": 0.9,
            "home_xg_luck": 0.2,
            "away_xg_luck": -0.1,
            "feature_quality": 0.87,
            "feature_snapshot": {"league": league, "home_team": home, "away_team": away},
        }


def test_build_event_attaches_football_features_to_non_wc_fixture():
    agent = DataCollectorAgent()
    agent._football_features = _FakeFootballFeatures()
    fixture = {
        "fixture": {"id": 123, "date": "2026-06-10T19:00:00+00:00"},
        "teams": {
            "home": {"name": "Alpha"},
            "away": {"name": "Beta"},
        },
    }

    event = agent._build_event(fixture, odds_map={}, league="PL")

    assert event is not None
    assert event["home_ppg"] == 2.1
    assert event["away_xg_avg"] == 0.9
    assert event["feature_quality"] == 0.87
    assert event["feature_snapshot"]["league"] == "PL"
