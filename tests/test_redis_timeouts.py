"""#REDIS-TIMEOUT-0830 — a stalled Redis call must RAISE, never park forever.

`get_redis()` used to build the client with no timeouts: redis-py defaults
socket_timeout and socket_connect_timeout to None = wait forever. A half-open
socket therefore parked the calling task instead of raising — and a parked task
is invisible to a try/except, so the #HEARTBEAT-GUARD-0830 guard could not save
it. These tests pin the configuration contract and, above all, the two numeric
bounds that make the values safe: they are the part a future edit would break
silently.
"""
import asyncio
import inspect

import pytest

import core.redis_client as rc
from config.settings import settings


@pytest.fixture(autouse=True)
def _fresh_client(monkeypatch):
    """The client is a process-wide singleton — never leak it between tests."""
    monkeypatch.setattr(rc, "_client", None)
    yield
    monkeypatch.setattr(rc, "_client", None)


@pytest.fixture
def from_url_spy(monkeypatch):
    seen = {"calls": 0, "args": None, "kwargs": None}

    async def _fake_from_url(*args, **kwargs):
        seen["calls"] += 1
        seen["args"] = args
        seen["kwargs"] = kwargs
        return object()

    monkeypatch.setattr(rc.aioredis, "from_url", _fake_from_url)
    return seen


# ---------------------------------------------------------------------------
# The configuration contract
# ---------------------------------------------------------------------------
async def test_client_is_built_with_every_timeout(from_url_spy):
    """The regression itself: none of these were passed before."""
    await rc.get_redis()

    kwargs = from_url_spy["kwargs"]
    assert kwargs["socket_timeout"] == rc.SOCKET_TIMEOUT
    assert kwargs["socket_connect_timeout"] == rc.SOCKET_CONNECT_TIMEOUT
    assert kwargs["health_check_interval"] == rc.HEALTH_CHECK_INTERVAL
    assert kwargs["decode_responses"] is True, "decode_responses must survive the change"


async def test_client_stays_a_singleton(from_url_spy):
    first = await rc.get_redis()
    second = await rc.get_redis()

    assert first is second
    assert from_url_spy["calls"] == 1, "one client per process, not one per call"


async def test_no_timeout_is_left_unbounded(from_url_spy):
    await rc.get_redis()

    for name in ("socket_timeout", "socket_connect_timeout"):
        value = from_url_spy["kwargs"][name]
        assert value is not None, f"{name}=None means 'wait forever' — the whole bug"
        assert value > 0


# ---------------------------------------------------------------------------
# The two bounds. These are the tests that matter: the values are only safe
# BETWEEN them, and nothing else in the codebase would complain if they moved.
# ---------------------------------------------------------------------------
def test_socket_timeout_is_above_the_blocking_read():
    """Lower bound — under it, every idle stream read fails on the socket."""
    assert rc.SOCKET_TIMEOUT * 1000 > rc.STREAM_BLOCK_MS, (
        "socket_timeout must exceed the XREADGROUP block, or consume() times out "
        "on a healthy idle stream"
    )


def test_a_stalled_write_cannot_outlive_the_heartbeat_key():
    """Upper bound — the reason a 'safer, longer' timeout would be worse.

    One stalled write costs SOCKET_TIMEOUT, then the heartbeat loop waits its
    own HEARTBEAT_INTERVAL before trying again. If that total reaches
    HEARTBEAT_TIMEOUT the key expires, the MonitorAgent reads the agent as dead
    and kickstarts the WHOLE orchestrator — the storm this change exists to stop.
    """
    worst_case = rc.SOCKET_TIMEOUT + settings.HEARTBEAT_INTERVAL
    assert worst_case < settings.HEARTBEAT_TIMEOUT, (
        f"a single stalled write would strand the heartbeat for {worst_case}s "
        f"against a TTL of {settings.HEARTBEAT_TIMEOUT}s"
    )


def test_consume_uses_the_declared_block_and_not_a_literal():
    """The two constants must stay tied, or the bound above silently stops holding."""
    source = inspect.getsource(rc.consume)
    assert "block=STREAM_BLOCK_MS" in source
    assert "block=5000" not in source, "a hard-coded block would drift from the bound"


# ---------------------------------------------------------------------------
# End to end with #HEARTBEAT-GUARD-0830: timeout -> exception -> guard survives
# ---------------------------------------------------------------------------
def test_the_timeout_error_is_catchable_by_the_heartbeat_guard():
    """A timeout must be an Exception, not a BaseException.

    The guard in BaseAgent._heartbeat_loop catches `Exception`. If the error a
    timeout produces sat outside that (like CancelledError does), the two fixes
    would not connect and the task would still die.
    """
    import redis.exceptions

    assert issubclass(redis.exceptions.TimeoutError, Exception)
    assert not issubclass(redis.exceptions.TimeoutError, asyncio.CancelledError)
    assert issubclass(asyncio.TimeoutError, Exception)


async def test_a_timing_out_write_propagates_to_the_caller(monkeypatch):
    """set_heartbeat must let the error out, so the caller's guard can see it.

    Swallowing it here would restore the silence: the agent would look alive
    while writing nothing.
    """
    import redis.exceptions

    class _StallingRedis:
        async def setex(self, *_a, **_k):
            raise redis.exceptions.TimeoutError("Timeout reading from socket")

    monkeypatch.setattr(rc, "_client", _StallingRedis())

    with pytest.raises(redis.exceptions.TimeoutError):
        await rc.set_heartbeat("Probe", 60, "now")
