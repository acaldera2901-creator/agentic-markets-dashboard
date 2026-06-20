import httpx
import pytest
from core import football_api_client as fac

class _Resp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status
    def json(self): return self._p
    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=None)

@pytest.fixture(autouse=True)
def _key(monkeypatch):
    monkeypatch.setattr(fac.settings, "API_FOOTBALL_KEY", "x" * 40)

async def test_get_player_season_stats_returns_response_and_paging(monkeypatch):
    payload = {"response": [{"player": {"id": 1}}], "paging": {"current": 1, "total": 3}}
    async def fake_get(self, url, **kw): return _Resp(payload)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    out = await fac.get_player_season_stats(league_id=39, season=2025, page=1)
    assert out["paging"]["total"] == 3
    assert out["response"][0]["player"]["id"] == 1

async def test_get_fixture_events_returns_list(monkeypatch):
    payload = {"response": [{"type": "Goal", "player": {"id": 9, "name": "X"}}]}
    async def fake_get(self, url, **kw): return _Resp(payload)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    out = await fac.get_fixture_events(123)
    assert out[0]["type"] == "Goal"

async def test_player_stats_fail_soft_without_key(monkeypatch):
    monkeypatch.setattr(fac.settings, "API_FOOTBALL_KEY", "")
    out = await fac.get_player_season_stats(39, 2025)
    assert out["response"] == [] and out["paging"]["total"] == 1
    assert await fac.get_fixture_player_stats(1) == []
    assert await fac.get_fixture_events(1) == []
