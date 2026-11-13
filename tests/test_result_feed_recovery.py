from datetime import date
from unittest.mock import AsyncMock
import httpx
import pytest
from core import partner_tennis_results as partner

@pytest.mark.asyncio
async def test_partner_falls_back_on_dead_endpoint():
    client = AsyncMock()
    def reply(url, **kw):
        request = httpx.Request('GET', url)
        if 'fortuneplay' in url:
            return httpx.Response(404, request=request)
        return httpx.Response(200, request=request, json={'data': [], 'pagination': {'last_page': 1}})
    client.get.side_effect = reply
    assert await partner._fetch_day(client, date(2026, 11, 11)) == []
    assert any('sportsbook.ybets.net' in str(c.args[0]) for c in client.get.call_args_list)

@pytest.mark.asyncio
async def test_partner_cache_refreshes_past_day(monkeypatch):
    partner._cache.clear()
    clock = [0.0]
    monkeypatch.setattr(partner, 'monotonic', lambda: clock[0], raising=False)
    fetch = AsyncMock(side_effect=[[], [{'event_id': 'late-result'}]])
    monkeypatch.setattr(partner, '_fetch_day', fetch)
    day = date(2026, 10, 1)
    assert await partner.get_partner_results_for_days([day]) == []
    clock[0] = 3601
    assert await partner.get_partner_results_for_days([day]) == [{'event_id': 'late-result'}]

@pytest.mark.asyncio
async def test_espn_cache_refreshes_past_day(monkeypatch):
    from core import espn_tennis_client as espn
    from unittest.mock import MagicMock
    espn._archive_cache.clear()
    clock = [0.0]
    monkeypatch.setattr(espn, 'monotonic', lambda: clock[0], raising=False)
    client = AsyncMock()
    client.get.return_value = httpx.Response(200, request=httpx.Request('GET','https://test.invalid'), json={'events': []})
    factory = MagicMock()
    factory.return_value.__aenter__.return_value = client
    monkeypatch.setattr(espn.httpx, 'AsyncClient', factory)
    await espn.get_completed_results_for_days([date(2026,10,1)])
    clock[0] = 3601
    await espn.get_completed_results_for_days([date(2026,10,1)])
    assert client.get.call_count == 4
