"""
Tests for the tennis → public history bridge:

1. core/espn_tennis_client.get_completed_results — completed-only, winner first
2. agents/tennis_settlement.TennisSettlementAgent._resolve_via_espn — pair match
3. core/supabase_client.settle_unified_tennis — won/lost/void mapping
"""
import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.tennis_names import canonical_player_key


def _espn_payload():
    def ev(note, comp="Men's Singles", name="Birmingham Open"):
        return {
            "competitionType": {"text": comp},
            "notes": [{"text": note}],
            "name": name,
            "date": "2026-06-05T10:00Z",
            "id": "e1",
        }
    return {
        "sports": [{
            "leagues": [{
                "events": [
                    ev("Anna Kalinskaya bt Petra Kvitova 6-4 6-3"),       # completed
                    ev("Marta Kostyuk leads Elise Mertens 7-6"),           # live → skip
                    ev("A & B bt C & D 6-1 6-1", comp="Men's Doubles"),    # doubles → skip
                ]
            }]
        }]
    }


@pytest.mark.asyncio
async def test_get_completed_results_winner_first_completed_only():
    from core import espn_tennis_client as etc
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = _espn_payload()
    client = AsyncMock()
    client.get.return_value = resp
    with patch.object(etc.httpx, "AsyncClient") as mk:
        mk.return_value.__aenter__.return_value = client
        out = await etc.get_completed_results()
    assert len(out) == 1
    assert out[0]["winner_name"] == "Anna Kalinskaya"
    assert out[0]["winner_key"] == canonical_player_key("Anna Kalinskaya")
    assert out[0]["loser_key"] == canonical_player_key("Petra Kvitova")


def _agent():
    from agents.tennis_settlement import TennisSettlementAgent
    a = TennisSettlementAgent.__new__(TennisSettlementAgent)
    a.logger = logging.getLogger("test")
    return a


@pytest.mark.asyncio
async def test_resolve_via_espn_matches_pair_either_order():
    agent = _agent()
    results = [{
        "winner_key": canonical_player_key("Anna Kalinskaya"),
        "loser_key": canonical_player_key("Petra Kvitova"),
        "winner_name": "Anna Kalinskaya", "loser_name": "Petra Kvitova",
        "tournament": "Birmingham",
    }]
    # prediction has the players in the OPPOSITE order vs the result
    pred = SimpleNamespace(player1="Petra Kvitova", player2="Anna Kalinskaya")
    with patch("agents.tennis_settlement.get_completed_results",
               new=AsyncMock(return_value=results)):
        resolved = await agent._resolve_via_espn([pred])
    assert len(resolved) == 1
    assert resolved[0][1] == "P2"  # winner is player2 of the prediction


@pytest.mark.asyncio
async def test_resolve_via_espn_no_match_returns_empty():
    agent = _agent()
    pred = SimpleNamespace(player1="Carlos Alcaraz", player2="Jannik Sinner")
    with patch("agents.tennis_settlement.get_completed_results",
               new=AsyncMock(return_value=[])):
        assert await agent._resolve_via_espn([pred]) == []


def _lookup_resp(rows):
    r = MagicMock()
    r.status_code = 200
    r.json.return_value = rows
    return r


@pytest.mark.asyncio
@pytest.mark.parametrize("pick,winner,void,unresolved,expected", [
    ("Anna Kalinskaya", "Anna Kalinskaya", False, False, "won"),
    ("Petra Kvitova", "Anna Kalinskaya", False, False, "lost"),
    ("Anna Kalinskaya", None, True, False, "void"),
    # #TENNIS-VOID-FIX-1: aged-out rows must map to 'unresolved', and the flag
    # takes precedence even when a winner+pick are present (never a real void).
    ("Anna Kalinskaya", None, False, True, "unresolved"),
    ("Anna Kalinskaya", "Anna Kalinskaya", False, True, "unresolved"),
])
async def test_settle_unified_tennis_result_mapping(pick, winner, void, unresolved, expected):
    from core import supabase_client as sc
    client = AsyncMock()
    client.get.return_value = _lookup_resp([{"id": "row-1", "pick": pick}])
    settle = AsyncMock(return_value=True)
    with patch.object(sc.httpx, "AsyncClient") as mk, \
         patch.object(sc, "settle_unified_prediction", new=settle), \
         patch.object(sc.settings, "SUPABASE_URL", "https://x.supabase.co"), \
         patch.object(sc.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"):
        mk.return_value.__aenter__.return_value = client
        ok = await sc.settle_unified_tennis(
            "tennis:espn:e1:k", winner, void=void, unresolved=unresolved
        )
    assert ok is True
    settle.assert_awaited_once_with("row-1", expected, final_score=None)


@pytest.mark.asyncio
async def test_settle_recent_applies_elo_once_per_physical_match():
    """#ELO-FIX-1: the same physical match arriving as N duplicate prediction
    rows must move the Elo rating exactly ONCE, not N times."""
    from agents import tennis_settlement as ts
    from models.elo_surface import EloSurfaceModel

    agent = _agent()
    agent._elo = EloSurfaceModel()
    # Three duplicate rows for the SAME match (the pre-fix table had up to 399).
    preds = [
        SimpleNamespace(
            id=i, match_id="tennis:espn:e9:k", player1="Carlos Alcaraz",
            player2="Jannik Sinner", surface="clay",
        )
        for i in range(3)
    ]
    resolved = [(p, "P1", "6-4 6-3") for p in preds]

    update_spy = MagicMock(wraps=agent._elo.update)
    agent._elo.update = update_spy

    with patch.object(ts, "AsyncSessionLocal", _NoopSession), \
         patch.object(agent._elo, "load_from_db_async", new=AsyncMock()), \
         patch.object(agent._elo, "save_to_db_async", new=AsyncMock()), \
         patch.object(ts, "settle_unified_tennis", new=AsyncMock(return_value=True)), \
         patch.object(agent, "_resolve_via_matchbook", new=AsyncMock(return_value=[])), \
         patch.object(agent, "_resolve_via_espn", new=AsyncMock(return_value=resolved)), \
         patch.object(agent, "_select_pending", new=AsyncMock(return_value=preds)), \
         patch.object(agent, "_update_prediction", new=AsyncMock()), \
         patch.object(agent, "_settle_bets", new=AsyncMock()):
        await agent._settle_recent()

    assert update_spy.call_count == 1, (
        f"Elo update ran {update_spy.call_count}x for one physical match "
        "(must be idempotent — this is the #ELO-FIX-1 bug)"
    )


class _NoopSession:
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False


@pytest.mark.asyncio
async def test_settle_unified_tennis_missing_row_is_false_not_error():
    from core import supabase_client as sc
    client = AsyncMock()
    client.get.return_value = _lookup_resp([])  # row never passed the gate
    with patch.object(sc.httpx, "AsyncClient") as mk, \
         patch.object(sc.settings, "SUPABASE_URL", "https://x.supabase.co"), \
         patch.object(sc.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"):
        mk.return_value.__aenter__.return_value = client
        assert await sc.settle_unified_tennis("missing", "X") is False
