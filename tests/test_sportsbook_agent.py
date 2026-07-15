import logging
from unittest.mock import AsyncMock, patch

import pytest

from agents.sportsbook_scraper import SportsbookScraperAgent
from core.sportsbook.common import OddsEvent

# NB (#HERMES-AUDIT-0715 P1-09): il patch di `settings` è un MagicMock → ogni
# flag *_ENABLED non settato esplicitamente risulta truthy e il client REALE del
# book non mockato fa rete dentro i test. Ogni test deve quindi (a) mockare TUTTI
# i client del registry di scrape_once e (b) settare esplicitamente TUTTI i flag.
BOOKS = ("roobet", "stake", "fortuneplay")


def _agent():
    a = SportsbookScraperAgent.__new__(SportsbookScraperAgent)
    a.name = "test"; a.logger = logging.getLogger("test")
    a._running = False; a._fail_counts = {b: 0 for b in BOOKS}
    return a


def _ev(source="roobet"):
    return OddsEvent(source=source, sport="soccer", competitors=["A", "B"],
                     scheduled=1781204400, odds_home=2.0, odds_draw=3.0, odds_away=3.5)


def _patched(settings_mock, clients, enabled=()):
    """Default-deny: tutti i flag OFF tranne quelli in `enabled`; client vuoti."""
    for book in BOOKS:
        setattr(settings_mock, f"{book.upper()}_ENABLED", book in enabled)
        clients[book].fetch_events = AsyncMock(return_value=[])


def _ctx():
    return (patch("agents.sportsbook_scraper.settings"),
            patch("agents.sportsbook_scraper.roobet_client"),
            patch("agents.sportsbook_scraper.stake_client"),
            patch("agents.sportsbook_scraper.fortuneplay_client"),
            patch("agents.sportsbook_scraper.snapshot_odds_to_supabase", new=AsyncMock()))


@pytest.mark.asyncio
async def test_writes_enabled_book_rows():
    a = _agent()
    c1, c2, c3, c4, c5 = _ctx()
    with c1 as s, c2 as rb, c3 as st, c4 as fp, c5 as snap:
        _patched(s, {"roobet": rb, "stake": st, "fortuneplay": fp}, enabled=("roobet",))
        rb.fetch_events = AsyncMock(return_value=[_ev()])
        n = await a.scrape_once()
        assert n == 1
        snap.assert_awaited_once()
        assert snap.await_args.args[0][0]["source"] == "roobet"


@pytest.mark.asyncio
async def test_fortuneplay_enabled_writes_rows():
    a = _agent()
    c1, c2, c3, c4, c5 = _ctx()
    with c1 as s, c2 as rb, c3 as st, c4 as fp, c5 as snap:
        _patched(s, {"roobet": rb, "stake": st, "fortuneplay": fp}, enabled=("fortuneplay",))
        fp.fetch_events = AsyncMock(return_value=[_ev(source="fortuneplay")])
        n = await a.scrape_once()
        assert n == 1
        rb.fetch_events.assert_not_called()
        assert snap.await_args.args[0][0]["source"] == "fortuneplay"


@pytest.mark.asyncio
async def test_disabled_book_skipped():
    a = _agent()
    c1, c2, c3, c4, c5 = _ctx()
    with c1 as s, c2 as rb, c3 as st, c4 as fp, c5 as snap:
        _patched(s, {"roobet": rb, "stake": st, "fortuneplay": fp}, enabled=())
        n = await a.scrape_once()
        assert n == 0
        rb.fetch_events.assert_not_called()
        st.fetch_events.assert_not_called()
        fp.fetch_events.assert_not_called()
        snap.assert_not_called()


@pytest.mark.asyncio
async def test_auto_disable_after_consecutive_fails():
    a = _agent()
    c1, c2, c3, c4, c5 = _ctx()
    with c1 as s, patch("agents.sportsbook_scraper.MAX_FAILS", 2), \
         c2 as rb, c3 as st, c4 as fp, c5:
        _patched(s, {"roobet": rb, "stake": st, "fortuneplay": fp}, enabled=("roobet",))
        rb.fetch_events = AsyncMock(side_effect=RuntimeError("blocked"))
        await a.scrape_once()
        await a.scrape_once()
        assert a._fail_counts["roobet"] >= 2
        assert a._enabled("roobet") is False  # auto-disabled
