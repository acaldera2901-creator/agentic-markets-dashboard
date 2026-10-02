"""Provenance describes the persisted pair, not the shadow Elo pair."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from config.settings import settings
from tests.test_tennis_market_anchor import _agent, _fixture


@pytest.mark.parametrize("enabled,odds,source", [
    (True, {"odds_p1": 1.95, "odds_p2": 2.10}, "market"),
    (False, {"odds_p1": 1.95, "odds_p2": 2.10}, "model"),
    (True, {}, "model"),
    (True, {"odds_p1": 1.95}, "model"),
])
def test_probability_source_matches_actual_branch_and_persisted_pair(monkeypatch, enabled, odds, source):
    monkeypatch.setattr(settings, "TENNIS_SHADOW_SERVE_ENABLED", enabled)
    agent = _agent()
    pred = agent._score_fixture(_fixture(**odds))
    assert pred["feature_snapshot"]["probability"] == {
        "version": "tennis-probability-v1", "source": source,
        "raw_p1": pred["p1"], "raw_p2": pred["p2"],
    }
    assert pred["feature_snapshot"]["source"] == "jeff_sackmann_cache"
    assert pred["model_version"] == agent.model_version
    assert "feature_snapshot" in agent._PREDICTION_COLS
    if source == "market":
        assert pred["p1"] != pred["_p1_raw"]
        assert pred["edge"] is None
    else:
        assert pred["p1"] == pred["_p1_raw"]


def test_legacy_redis_prediction_marks_model_without_changing_probability():
    pred = _agent()._predict_match({"player1": "Player A", "player2": "Player B",
                                  "odds_p1": 1.95, "odds_p2": 2.10})
    assert pred["feature_snapshot"]["probability"] == {
        "version": "tennis-probability-v1", "source": "model",
        "raw_p1": pred["p1"], "raw_p2": pred["p2"],
    }


@pytest.mark.asyncio
async def test_database_payload_keeps_provenance_and_strips_shadow_fields(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://database.invalid")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "unit-test-only")
    client = AsyncMock()
    client.post.return_value = MagicMock(status_code=201)
    context = AsyncMock()
    context.__aenter__.return_value = client
    monkeypatch.setattr("httpx.AsyncClient", MagicMock(return_value=context))
    agent = _agent()
    pred = agent._score_fixture(_fixture(odds_p1=1.95, odds_p2=2.10))
    await agent._write_predictions([pred])
    payload = client.post.call_args.kwargs["json"][0]
    assert payload["feature_snapshot"] == pred["feature_snapshot"]
    assert payload["feature_snapshot"]["probability"]["raw_p1"] == payload["p1"]
    assert payload["feature_snapshot"]["probability"]["raw_p2"] == payload["p2"]
    assert "_p1_raw" not in payload and "_blended" not in payload
