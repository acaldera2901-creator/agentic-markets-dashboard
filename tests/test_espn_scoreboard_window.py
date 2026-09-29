"""ESPN scoreboard window (#ESPN-MONTH-DATES-0929).

ESPN rejects `dates=YYYYMMDD-YYYYMMDD` ranges since 2026-09-15 (400); the
client must query whole months and filter to the window instead.
"""
import asyncio
from datetime import date

import httpx

from core import espn_soccer_client as esc


def test_months_between_spans_year_boundary():
    assert esc._months_between(date(2026, 9, 29), date(2026, 10, 9)) == ["202609", "202610"]
    assert esc._months_between(date(2026, 10, 1), date(2026, 10, 11)) == ["202610"]
    assert esc._months_between(date(2026, 12, 28), date(2027, 1, 7)) == ["202612", "202701"]


def _client(pages: dict[str, list[dict]], status: int = 200, seen: list | None = None):
    def handler(request: httpx.Request) -> httpx.Response:
        dates = request.url.params["dates"]
        if seen is not None:
            seen.append(dates)
        assert "-" not in dates, "range queries are rejected by ESPN"
        if status != 200:
            return httpx.Response(status, json={"code": status})
        return httpx.Response(200, json={"events": pages.get(dates, [])})

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_window_queries_months_and_filters_to_window():
    pages = {
        "202609": [{"id": "a", "date": "2026-09-28T19:00Z"}, {"id": "b", "date": "2026-09-30T19:00Z"}],
        "202610": [{"id": "c", "date": "2026-10-09T18:45Z"}, {"id": "d", "date": "2026-10-10T18:45Z"}],
    }
    seen: list[str] = []

    async def run():
        async with _client(pages, seen=seen) as c:
            return await esc._scoreboard_window(c, "uefa.nations", date(2026, 9, 29), date(2026, 10, 9))

    events, status = asyncio.run(run())
    assert status == 200
    assert seen == ["202609", "202610"]
    assert [e["id"] for e in events] == ["b", "c"]


def test_window_non_200_returns_none_with_status():
    async def run():
        async with _client({}, status=400) as c:
            return await esc._scoreboard_window(c, "uefa.nations", date(2026, 9, 29), date(2026, 10, 9))

    assert asyncio.run(run()) == (None, 400)
