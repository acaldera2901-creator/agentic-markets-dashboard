"""Regression tests for two agent-resilience fixes (lane lab, 2026-06-18):

1. BaseAgent.run() must restart _main_loop after a transient crash instead of
   dying silently (a Redis blip used to kill the agent for good).
2. AnalystAgent._assess() must FAIL CLOSED when the LLM gate is unreachable —
   degrade to the rule-based edge check, never auto-return valid=True.
"""
import asyncio
import sys
import types

import pytest

from agents.base import BaseAgent
from agents.analyst import AnalystAgent
from config.settings import settings


# ---------------------------------------------------------------------------
# 1. Restart supervisor
# ---------------------------------------------------------------------------
class _NoHeartbeatAgent(BaseAgent):
    """Isolates the restart logic from redis/supabase by stubbing heartbeat."""
    RESTART_BACKOFF_MIN = 0.0
    RESTART_BACKOFF_MAX = 0.0

    async def _heartbeat_loop(self) -> None:
        try:
            while True:
                await asyncio.sleep(3600)
        except asyncio.CancelledError:
            pass


class _FlakyAgent(_NoHeartbeatAgent):
    def __init__(self):
        super().__init__("FlakyAgent")
        self.calls = 0

    async def _main_loop(self) -> None:
        self.calls += 1
        if self.calls < 3:
            raise RuntimeError("transient redis blip")
        self._running = False  # third attempt succeeds → stop cleanly


class _CrashDuringShutdownAgent(_NoHeartbeatAgent):
    def __init__(self):
        super().__init__("ShutdownAgent")
        self.calls = 0

    async def _main_loop(self) -> None:
        self.calls += 1
        self._running = False
        raise RuntimeError("crash while already stopping")


def test_main_loop_restarts_on_transient_failure():
    agent = _FlakyAgent()
    asyncio.run(agent.run())
    # 2 crashes restarted, 3rd run returned cleanly
    assert agent.calls == 3


def test_no_restart_when_already_stopped():
    agent = _CrashDuringShutdownAgent()
    asyncio.run(agent.run())
    # crash after stop() must not trigger a restart
    assert agent.calls == 1


# ---------------------------------------------------------------------------
# 2. Analyst LLM gate fail-closed
# ---------------------------------------------------------------------------
@pytest.fixture
def _llm_down(monkeypatch):
    # Real-looking key so _assess takes the LLM path (not the no-key fallback)…
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-realkeyabc123")
    # …but the LLM call blows up.
    fake = types.ModuleType("core.claude_client")

    async def _boom(*_a, **_k):
        raise RuntimeError("anthropic api down")

    fake.ask = _boom
    monkeypatch.setitem(sys.modules, "core.claude_client", fake)


_DATA = {
    "home_team": "A", "away_team": "B", "league": "L", "kickoff": "",
    "p_home": "0.5", "p_draw": "0.3", "p_away": "0.2",
}
_ODDS = {"home": 2.0, "draw": 3.0, "away": 4.0}


def test_analyst_fail_closed_rejects_thin_edge(_llm_down):
    agent = AnalystAgent()
    result = asyncio.run(agent._assess(_DATA, _ODDS, "home", 0.001))
    # Old behaviour returned {"valid": True} unconditionally — must be False now.
    assert result["valid"] is False


def test_analyst_fail_closed_accepts_real_edge(_llm_down):
    agent = AnalystAgent()
    result = asyncio.run(agent._assess(_DATA, _ODDS, "home", settings.MIN_EDGE + 0.05))
    assert result["valid"] is True
