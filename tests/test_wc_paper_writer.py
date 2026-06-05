"""
Tests for the World Cup paper pipeline (#013):

1. core/world_cup_probability.py — national Poisson rates 1X2 model
2. core/supabase_client.wc_prediction_to_unified_row — WC paper row mapping
3. agents/model.ModelAgent — real gate flags propagated from the payload
   (replacing the old hard-coded False) and the paper writer gating.
"""
import json
from unittest.mock import AsyncMock, patch

import pytest

from config.settings import settings
from core.supabase_client import DCPrediction, wc_prediction_to_unified_row
from core.world_cup_probability import national_match_probabilities


def _history(n_strong=20, n_weak=20) -> list[dict]:
    """Synthetic national history: Strongland beats everyone, Weakistan loses."""
    rows = []
    for i in range(n_strong):
        rows.append({
            "home_team": "Strongland", "away_team": f"Filler{i}",
            "home_goals": 3, "away_goals": 0,
        })
    for i in range(n_weak):
        rows.append({
            "home_team": f"Filler{i}", "away_team": "Weakistan",
            "home_goals": 2, "away_goals": 0,
        })
    return rows


# ─── Probability model ────────────────────────────────────────────────────────

def test_probabilities_sum_to_one_and_favor_stronger_team():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    assert probs is not None
    total = probs["p_team_a"] + probs["p_draw"] + probs["p_team_b"]
    assert abs(total - 1.0) < 0.001
    assert probs["p_team_a"] > probs["p_team_b"]
    assert probs["model"] == "wc-poisson-rates-v1"


def test_missing_profile_returns_none():
    assert national_match_probabilities(_history(), "Strongland", "Atlantis") is None
    assert national_match_probabilities([], "A", "B") is None


def test_match_counts_and_quality_reported():
    probs = national_match_probabilities(_history(), "Strongland", "Weakistan")
    assert probs["team_a_matches"] == 20
    assert probs["team_b_matches"] == 20
    assert 0 < probs["data_quality"] <= 1


# ─── WC row mapping ───────────────────────────────────────────────────────────

def _wc_pred(**overrides) -> DCPrediction:
    base = dict(
        match_id="537342",
        league="WC",
        league_name="FIFA World Cup 2026",
        home_team="Mexico",
        away_team="South Africa",
        kickoff="2026-06-11T19:00:00+00:00",
        p_home=0.50,
        p_draw=0.27,
        p_away=0.23,
        home_team_matches=25,
        away_team_matches=22,
    )
    base.update(overrides)
    return DCPrediction(**base)


def test_wc_row_is_always_paper_never_signal():
    # Even with a reliable sample the WC row must stay paper (FORCE PAPER rule).
    row = wc_prediction_to_unified_row(_wc_pred())
    assert row["signal_type"] == "paper"
    assert row["is_paper"] is True
    assert row["is_demo"] is False


def test_wc_row_honesty_no_odds_no_edge():
    row = wc_prediction_to_unified_row(_wc_pred())
    assert row["odds"] is None
    assert row["edge_percent"] is None
    assert row["bookmaker"] == "no market"


def test_wc_row_distinct_dedup_namespace():
    row = wc_prediction_to_unified_row(_wc_pred())
    assert row["model_version"] == settings.WC_MODEL_VERSION == "football-worldcup-v1"
    assert row["source_table"] == settings.WC_SOURCE_TABLE == "wc_model"
    assert row["source_table"] not in (settings.DC_SOURCE_TABLE, settings.XG_SOURCE_TABLE)


def test_wc_row_competition_stage_and_venue():
    row = wc_prediction_to_unified_row(_wc_pred(), stage="group", neutral_venue=True)
    assert row["competition"] == "World Cup"
    assert row["world_cup_stage"] == "group"
    assert row["neutral_venue"] is True


# ─── ModelAgent flag propagation + writer gating ─────────────────────────────

def _model_agent():
    from agents.model import ModelAgent
    agent = ModelAgent.__new__(ModelAgent)  # skip __init__ network side effects
    agent._history = {"WC": _history()}
    agent.set_status_detail = lambda *a, **k: None
    import logging
    agent.logger = logging.getLogger("test")
    return agent


def _wc_payload(**overrides) -> dict:
    base = dict(
        match_id="537342",
        league="WC",
        home_team="Strongland",
        away_team="Weakistan",
        kickoff="2026-06-11T19:00:00+00:00",
        world_cup_context={"stage": "group", "neutral_venue": True,
                           "data_completeness_score": 0.9},
        provider_event_id="537342",
        provider_source="api-football",
    )
    base.update(overrides)
    return base


def test_flags_propagate_from_payload_not_hardcoded():
    agent = _model_agent()
    payload = _wc_payload(squad_news_ready=True, settlement_ready=True)
    result = agent._build_world_cup_result(payload)
    quality = json.loads(result["world_cup_data_quality"])
    assert "squad_news_not_connected" not in quality["blocked_reasons"]
    assert "settlement_not_ready" not in quality["blocked_reasons"]


