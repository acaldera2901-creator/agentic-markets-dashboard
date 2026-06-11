import logging
from unittest.mock import AsyncMock, patch

import pytest

from agents.sportsbook_scraper import SportsbookScraperAgent
from core.sportsbook.common import OddsEvent


def _agent():
    a = SportsbookScraperAgent.__new__(SportsbookScraperAgent)
    a.name = "test"; a.logger = logging.getLogger("test")
    a._running = False; a._fail_counts = {"roobet": 0, "stake": 0}
    return a


def _ev():
    return OddsEvent(source="roobet", sport="soccer", competitors=["A", "B"],
                     scheduled=1781204400, odds_home=2.0, odds_draw=3.0, odds_away=3.5)


@pytest.mark.asyncio
async def test_writes_enabled_book_rows():
    a = _agent()
    with patch("agents.sportsbook_scraper.settings") as s, \
         patch("agents.sportsbook_scraper.roobet_client") as rb, \
         patch("agents.sportsbook_scraper.stake_client") as st, \
         patch("agents.sportsbook_scraper.snapshot_odds_to_supabase", new=AsyncMock()) as snap:
        s.ROOBET_ENABLED = True; s.STAKE_ENABLED = False
        rb.fetch_events = AsyncMock(return_value=[_ev()])
        st.fetch_events = AsyncMock(return_value=[])
        n = await a.scrape_once()
        assert n == 1
        snap.assert_awaited_once()
        assert snap.await_args.args[0][0]["source"] == "roobet"


@pytest.mark.asyncio
async def test_disabled_book_skipped():
    a = _agent()
    with patch("agents.sportsbook_scraper.settings") as s, \
         patch("agents.sportsbook_scraper.roobet_client") as rb, \
         patch("agents.sportsbook_scraper.stake_client") as st, \
         patch("agents.sportsbook_scraper.snapshot_odds_to_supabase", new=AsyncMock()) as snap:
        s.ROOBET_ENABLED = False; s.STAKE_ENABLED = False
        n = await a.scrape_once()
        assert n == 0
        rb.fetch_events.assert_not_called()
        snap.assert_not_called()


@pytest.mark.asyncio
async def test_auto_disable_after_consecutive_fails():
    a = _agent()
    with patch("agents.sportsbook_scraper.settings") as s, \
         patch("agents.sportsbook_scraper.MAX_FAILS", 2), \
         patch("agents.sportsbook_scraper.roobet_client") as rb, \
         patch("agents.sportsbook_scraper.stake_client") as st, \
         patch("agents.sportsbook_scraper.snapshot_odds_to_supabase", new=AsyncMock()):
        s.ROOBET_ENABLED = True; s.STAKE_ENABLED = False
        rb.fetch_events = AsyncMock(side_effect=RuntimeError("blocked"))
        await a.scrape_once()
        await a.scrape_once()
        assert a._fail_counts["roobet"] >= 2
        assert a._enabled("roobet") is False  # auto-disabled
