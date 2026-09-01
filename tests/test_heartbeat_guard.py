"""#HEARTBEAT-GUARD-0830 — the heartbeat task must survive a Redis blip.

`BaseAgent._heartbeat_loop` is created ONCE in `run()` and never recreated, so
an exception escaping it killed the heartbeat for good: the agent then looked
dead to the MonitorAgent — which restarts the WHOLE orchestrator, not the one
agent — while it was still working. `set_heartbeat` was the only unguarded
await in the loop. Same defect already fixed in `run()` (see
test_agent_resilience.py); this is its sibling.

Invariants asserted mechanically below:
  1. a raising set_heartbeat does NOT end the loop, and later ticks still run;
  2. a failing tick still sleeps (no hot spin);
  3. the first failure is a WARNING, the repeats are NOT (no log flood);
  4. recovery is announced once, and the failure counter resets;
  5. CancelledError still propagates, so run()'s shutdown keeps working;
  6. the happy path is untouched: one write + one gather per tick.
"""
import asyncio
import logging

import pytest

import agents.base as base
from agents.base import BaseAgent
from config.settings import settings


class _Probe(BaseAgent):
    async def _main_loop(self) -> None:  # never used here
        pass


@pytest.fixture
def probe(monkeypatch):
    """A live agent whose heartbeat sinks are stubbed and whose sleep is free."""
    agent = _Probe("Probe")
    agent._running = True
    monkeypatch.setattr(settings, "HEARTBEAT_INTERVAL", 0)
    monkeypatch.setattr(settings, "DASHBOARD_URL", "")  # skip the HTTP sink

    async def _noop_upsert(*_a, **_k):
        return None

    monkeypatch.setattr(base, "upsert_heartbeat", _noop_upsert)
    return agent


@pytest.fixture
def sleeps(monkeypatch):
    """Record every asyncio.sleep the loop performs, without waiting."""
    recorded: list = []

    async def _fake_sleep(delay, *_a, **_k):
        recorded.append(delay)

    monkeypatch.setattr(asyncio, "sleep", _fake_sleep)
    return recorded


def _failing_then_ok(agent, fail_times: int, stop_after: int):
    """set_heartbeat that raises `fail_times`, then succeeds, then stops the loop."""
    calls = {"n": 0}

    async def _set(*_a, **_k):
        calls["n"] += 1
        if calls["n"] >= stop_after:
            agent._running = False
        if calls["n"] <= fail_times:
            raise RuntimeError("redis blip")

    return calls, _set


async def test_redis_blip_does_not_end_the_heartbeat(probe, sleeps, monkeypatch):
    """1 — the old body died on the first raise; ticks 4 and 5 prove it survives."""
    calls, _set = _failing_then_ok(probe, fail_times=3, stop_after=5)
    monkeypatch.setattr(base, "set_heartbeat", _set)

    await probe._heartbeat_loop()

    assert calls["n"] == 5, "the loop stopped early: the exception escaped again"


async def test_failing_tick_still_sleeps(probe, sleeps, monkeypatch):
    """2 — a failure must not turn the loop into a hot spin."""
    calls, _set = _failing_then_ok(probe, fail_times=3, stop_after=3)
    monkeypatch.setattr(base, "set_heartbeat", _set)

    await probe._heartbeat_loop()

    assert len(sleeps) == calls["n"], "a failing tick skipped the sleep"
    assert sleeps == [settings.HEARTBEAT_INTERVAL] * calls["n"]


async def test_first_failure_warns_and_the_repeats_do_not(probe, sleeps, monkeypatch, caplog):
    """3 — one WARNING for the outage, not one every HEARTBEAT_INTERVAL."""
    _calls, _set = _failing_then_ok(probe, fail_times=5, stop_after=5)
    monkeypatch.setattr(base, "set_heartbeat", _set)

    with caplog.at_level(logging.DEBUG, logger="Probe"):
        await probe._heartbeat_loop()

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    debugs = [r for r in caplog.records if r.levelno == logging.DEBUG]
    assert len(warnings) == 1, f"expected exactly 1 WARNING, got {len(warnings)}"
    assert len(debugs) == 4, "the repeats must still be recorded, at DEBUG"


async def test_recovery_is_announced_once_and_resets_the_counter(probe, sleeps, monkeypatch, caplog):
    """4 — coming back must be visible, and must not be re-announced every tick."""
    _calls, _set = _failing_then_ok(probe, fail_times=2, stop_after=6)
    monkeypatch.setattr(base, "set_heartbeat", _set)

    with caplog.at_level(logging.INFO, logger="Probe"):
        await probe._heartbeat_loop()

    recovered = [r for r in caplog.records if "recovered" in r.getMessage()]
    assert len(recovered) == 1, "recovery announced 0 or many times"
    assert "2 failed attempt(s)" in recovered[0].getMessage()


async def test_cancellation_still_propagates(probe, monkeypatch):
    """5 — run() cancels this task in its finally; the guard must not eat that."""
    started = asyncio.Event()

    async def _set(*_a, **_k):
        started.set()
        await asyncio.sleep(3600)  # park here until cancelled

    monkeypatch.setattr(base, "set_heartbeat", _set)
    task = asyncio.create_task(probe._heartbeat_loop())
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert task.cancelled()


async def test_happy_path_unchanged(probe, sleeps, monkeypatch, caplog):
    """6 — with Redis healthy: one write per tick, and nothing logged."""
    writes = {"n": 0}
    upserts = {"n": 0}

    async def _set(*_a, **_k):
        writes["n"] += 1
        if writes["n"] >= 3:
            probe._running = False

    async def _upsert(*_a, **_k):
        upserts["n"] += 1

    monkeypatch.setattr(base, "set_heartbeat", _set)
    monkeypatch.setattr(base, "upsert_heartbeat", _upsert)

    with caplog.at_level(logging.DEBUG, logger="Probe"):
        await probe._heartbeat_loop()

    assert writes["n"] == 3
    assert upserts["n"] == 3, "the supabase sink stopped being called"
    assert caplog.records == [], "the healthy path must stay silent"