def test_flags_fail_closed_when_missing():
    agent = _model_agent()
    result = agent._build_world_cup_result(_wc_payload())  # no flag keys
    quality = json.loads(result["world_cup_data_quality"])
    assert "squad_news_not_connected" in quality["blocked_reasons"]
    assert "settlement_not_ready" in quality["blocked_reasons"]


def test_result_carries_probabilities():
    agent = _model_agent()
    result = agent._build_world_cup_result(_wc_payload())
    probs = json.loads(result["world_cup_probabilities"])
    assert probs and abs(probs["p_team_a"] + probs["p_draw"] + probs["p_team_b"] - 1.0) < 0.001


@pytest.mark.asyncio
async def test_writer_skipped_on_monitor_only():
    agent = _model_agent()
    wc_result = {
        "world_cup_publication_tier": "monitor_only",
        "world_cup_probabilities": json.dumps({"p_team_a": 0.5, "p_draw": 0.3, "p_team_b": 0.2}),
    }
    with patch("agents.model.upsert_unified_rows", new=AsyncMock()) as up:
        await agent._persist_world_cup_paper(_wc_payload(), wc_result)
        up.assert_not_awaited()


@pytest.mark.asyncio
async def test_writer_skipped_without_probabilities():
    agent = _model_agent()
    wc_result = {
        "world_cup_publication_tier": "paper_only",
        "world_cup_probabilities": "{}",
    }
    with patch("agents.model.upsert_unified_rows", new=AsyncMock()) as up:
        await agent._persist_world_cup_paper(_wc_payload(), wc_result)
        up.assert_not_awaited()


@pytest.mark.asyncio
async def test_writer_writes_paper_row_on_paper_only():
    agent = _model_agent()
    wc_result = {
        "world_cup_publication_tier": "paper_only",
        "world_cup_stage": "group",
        "neutral_venue": "True",
        "world_cup_probabilities": json.dumps({
            "p_team_a": 0.55, "p_draw": 0.25, "p_team_b": 0.20,
            "team_a_matches": 25, "team_b_matches": 22,
        }),
    }
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)) as up:
        await agent._persist_world_cup_paper(_wc_payload(), wc_result)
        up.assert_awaited_once()
        row = up.await_args.args[0][0]
        assert row["signal_type"] == "paper"
        assert row["source_table"] == settings.WC_SOURCE_TABLE
        assert row["pick"] == "HOME"
        assert row["world_cup_stage"] == "group"


# ─── upsert_unified_rows (PATCH-then-POST against the partial unique index) ──

def _resp(status: int, body=None):
    from unittest.mock import MagicMock
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body if body is not None else []
    r.text = json.dumps(body or {})
    return r


@pytest.mark.asyncio
async def test_upsert_updates_existing_row_via_patch():
    from core import supabase_client as sc
    row = {"source_table": "wc_model", "source_id": "1", "pick": "HOME"}
    client = AsyncMock()
    client.patch.return_value = _resp(200, [row])  # PATCH matched a row
    with patch.object(sc.httpx, "AsyncClient") as mk, \
         patch.object(sc.settings, "SUPABASE_URL", "https://x.supabase.co"), \
         patch.object(sc.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"):
        mk.return_value.__aenter__.return_value = client
        assert await sc.upsert_unified_rows([row]) == 1
        client.post.assert_not_awaited()


@pytest.mark.asyncio
async def test_upsert_inserts_when_patch_matches_nothing():
    from core import supabase_client as sc
    row = {"source_table": "wc_model", "source_id": "1", "pick": "HOME"}
    client = AsyncMock()
    client.patch.return_value = _resp(200, [])   # no existing row
    client.post.return_value = _resp(201)
    with patch.object(sc.httpx, "AsyncClient") as mk, \
         patch.object(sc.settings, "SUPABASE_URL", "https://x.supabase.co"), \
         patch.object(sc.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"):
        mk.return_value.__aenter__.return_value = client
        assert await sc.upsert_unified_rows([row]) == 1
        client.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_upsert_skips_rows_without_dedup_key():
    from core import supabase_client as sc
    client = AsyncMock()
    with patch.object(sc.httpx, "AsyncClient") as mk, \
         patch.object(sc.settings, "SUPABASE_URL", "https://x.supabase.co"), \
         patch.object(sc.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"):
        mk.return_value.__aenter__.return_value = client
        assert await sc.upsert_unified_rows([{"pick": "HOME"}]) == 0
        client.patch.assert_not_awaited()
        client.post.assert_not_awaited()


@pytest.mark.asyncio
async def test_writer_failure_is_non_fatal():
    agent = _model_agent()
    wc_result = {
        "world_cup_publication_tier": "paper_only",
        "world_cup_stage": "group",
        "neutral_venue": "True",
        "world_cup_probabilities": json.dumps({
            "p_team_a": 0.55, "p_draw": 0.25, "p_team_b": 0.20,
            "team_a_matches": 25, "team_b_matches": 22,
        }),
    }
    boom = AsyncMock(side_effect=RuntimeError("postgrest down"))
    with patch("agents.model.upsert_unified_rows", new=boom):
        # must not raise
        await agent._persist_world_cup_paper(_wc_payload(), wc_result)
