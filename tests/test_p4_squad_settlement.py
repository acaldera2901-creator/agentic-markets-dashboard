# tests/test_p4_squad_settlement.py
"""P4 regression tests (2026-06-05): squad_news gate (ESPN), settlement wiring
of unified_predictions, and the registry readiness shape both gates ride on."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.world_cup_registry import REGISTRY, build_cycle_detail, readiness_from_counts
from core import espn_soccer_client
from agents.result_settlement import ResultSettlementAgent, _outcome


# ─── registry: squad_news gate ─────────────────────────────────────────────────

def test_registry_declares_squad_news_gate():
    assert any(g.key == "squad_news" for g in REGISTRY.gates)


def test_readiness_squad_news_default_closed():
    r = readiness_from_counts(fixtures=104, odds_markets=10, matched_odds=5,
                              national_model_ready=True, venue_context_ready=True,
                              settlement_ready=True)
    assert r["gates"]["squad_news"] is False
    assert "squad_news" in r["missing"]
    assert r["status"] == "monitor_only"


def test_readiness_all_gates_true_is_signal_ready():
    r = readiness_from_counts(fixtures=104, odds_markets=10, matched_odds=5,
                              national_model_ready=True, venue_context_ready=True,
                              settlement_ready=True, squad_news_ready=True)
    assert r["gates"]["squad_news"] is True
    assert r["status"] == "signal_ready"


def test_cycle_detail_carries_squad_coverage_and_gate():
    detail = json.loads(build_cycle_detail(
        league_counts={"WC": {"fixtures": 104, "odds_markets": 4, "matched_odds": 2}},
        national_model_ready=True, venue_context_ready=True,
        settlement_ready=True, squad_news_ready=True,
        squad_coverage={"covered": 45, "teams": 48, "injured_total": 12},
    ))
    wc = detail["world_cup"]
    assert wc["readiness"]["gates"]["squad_news"] is True
    assert wc["squad_coverage"] == {"covered": 45, "teams": 48, "injured_total": 12}


# ─── ESPN soccer client ────────────────────────────────────────────────────────

def _resp(payload):
    r = MagicMock()
    r.status_code = 200
    r.json.return_value = payload
    return r


def _client_with(payloads):
    client = MagicMock()
    client.get = AsyncMock(side_effect=[_resp(p) for p in payloads])
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


async def test_get_team_squad_counts_injuries(monkeypatch):
    espn_soccer_client._cache.clear()
    roster = {
        "team": {"displayName": "Mexico"},
        "athletes": [
            {"displayName": "A", "position": {"abbreviation": "G"}, "injuries": []},
            {"displayName": "B", "position": {"abbreviation": "D"}, "injuries": [{"status": "Out"}]},
        ],
    }
    with patch.object(espn_soccer_client.httpx, "AsyncClient", return_value=_client_with([roster])):
        squad = await espn_soccer_client.get_team_squad("203")
    assert squad["squad_size"] == 2
    assert squad["injured"] == 1
    # cached: second call must not hit the network
    with patch.object(espn_soccer_client.httpx, "AsyncClient") as nc:
        squad2 = await espn_soccer_client.get_team_squad("203")
    nc.assert_not_called()
    assert squad2 == squad
    espn_soccer_client._cache.clear()


async def test_get_world_cup_teams_parses_list(monkeypatch):
    espn_soccer_client._cache.clear()
    payload = {"sports": [{"leagues": [{"teams": [
        {"team": {"id": 202, "displayName": "Argentina"}},
        {"team": {"id": 203, "displayName": "Mexico"}},
    ]}]}]}
    with patch.object(espn_soccer_client.httpx, "AsyncClient", return_value=_client_with([payload])):
        teams = await espn_soccer_client.get_world_cup_teams()
    assert teams == [{"id": "202", "name": "Argentina"}, {"id": "203", "name": "Mexico"}]
    espn_soccer_client._cache.clear()


# ─── unified settlement ────────────────────────────────────────────────────────

def _agent():
    with patch.object(ResultSettlementAgent, "__init__", lambda self: None):
        agent = ResultSettlementAgent()
    agent.logger = MagicMock()
    agent.set_status_detail = MagicMock()
    return agent


async def test_unified_settlement_settles_and_flags_history():
    agent = _agent()
    rows = [{
        "id": "u-1", "external_event_id": "12345", "sport": "football",
        "league": "WC", "competition": "World Cup", "home_team": "Mexico",
        "away_team": "South Africa", "market": "1X2", "pick": "HOME",
        "starts_at": "2026-06-11T19:00:00+00:00", "world_cup_stage": "group",
    }]
    settled_calls = []

    async def fake_settle(row_id, result):
        settled_calls.append((row_id, result))
        return True

    with patch("agents.result_settlement.fetch_unsettled_unified_predictions",
               AsyncMock(return_value=rows)), \
         patch("agents.result_settlement.get_fixture_result",
               AsyncMock(return_value={"home_goals": 2, "away_goals": 0})), \
         patch("agents.result_settlement.settle_unified_prediction", side_effect=fake_settle):
        await agent._unified_settlement_cycle()

    assert settled_calls == [("u-1", "won")]
    agent.set_status_detail.assert_called_once()
    detail = agent.set_status_detail.call_args[0][0]
    assert detail["type"] == "unified_settlement"
    assert detail["settled"] == 1


async def test_unified_settlement_unknown_market_voids():
    agent = _agent()
    rows = [{"id": "u-2", "external_event_id": "9", "market": "BTTS", "pick": "YES",
             "home_team": "A", "away_team": "B", "league": "WC",
             "starts_at": "2026-06-11T19:00:00+00:00"}]
    calls = []

    async def fake_settle(row_id, result):
        calls.append((row_id, result))
        return True

    with patch("agents.result_settlement.fetch_unsettled_unified_predictions",
               AsyncMock(return_value=rows)), \
         patch("agents.result_settlement.get_fixture_result",
               AsyncMock(return_value={"home_goals": 1, "away_goals": 1})), \
         patch("agents.result_settlement.settle_unified_prediction", side_effect=fake_settle):
        await agent._unified_settlement_cycle()

    assert calls == [("u-2", "void")]


async def test_unified_settlement_skips_unfinished_matches():
    agent = _agent()
    rows = [{"id": "u-3", "external_event_id": "7", "market": "1X2", "pick": "AWAY",
             "home_team": "A", "away_team": "B", "league": "WC",
             "starts_at": "2026-06-11T19:00:00+00:00"}]
    with patch("agents.result_settlement.fetch_unsettled_unified_predictions",
               AsyncMock(return_value=rows)), \
         patch("agents.result_settlement.get_fixture_result", AsyncMock(return_value=None)), \
         patch("agents.result_settlement.settle_unified_prediction") as settle:
        # no fdorg key in test settings → fallback skipped
        await agent._unified_settlement_cycle()
    settle.assert_not_called()
    agent.set_status_detail.assert_not_called()


def test_outcome_mapping_for_unified_picks():
    assert _outcome("home", 2, 0) == "won"
    assert _outcome("draw", 1, 1) == "won"
    assert _outcome("away", 1, 1) == "lost"
