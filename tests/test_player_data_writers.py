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
