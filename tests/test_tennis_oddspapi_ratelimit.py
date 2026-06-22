"""OddsPapi /odds is per-endpoint rate limited. These tests pin the pacing +
429-retry behaviour that the live collector depends on (root cause of the
'0 con odds reali' regression: rapid sequential /odds calls all returned 429)."""
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
    """Replays a scripted list of responses for sequential GET /odds calls."""

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
    # Make the delay observable and instantaneous: record sleeps, don't wait.
    sleeps: list[float] = []

    async def _fake_sleep(s):
        sleeps.append(s)

    monkeypatch.setattr(asyncio, "sleep", _fake_sleep)
    return sleeps


def _run(coro):
    return asyncio.run(coro)


def test_paces_sequential_odds_calls(monkeypatch, patch_env):
    """Two matched fixtures => a delay is inserted between their /odds calls."""
    sleeps = patch_env
    fixtures = [
        {"fixtureId": "1", "player1": "Jannik Sinner", "player2": "Carlos Alcaraz",
         "scheduled_at": "2026-06-22T14:00:00Z", "tournament": "x", "category": "y"},
        {"fixtureId": "2", "player1": "Jack Draper", "player2": "Marcos Giron",
         "scheduled_at": "2026-06-22T14:00:00Z", "tournament": "x", "category": "y"},
    ]

    async def _fake_fixtures(a, b):
        return fixtures

    monkeypatch.setattr(opc, "get_oddspapi_fixtures", _fake_fixtures)
    client = _FakeClient([_Resp(200, _two_way_payload(1.4, 3.1)),
                          _Resp(200, _two_way_payload(1.36, 3.3))])
    monkeypatch.setattr(opc.httpx, "AsyncClient", lambda *a, **k: client)

    from core.tennis_odds_api_client import _pair_key
    wanted = {
        _pair_key("Jannik Sinner", "Carlos Alcaraz", "2026-06-22T14:00:00Z"),
        _pair_key("Jack Draper", "Marcos Giron", "2026-06-22T14:00:00Z"),
    }
    rows = _run(opc.get_oddspapi_tennis_odds(wanted))
    assert len(rows) == 2
    # At least one pacing sleep between the two odds calls.
    assert any(s > 0 for s in sleeps), f"expected a pacing delay, got sleeps={sleeps}"


def test_retries_once_on_429(monkeypatch, patch_env):
    """A 429 on the first attempt is retried (after a wait) and then succeeds."""
    sleeps = patch_env
    fixtures = [
        {"fixtureId": "1", "player1": "Jannik Sinner", "player2": "Carlos Alcaraz",
         "scheduled_at": "2026-06-22T14:00:00Z", "tournament": "x", "category": "y"},
    ]

    async def _fake_fixtures(a, b):
        return fixtures

    monkeypatch.setattr(opc, "get_oddspapi_fixtures", _fake_fixtures)
    client = _FakeClient([_Resp(429), _Resp(200, _two_way_payload(1.4, 3.1))])
    monkeypatch.setattr(opc.httpx, "AsyncClient", lambda *a, **k: client)

    from core.tennis_odds_api_client import _pair_key
    wanted = {_pair_key("Jannik Sinner", "Carlos Alcaraz", "2026-06-22T14:00:00Z")}
    rows = _run(opc.get_oddspapi_tennis_odds(wanted))
    assert len(rows) == 1
    assert rows[0]["odds_p1"] == 1.4
    assert client.calls == 2  # first 429, then the retry succeeded
