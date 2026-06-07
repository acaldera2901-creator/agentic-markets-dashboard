"""Tests for the v2 Elo shadow A/B wiring in agents/model.ModelAgent.

The shadow logs the v2 candidate to prediction_log alongside the served v1
snapshot. Invariants under test: it fires for teams with frozen ratings, it
fail-softs (no row, served untouched) for unknown teams, a v2 failure never
breaks the served cycle, and the served unified row is byte-identical whether or
not the shadow runs (the shadow must NOT alter what is served).
"""
import json
import logging
from unittest.mock import AsyncMock, patch

import pytest

from config.settings import settings


def _model_agent():
    from agents.model import ModelAgent
    agent = ModelAgent.__new__(ModelAgent)
    agent.set_status_detail = lambda *a, **k: None
    agent.logger = logging.getLogger("test")
    agent._history = {"WC": []}
    agent._wc_snapshot_state = {}
    agent._wc_v2_snapshot_state = {}
    return agent


def _wc_result() -> dict:
    return {
        "world_cup_publication_tier": "paper_only",
        "world_cup_stage": "group",
        "neutral_venue": "True",
        "world_cup_probabilities": json.dumps({
            "p_team_a": 0.55, "p_draw": 0.25, "p_team_b": 0.20,
            "team_a_matches": 25, "team_b_matches": 22,
        }),
    }


def _wc_payload(home: str, away: str) -> dict:
    return dict(
        match_id="900001",
        league="WC",
        home_team=home,
        away_team=away,
        kickoff="2026-06-11T19:00:00+00:00",
        world_cup_context={"stage": "group", "neutral_venue": True,
                           "data_completeness_score": 0.9},
    )


@pytest.mark.asyncio
async def test_v2_served_with_v1_counterfactual_shadow():
    """Post-promotion contract (#ELO-V2): rated teams -> v2 is the SERVED
    model_version, the v1 Poisson counterfactual goes to shadow, and the
    v2 '-shadow' namespace is NOT used."""
    agent = _model_agent()
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)), \
         patch("agents.model.log_prediction_snapshot", new=AsyncMock()) as snap:
        await agent._persist_world_cup_paper(_wc_payload("Argentina", "Brazil"), _wc_result())

    versions = [c.kwargs["model_version"] for c in snap.await_args_list]
    assert settings.WC_ELO_V2_MODEL_VERSION in versions       # served snapshot
    assert settings.WC_V1_SHADOW_VERSION in versions          # counterfactual
    assert settings.WC_ELO_V2_SHADOW_VERSION not in versions  # v2 not shadowed when served
    shadow_call = next(c for c in snap.await_args_list
                       if c.kwargs["model_version"] == settings.WC_V1_SHADOW_VERSION)
    served = shadow_call.kwargs["served"]
    assert len(served) == 3
    assert abs(sum(served) - 1.0) < 1e-6


@pytest.mark.asyncio
async def test_serve_flag_false_restores_v1_with_v2_shadow():
    """ROLLBACK contract: WC_ELO_V2_SERVE_ENABLED=False -> served is v1
    (WC_MODEL_VERSION) and the v2 candidate goes back to shadow."""
    agent = _model_agent()
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)), \
         patch("agents.model.log_prediction_snapshot", new=AsyncMock()) as snap, \
         patch.object(settings, "WC_ELO_V2_SERVE_ENABLED", False):
        await agent._persist_world_cup_paper(_wc_payload("Argentina", "Brazil"), _wc_result())

    versions = [c.kwargs["model_version"] for c in snap.await_args_list]
    assert settings.WC_MODEL_VERSION in versions
    assert settings.WC_ELO_V2_SHADOW_VERSION in versions
    assert settings.WC_ELO_V2_MODEL_VERSION not in versions


@pytest.mark.asyncio
async def test_shadow_skipped_for_unknown_team():
    agent = _model_agent()
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)), \
         patch("agents.model.log_prediction_snapshot", new=AsyncMock()) as snap:
        await agent._persist_world_cup_paper(_wc_payload("Atlantis", "Wakanda"), _wc_result())

    versions = [c.kwargs["model_version"] for c in snap.await_args_list]
    assert settings.WC_ELO_V2_SHADOW_VERSION not in versions


@pytest.mark.asyncio
async def test_shadow_failure_is_non_fatal_and_served_still_written():
    agent = _model_agent()
    boom = AsyncMock(side_effect=RuntimeError("elo blew up"))
    up = AsyncMock(return_value=1)
    with patch("agents.model.predict_wc_elo_v2", side_effect=RuntimeError("model down")), \
         patch("agents.model.upsert_unified_rows", new=up), \
         patch("agents.model.log_prediction_snapshot", new=AsyncMock()):
        # must not raise; served upsert must still have happened
        await agent._persist_world_cup_paper(_wc_payload("Argentina", "Brazil"), _wc_result())
    up.assert_awaited_once()


def test_shadow_does_not_alter_served_row():
    """Served unified row must be byte-identical with and without the shadow."""
    import asyncio

    async def run(enabled: bool):
        agent = _model_agent()
        rows = {}

        async def capture(rs):
            rows["served"] = rs[0]
            return 1

        with patch("agents.model.upsert_unified_rows", new=capture), \
             patch("agents.model.log_prediction_snapshot", new=AsyncMock()), \
             patch.object(settings, "WC_ELO_V2_SHADOW_ENABLED", enabled):
            await agent._persist_world_cup_paper(
                _wc_payload("Argentina", "Brazil"), _wc_result()
            )
        return rows["served"]

    with_shadow = asyncio.run(run(True))
    without_shadow = asyncio.run(run(False))
    # published_at is a wall-clock stamp set per call; everything that defines
    # WHAT is served (probabilities, pick, edge, odds, flags) must be identical.
    for d in (with_shadow, without_shadow):
        d.pop("published_at", None)
    assert with_shadow == without_shadow


@pytest.mark.asyncio
async def test_shadow_insert_on_change_only():
    agent = _model_agent()
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)), \
         patch("agents.model.log_prediction_snapshot", new=AsyncMock()) as snap:
        payload = _wc_payload("Argentina", "Brazil")
        await agent._persist_world_cup_paper(payload, _wc_result())
        await agent._persist_world_cup_paper(payload, _wc_result())

    # post-promotion: the counterfactual v1 shadow is the deduped namespace
    shadow_calls = [c for c in snap.await_args_list
                    if c.kwargs["model_version"] == settings.WC_V1_SHADOW_VERSION]
    assert len(shadow_calls) == 1


@pytest.mark.asyncio
async def test_friendly_v2_uses_friendly_namespace():
    """F3: amichevole servita dal v2 -> model_version football-friendlies-v2-elo
    (namespace separato dal WC competitivo per gli audit di calibrazione)."""
    agent = _model_agent()
    payload = _wc_payload("Argentina", "Brazil")
    payload["league"] = "FRIENDLY"
    result = _wc_result()
    result["world_cup_national_model_quality"] = "0.9"
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)), \
         patch("agents.model.log_prediction_snapshot", new=AsyncMock()) as snap:
        await agent._persist_world_cup_paper(payload, result)

    versions = [c.kwargs["model_version"] for c in snap.await_args_list]
    assert settings.FRIENDLY_V2_MODEL_VERSION in versions
    assert settings.WC_ELO_V2_MODEL_VERSION not in versions
