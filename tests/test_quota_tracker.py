import pytest
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
