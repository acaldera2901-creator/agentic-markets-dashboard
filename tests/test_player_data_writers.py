import httpx
import pytest
from core import player_data_writers as w
from core.player_models import PlayerProfile

class _Resp:
    def __init__(self, status, body=None):
        self.status_code, self._b = status, body or []
    def json(self): return self._b

@pytest.fixture(autouse=True)
def _cfg(monkeypatch):
    monkeypatch.setattr(w, "_rest_base", lambda: "https://x.supabase.co/rest/v1")
    monkeypatch.setattr(w, "_service_headers", lambda: {"apikey": "k"})

def _profile(pid="1"):
    return PlayerProfile(pid, "N", "T", "PL", 1, "Attacker", 0.5, 0.4, 0.9, False, True, "2026-06-20")

async def test_upsert_profile_patch_hit_counts(monkeypatch):
    async def fake_patch(self, url, **kw): return _Resp(200, [{"player_id": "1"}])
    async def fake_post(self, url, **kw): raise AssertionError("non deve postare se PATCH ha aggiornato")
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    assert await w.upsert_player_profiles([_profile()]) == 1

async def test_upsert_profile_post_when_patch_empty(monkeypatch):
    async def fake_patch(self, url, **kw): return _Resp(200, [])   # nessuna riga aggiornata
    async def fake_post(self, url, **kw): return _Resp(201)
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    assert await w.upsert_player_profiles([_profile()]) == 1

async def test_writers_skip_when_db_unconfigured(monkeypatch):
    monkeypatch.setattr(w, "_rest_base", lambda: None)
    assert await w.upsert_player_profiles([_profile()]) == 0


def _odd(name="Good"):
    from core.goalscorer_odds_normalize import PlayerOddRow
    return PlayerOddRow(match_id="m", sport_key="s", event_id="e", player_id=None,
                        player_name=name, market="anytime_goalscorer", bookmaker="bk",
                        region="us", price=2.0, implied_prob=0.5)

async def test_upsert_player_odds_post_when_patch_empty(monkeypatch):
    async def fake_patch(self, url, **kw): return _Resp(200, [])
    async def fake_post(self, url, **kw): return _Resp(201)
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    assert await w.upsert_player_odds([_odd()]) == 1

async def test_upsert_player_odds_skip_when_db_unconfigured(monkeypatch):
    monkeypatch.setattr(w, "_rest_base", lambda: None)
    assert await w.upsert_player_odds([_odd()]) == 0

async def test_upsert_player_odds_urlencodes_spaces(monkeypatch):
    captured = {}
    async def fake_patch(self, url, **kw):
        captured["url"] = url; return _Resp(200, [{"x":1}])
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    await w.upsert_player_odds([_odd(name="Lamine Yamal")])
    assert "Lamine%20Yamal" in captured["url"]
