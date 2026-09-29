from unittest.mock import AsyncMock, MagicMock

import pytest

from core import supabase_client as sc


@pytest.mark.asyncio
async def test_old_rows_beyond_500_reached_with_bounded_keyset_pages(monkeypatch):
    # UUID sort order, stable even as settled rows disappear between requests.
    rows = [{"id": f"00000000-0000-0000-0000-{i:012d}", "source_id": f"m{i}",
             "starts_at": "2025-01-01T00:00:00Z"} for i in range(601)]
    rows[0]["source_id"] = None  # orphan must not block later pages
    requests = []

    async def get(url, *, params, headers):
        requests.append(dict(params))
        assert "and" not in params, "a 30-day cutoff hides old open rows"
        assert params["order"] == "id.asc"
        assert params["limit"] == "200"
        assert params["result"] == "is.null"
        after = params.get("id", "gt.")[3:]
        selected = [r for r in rows if r["id"] > after][:int(params["limit"])]
        response = MagicMock(status_code=200)
        response.json.return_value = selected
        return response

    client = AsyncMock()
    client.get.side_effect = get
    factory = MagicMock()
    factory.return_value.__aenter__.return_value = client
    monkeypatch.setattr(sc.httpx, "AsyncClient", factory)
    monkeypatch.setattr(sc, "_rest_base", lambda: "https://test.invalid/rest/v1")
    monkeypatch.setattr(sc, "_service_headers", lambda: {})
    cursor = None
    seen = []
    for _ in range(4):
        ids, cursor = await sc.unified_tennis_ancora_aperte(after_id=cursor)
        seen.extend(ids)
    assert seen == [f"m{i}" for i in range(1, 601)]
    assert cursor is None
    assert len(requests) == 4


@pytest.mark.asyncio
async def test_page_failure_is_distinct_from_exhausted_scan(monkeypatch):
    client = AsyncMock()
    client.get.return_value = MagicMock(status_code=503)
    factory = MagicMock()
    factory.return_value.__aenter__.return_value = client
    monkeypatch.setattr(sc.httpx, "AsyncClient", factory)
    monkeypatch.setattr(sc, "_rest_base", lambda: "https://test.invalid/rest/v1")
    monkeypatch.setattr(sc, "_service_headers", lambda: {})
    assert await sc.unified_tennis_ancora_aperte() is None
