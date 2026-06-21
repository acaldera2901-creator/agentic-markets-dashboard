import httpx, pytest
from core import odds_api_goalscorer as g

class _Resp:
    def __init__(self, payload, status=200): self._p, self.status_code = payload, status
    def json(self): return self._p

@pytest.fixture(autouse=True)
def _key(monkeypatch): monkeypatch.setattr(g.settings, "ODDS_API_KEY", "k"*20)

async def test_get_events_returns_list(monkeypatch):
    async def fake_get(self, url, **kw): return _Resp([{"id":"e1","home_team":"Spain","away_team":"Saudi Arabia"}])
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    out = await g.get_events("soccer_fifa_world_cup")
    assert out[0]["id"] == "e1"

async def test_get_event_odds_returns_dict(monkeypatch):
    async def fake_get(self, url, **kw): return _Resp({"id":"e1","bookmakers":[]})
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    out = await g.get_event_goalscorer_odds("soccer_fifa_world_cup", "e1")
    assert out["id"] == "e1"

async def test_fail_soft_without_key(monkeypatch):
    monkeypatch.setattr(g.settings, "ODDS_API_KEY", "")
    assert await g.get_events("x") == []
    assert await g.get_event_goalscorer_odds("x","e") == {}

async def test_fail_soft_on_non_200(monkeypatch):
    async def fake_get(self, url, **kw): return _Resp({"message":"err"}, status=429)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    assert await g.get_events("x") == []
    assert await g.get_event_goalscorer_odds("x","e") == {}
