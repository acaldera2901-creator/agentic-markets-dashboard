"""Tests for the sportsbook_shadow_eval PostgREST writer (#SPORTSBOOK-SHADOW-1).

Same fail-soft contract as the other supabase_client writers: no creds -> noop,
errors swallowed, returns the count actually written.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from config.settings import settings


def _row(book="stake"):
    return {
        "prediction_ref": "tennis:espn:1",
        "ref_source": "tennis_predictions",
        "sport": "tennis",
        "book": book,
        "matched": True,
        "base_p_home": 0.65, "base_p_away": 0.35,
        "shadow_p_home": 0.60, "shadow_p_away": 0.40,
        "captured_at": "2026-06-11T13:00:00+00:00",
    }


@pytest.mark.asyncio
async def test_insert_posts_each_row(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "key123")
    import core.supabase_client as sc
    monkeypatch.setattr(sc, "_REST_BASE", None)

    resp = MagicMock(); resp.status_code = 201; resp.text = ""
    client = AsyncMock(); client.post = AsyncMock(return_value=resp)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(sc.httpx, "AsyncClient", lambda *a, **k: ctx)

    n = await sc.insert_shadow_eval_rows([_row("stake"), _row("roobet")])
    assert n == 2
    assert client.post.await_count == 2
    assert "/sportsbook_shadow_eval" in client.post.await_args_list[0].args[0]


@pytest.mark.asyncio
async def test_insert_noop_without_creds(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
    import core.supabase_client as sc
    monkeypatch.setattr(sc, "_REST_BASE", None)
    assert await sc.insert_shadow_eval_rows([_row()]) == 0


@pytest.mark.asyncio
async def test_settle_patches_by_id(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "key123")
    import core.supabase_client as sc
    monkeypatch.setattr(sc, "_REST_BASE", None)

    resp = MagicMock(); resp.status_code = 204; resp.text = ""
    client = AsyncMock(); client.patch = AsyncMock(return_value=resp)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(sc.httpx, "AsyncClient", lambda *a, **k: ctx)

    ok = await sc.settle_shadow_eval_row(
        42, outcome_idx=0, result="won", closing_odds=1.8
    )
    assert ok is True
    assert client.patch.await_count == 1
    assert "id=eq.42" in client.patch.await_args_list[0].args[0] or \
        client.patch.await_args_list[0].kwargs.get("params", {}).get("id") == "eq.42"
