"""`_latest_book_quotes` must page: one PostgREST request cannot cover a chunk.

Same defect as #CLOSING-LINES-SCAN-0828, second site. Measured on production
2026-08-28: PostgREST caps every response at 1000 rows whatever `limit` asks for
(asked 10000, got 1000), and the sportsbook scraper accumulates up to **48
captures per (match, book)**. A 40-key chunk over stake+roobet therefore expects
~3800 rows and receives 1000. Because rows arrive `captured_at DESC` and the code
keeps the FIRST hit per (key, book), every key whose latest capture falls outside
those 1000 newest rows silently ended up with NO quote — and a missing quote is
indistinguishable from "the book did not price this match".
"""
import pytest

import core.shadow_collector as sc


class _PagedClient:
    """Fake httpx client serving canned pages and recording the offsets asked for."""

    def __init__(self, pages, status=200):
        self.pages = list(pages)
        self.status = status
        self.calls: list[dict] = []

    async def get(self, url, params=None, headers=None):
        self.calls.append(dict(params or {}))
        payload = self.pages.pop(0) if self.pages else []
        status = self.status

        class R:
            status_code = status
            text = ""

            def json(self):
                return payload

        return R()

    @property
    def offsets(self):
        return [c.get("offset") for c in self.calls]


def _row(key, book, cap):
    return {
        "team_pair_key": key,
        "source": book,
        "odds_home": 2.0,
        "odds_draw": 3.2,
        "odds_away": 3.5,
        "captured_at": cap,
    }


def _full_page(fill_key="filler"):
    """A page at the cap: the signal that more rows exist."""
    return [
        _row(fill_key, "stake", f"2026-08-28T12:00:{i % 60:02d}+00:00")
        for i in range(sc._QUOTE_PAGE_SIZE)
    ]


@pytest.mark.asyncio
async def test_full_page_triggers_a_second_request():
    """A page at exactly the cap means 'there is more'. Stopping there is the
    silent truncation itself."""
    page2 = [_row("k-late", "stake", "2026-08-28T09:00:00+00:00")]
    c = _PagedClient(pages=[_full_page(), page2])
    keys = ["filler", "k-late"]
    out = await sc._latest_book_quotes(c, "https://x/rest/v1", keys)
    assert len(c.calls) >= 2, "pagina piena e nessuna richiesta successiva"
    assert str(sc._QUOTE_PAGE_SIZE) in [o for o in c.offsets if o], (
        f"offset della 2a pagina assente: {c.offsets}"
    )
    assert "k-late" in out, (
        "la key della seconda pagina non ha quota: troncamento silenzioso"
    )


@pytest.mark.asyncio
async def test_short_page_stops_paging():
    """Below the cap the chunk is exhausted: nessuna richiesta in piu' contro una
    tabella da 23M righe."""
    c = _PagedClient(pages=[[_row("k1", "stake", "2026-08-28T12:00:00+00:00")]])
    await sc._latest_book_quotes(c, "https://x/rest/v1", ["k1", "k2"])
    assert len(c.calls) == 1, f"pagina corta ma la paginazione e' continuata: {c.offsets}"


@pytest.mark.asyncio
async def test_stops_early_when_every_key_has_both_books():
    """Once both books are resolved for every key in the chunk, further pages can
    only carry older captures that would be skipped anyway."""
    rows = []
    for k in ("k1", "k2"):
        for b in ("stake", "roobet"):
            rows.append(_row(k, b, "2026-08-28T12:00:00+00:00"))
    rows += [_row("pad", "stake", "2026-08-28T11:00:00+00:00")] * (
        sc._QUOTE_PAGE_SIZE - len(rows)
    )
    c = _PagedClient(pages=[rows, [_row("k1", "stake", "2026-08-01T00:00:00+00:00")]])
    out = await sc._latest_book_quotes(c, "https://x/rest/v1", ["k1", "k2"])
    assert len(c.calls) == 1, "pagina piena ma chunk gia' risolto: richiesta inutile"
    assert set(out["k1"]) == {"stake", "roobet"}
    assert set(out["k2"]) == {"stake", "roobet"}


@pytest.mark.asyncio
async def test_first_hit_wins_so_the_latest_capture_is_kept():
    """Rows arrive captured_at DESC: the first hit per (key, book) is the latest.
    A later page must never overwrite it with an older price."""
    newer = "2026-08-28T12:00:00+00:00"
    older = "2026-08-01T00:00:00+00:00"
    page1 = [_row("k1", "stake", newer)] + [
        _row("pad", "roobet", newer)
    ] * (sc._QUOTE_PAGE_SIZE - 1)
    page2 = [_row("k1", "stake", older) | {"odds_home": 9.99}]
    c = _PagedClient(pages=[page1, page2])
    out = await sc._latest_book_quotes(c, "https://x/rest/v1", ["k1", "pad", "k2"])
    assert out["k1"]["stake"]["odds_home"] == 2.0, (
        "una cattura piu' vecchia ha sovrascritto la piu' recente"
    )


@pytest.mark.asyncio
async def test_page_budget_is_bounded():
    """A runaway loop against a 23M-row / 9 GB table is not acceptable."""
    c = _PagedClient(pages=[_full_page() for _ in range(sc._QUOTE_MAX_PAGES + 5)])
    await sc._latest_book_quotes(c, "https://x/rest/v1", ["a", "b"])
    assert len(c.calls) <= sc._QUOTE_MAX_PAGES, f"budget sforato: {len(c.calls)}"


@pytest.mark.asyncio
async def test_page_size_matches_the_real_postgrest_cap():
    """Pin the number: asking for more than the cap is what created the illusion of
    a covered window in the first place."""
    assert sc._QUOTE_PAGE_SIZE == 1000


@pytest.mark.asyncio
async def test_non_200_is_fail_soft_and_stops_paging():
    c = _PagedClient(pages=[[]], status=500)
    out = await sc._latest_book_quotes(c, "https://x/rest/v1", ["k1"])
    assert out == {}
    assert len(c.calls) == 1, "errore DB ma la paginazione e' continuata"


@pytest.mark.asyncio
async def test_no_keys_is_a_noop():
    c = _PagedClient(pages=[])
    assert await sc._latest_book_quotes(c, "https://x/rest/v1", []) == {}
    assert c.calls == []


@pytest.mark.asyncio
async def test_two_way_tennis_row_keeps_its_shape():
    """A null odds_draw marks a 2-way tennis row: paging must not change how it is
    projected."""
    row = _row("t1", "stake", "2026-08-28T12:00:00+00:00")
    row["odds_draw"] = None
    c = _PagedClient(pages=[[row]])
    out = await sc._latest_book_quotes(c, "https://x/rest/v1", ["t1"])
    assert out["t1"]["stake"] == {"odds_p1": 2.0, "odds_p2": 3.5}
