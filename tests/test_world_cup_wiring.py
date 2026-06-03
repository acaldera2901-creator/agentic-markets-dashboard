"""
Wiring tests for the World Cup gates inside the live agents.

These test the pure helpers extracted for the live wiring (no redis, no network):
  - data_collector: per-team last-kickoff registry from the /events feed
  - model: the WC result-enrichment path reaches paper_only without a DC model
"""
from __future__ import annotations

from datetime import datetime, timezone

from agents.data_collector import build_team_prev_kickoff_registry
from agents.model import ModelAgent
from core.world_cup_history import canonical_team_name, load_national_history


def _fx(match_id: str, home: str, away: str, kickoff_iso: str, city: str) -> dict:
    return {
        "fixture": {"id": match_id, "date": kickoff_iso, "venue": {"name": f"{city} Stadium", "city": city}},
        "teams": {"home": {"name": home}, "away": {"name": away}},
        "league": {"round": "Group Stage - Matchday 1"},
    }


def test_prev_kickoff_registry_is_per_team_and_real_not_stub():
    # Mexico plays twice; its 2nd match must see the 1st as prev_kickoff (real feed).
    fixtures = [
        _fx("m1", "Mexico", "South Africa", "2026-06-11T19:00:00+00:00", "Mexico City"),
        _fx("m2", "Canada", "Bosnia and Herzegovina", "2026-06-12T18:00:00+00:00", "Toronto"),
        _fx("m3", "Mexico", "Canada", "2026-06-17T19:00:00+00:00", "Guadalajara"),
    ]
    reg = build_team_prev_kickoff_registry(fixtures)

    # First match of each team -> no previous kickoff.
    assert reg["m1"]["team_a_prev_kickoff"] is None
    assert reg["m1"]["team_b_prev_kickoff"] is None
    # Mexico's 2nd match: prev is m1's kickoff (real per-team registry, not a 4d stub).
    assert reg["m3"]["team_a_prev_kickoff"] == datetime(2026, 6, 11, 19, 0, tzinfo=timezone.utc)
    # Canada's 2nd match: prev is m2's kickoff.
    assert reg["m3"]["team_b_prev_kickoff"] == datetime(2026, 6, 12, 18, 0, tzinfo=timezone.utc)


def test_registry_handles_unparseable_kickoff_without_crashing():
    fixtures = [_fx("x1", "Mexico", "Canada", "not-a-date", "Mexico City")]
    reg = build_team_prev_kickoff_registry(fixtures)
    assert reg["x1"]["team_a_prev_kickoff"] is None
    assert reg["x1"]["team_b_prev_kickoff"] is None


def test_model_wc_path_reaches_paper_only_without_dc_model():
    agent = ModelAgent()
    agent._history["WC"] = load_national_history()

    payload = {
        "match_id": "wc-mex-rsa",
        "provider_event_id": "wc-mex-rsa",
        "provider_source": "api-football",
        "league": "WC",
        "home_team": "Mexico",
        "away_team": "South Africa",
        "kickoff": "2026-06-11T19:00:00+00:00",
        "odds": {
            "odds_home": 2.10,
            "odds_draw": 3.30,
            "odds_away": 3.60,
            "bookmaker": "Pinnacle",
            "source": "football-data.co.uk",
        },
        "world_cup_context": {
            "stage": "group",
            "data_completeness_score": 1.0,
            "missing_context_fields": [],
            "neutral_venue": False,
            "host_advantage_team": "Mexico",
        },
    }

    result = agent._build_world_cup_result(payload)

    assert result["world_cup_publication_tier"] == "paper_only"
    assert float(result["world_cup_data_quality_score"]) >= 0.71
    # National matchup must be populated via canonical names (RSA -> South Africa already canonical).
    assert float(result["world_cup_national_model_quality"]) >= 0.75


def test_model_wc_path_uses_canonical_team_names():
    agent = ModelAgent()
    agent._history["WC"] = load_national_history()
    payload = {
        "match_id": "wc-usa-par",
        "league": "WC",
        "home_team": "USA",                 # alias -> United States
        "away_team": "Paraguay",
        "kickoff": "2026-06-12T21:00:00+00:00",
        "odds": {"odds_home": 1.8, "odds_draw": 3.4, "odds_away": 4.5, "bookmaker": "X", "source": "y"},
        "world_cup_context": {"stage": "group", "data_completeness_score": 1.0, "missing_context_fields": []},
    }
    assert canonical_team_name("USA") == "United States"
    result = agent._build_world_cup_result(payload)
    assert float(result["world_cup_national_model_quality"]) >= 0.75
