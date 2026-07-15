"""OddsPapi enforces an ACCOUNT-level request cap (HTTP 429 with body code
REQUEST_LIMIT_EXCEEDED) that is distinct from the transient per-endpoint rate
limit the retry logic was built for. When the whole account is capped, retrying
is pointless and the failure must be visible (root cause of the 2026-07-13
tennis blackout: The Odds API monthly quota AND the OddsPapi fallback were both
exhausted, but the fallback failed silently as an ambiguous 'HTTP 429')."""
import asyncio

import pytest

import core.tennis_oddspapi_client as opc


class _Resp:
    def __init__(self, status_code: int, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = ""

    def json(self):
        return self._payload


_PLAN_CAP_BODY = {
    "error": {
        "message": "Request limit exceeded",
        "code": "REQUEST_LIMIT_EXCEEDED",
        "details": "You have exceeded your request limit of 250 requests.",
    }
}


def _two_way_payload(p1: float, p2: float) -> dict:
    return {
        "bookmakerOdds": {
            "pinnacle": {
                "markets": {
                    "121": {
                        "outcomes": {
                            "121": {"players": {"0": {"price": str(p1)}}},
                            "122": {"players": {"0": {"price": str(p2)}}},
                        }
                    }
                }
            }
        }
    }


class _FakeClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None):
        self.calls += 1
        return self._responses.pop(0)


@pytest.fixture
def patch_env(monkeypatch):
    monkeypatch.setenv("ODDSPAPI_KEY", "test-key")
    sleeps: list[float] = []

    async def _fake_sleep(s):
        sleeps.append(s)

    monkeypatch.setattr(asyncio, "sleep", _fake_sleep)
    return sleeps


def _run(coro):
    return asyncio.run(coro)


# ── pure detector ──────────────────────────────────────────────────────────

def test_plan_cap_reason_detects_account_cap():
    reason = opc._plan_cap_reason(_Resp(429, _PLAN_CAP_BODY))
    assert reason == "You have exceeded your request limit of 250 requests."


def test_plan_cap_reason_none_for_transient_429():
    # a bare 429 with no plan-cap body is the transient per-endpoint limit
    assert opc._plan_cap_reason(_Resp(429, {})) is None


def test_plan_cap_reason_none_for_non_429():
    assert opc._plan_cap_reason(_Resp(500, _PLAN_CAP_BODY)) is None


# ── /odds does NOT retry on an account cap ───────────────────────────────────

def test_odds_no_retry_on_plan_cap(monkeypatch, patch_env):
    monkeypatch.setenv("ODDSPAPI_KEY", "test-key")
    client = _FakeClient([_Resp(429, _PLAN_CAP_BODY), _Resp(200, _two_way_payload(1.4, 3.1))])
    monkeypatch.setattr(opc.httpx, "AsyncClient", lambda *a, **k: client)
    out = _run(opc.get_oddspapi_match_odds("1"))
    assert out is None
    assert client.calls == 1  # capped account => no pointless retry


def test_odds_still_retries_transient_429(monkeypatch, patch_env):
    # regression guard: a transient 429 (no plan-cap body) still retries once
    client = _FakeClient([_Resp(429), _Resp(200, _two_way_payload(1.4, 3.1))])
    monkeypatch.setattr(opc.httpx, "AsyncClient", lambda *a, **k: client)
    out = _run(opc.get_oddspapi_match_odds("1"))
    assert out is not None
    assert client.calls == 2


# ── fixtures returns [] + distinct log on account cap ────────────────────────

def test_fixtures_empty_and_flags_plan_cap(monkeypatch, patch_env, caplog):
    client = _FakeClient([_Resp(429, _PLAN_CAP_BODY)])
    monkeypatch.setattr(opc.httpx, "AsyncClient", lambda *a, **k: client)
    with caplog.at_level("WARNING"):
        out = _run(opc.get_oddspapi_fixtures("2026-07-15", "2026-07-17"))
    assert out == []
    assert any("plan cap" in r.message.lower() for r in caplog.records)
