import pytest
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch
from core.quota_tracker import QuotaTracker

LIMITS = {
    "api_football": {"daily": 100},
    "odds_api": {"monthly": 500},
    "football_data_org": {"per_minute": 10, "daily": 5000},
    "openweathermap": {"daily": 1000},
    "tennis_rapidapi": {"daily": 100},
    "openligadb": {"daily": 99999},
    "football_data_co_uk": {"daily": 99999},
}

@pytest.mark.asyncio
async def test_can_call_when_under_limit():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    tracker._cache["api_football"] = {"used": 50, "limit": 100}
    assert tracker.can_call("api_football") is True

@pytest.mark.asyncio
async def test_cannot_call_when_at_limit():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    tracker._cache["api_football"] = {"used": 100, "limit": 100}
    assert tracker.can_call("api_football") is False

@pytest.mark.asyncio
async def test_increment_updates_cache():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    tracker._cache["api_football"] = {"used": 50, "limit": 100}
    await tracker.increment("api_football")
    assert tracker._cache["api_football"]["used"] == 51

@pytest.mark.asyncio
async def test_unknown_provider_always_allowed():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    assert tracker.can_call("unknown_provider") is True


@pytest.mark.asyncio
async def test_stale_exhausted_entry_unblocks_new_day():
    """#6: yesterday's exhausted quota must not lock out today."""
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    yesterday = str(date.today() - timedelta(days=1))
    tracker._cache["api_football"] = {"used": 100, "limit": 100, "date": yesterday}
    assert tracker.can_call("api_football") is True
    # counter reset to zero for today
    assert tracker._cache["api_football"]["used"] == 0
    assert tracker._cache["api_football"]["date"] == str(date.today())


@pytest.mark.asyncio
async def test_exhausted_entry_today_still_blocks():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    tracker._cache["api_football"] = {"used": 100, "limit": 100, "date": str(date.today())}
    assert tracker.can_call("api_football") is False


def test_known_providers_lists_limited_providers():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    assert set(tracker.known_providers()) == set(LIMITS.keys())


# #TENNIS-ODDS-BLACKOUT (2026-07-15): il cap mensile ora è enforced (prima
# "daily or monthly" lo ignorava → account drenato prima del reset).
BOTH = {"odds_api": {"daily": 3200, "monthly": 100_000}}

@pytest.mark.asyncio
async def test_monthly_cap_blocks_even_with_daily_headroom():
    t = QuotaTracker(BOTH, supabase_url=None, supabase_key=None)
    today = str(date.today())
    # daily quasi vuoto, ma mensile al tetto → deve bloccare (era il bug)
    t._cache["odds_api"] = {"used": 10, "date": today, "month_used": 100_000, "month": today[:7]}
    assert t.can_call("odds_api") is False

@pytest.mark.asyncio
async def test_daily_cap_still_blocks_with_monthly_headroom():
    t = QuotaTracker(BOTH, supabase_url=None, supabase_key=None)
    today = str(date.today())
    t._cache["odds_api"] = {"used": 3200, "date": today, "month_used": 5000, "month": today[:7]}
    assert t.can_call("odds_api") is False

@pytest.mark.asyncio
async def test_under_both_caps_allows():
    t = QuotaTracker(BOTH, supabase_url=None, supabase_key=None)
    today = str(date.today())
    t._cache["odds_api"] = {"used": 100, "date": today, "month_used": 50_000, "month": today[:7]}
    assert t.can_call("odds_api") is True

@pytest.mark.asyncio
async def test_month_rollover_resets_monthly_counter():
    t = QuotaTracker(BOTH, supabase_url=None, supabase_key=None)
    today = str(date.today())
    old_month = "2001-01"  # mese passato con mensile esaurito
    t._cache["odds_api"] = {"used": 3200, "date": "2001-01-31", "month_used": 100_000, "month": old_month}
    # nuovo mese → daily e mensile azzerati → riapre
    assert t.can_call("odds_api") is True

@pytest.mark.asyncio
async def test_increment_bumps_both_daily_and_monthly():
    t = QuotaTracker(BOTH, supabase_url=None, supabase_key=None)
    with patch.object(t, "_persist", new=AsyncMock()):
        await t.increment("odds_api", 6)
        await t.increment("odds_api", 4)
    e = t._cache["odds_api"]
    assert e["used"] == 10 and e["month_used"] == 10
