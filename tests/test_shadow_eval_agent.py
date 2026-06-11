"""Tests for ShadowEvalAgent gating + fail-soft (#SPORTSBOOK-SHADOW-1)."""
from unittest.mock import AsyncMock

import pytest

from agents.shadow_eval_agent import ShadowEvalAgent
from config.settings import settings


@pytest.mark.asyncio
async def test_cycle_noop_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "SHADOW_EVAL_ENABLED", False)
    agent = ShadowEvalAgent()
    assert await agent.cycle_once() == (0, 0)


@pytest.mark.asyncio
async def test_cycle_calls_collect_and_settle(monkeypatch):
    monkeypatch.setattr(settings, "SHADOW_EVAL_ENABLED", True)
    monkeypatch.setattr("core.shadow_collector.collect_once", AsyncMock(return_value=5))
    monkeypatch.setattr("core.shadow_settlement.settle_once", AsyncMock(return_value=2))
    agent = ShadowEvalAgent()
    assert await agent.cycle_once() == (5, 2)


@pytest.mark.asyncio
async def test_cycle_failsoft_on_collect_error(monkeypatch):
    monkeypatch.setattr(settings, "SHADOW_EVAL_ENABLED", True)
    monkeypatch.setattr("core.shadow_collector.collect_once",
                        AsyncMock(side_effect=RuntimeError("boom")))
    monkeypatch.setattr("core.shadow_settlement.settle_once", AsyncMock(return_value=0))
    agent = ShadowEvalAgent()
    # must not raise — a shadow crash never breaks the always-on loop
    assert await agent.cycle_once() == (0, 0)
