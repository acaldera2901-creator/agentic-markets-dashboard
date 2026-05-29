# tests/test_data_hub.py
import pytest
from core.data_hub import DataHub


@pytest.mark.asyncio
async def test_merge_deduplicates_same_fixture():
    hub = DataHub(supabase_url=None, supabase_key=None)
    f1 = [{"match_id": "a:1", "home_team": "Arsenal", "away_team": "Chelsea",
            "kickoff": "2026-06-01T15:00:00Z", "league": "PL", "provider": "api_football"}]
    f2 = [{"match_id": "b:1", "home_team": "Arsenal", "away_team": "Chelsea",
            "kickoff": "2026-06-01T15:00:00Z", "league": "PL", "provider": "fdorg"}]
    merged = hub._merge_fixtures([f1, f2])
    assert len(merged) == 1
    assert "api_football" in merged[0]["providers_used"]
    assert "fdorg" in merged[0]["providers_used"]


@pytest.mark.asyncio
async def test_merge_keeps_different_fixtures():
    hub = DataHub(supabase_url=None, supabase_key=None)
    f1 = [{"match_id": "a:1", "home_team": "Arsenal", "away_team": "Chelsea",
            "kickoff": "2026-06-01T15:00:00Z", "league": "PL", "provider": "api_football"}]
    f2 = [{"match_id": "b:2", "home_team": "Liverpool", "away_team": "Man City",
            "kickoff": "2026-06-01T17:00:00Z", "league": "PL", "provider": "fdorg"}]
    merged = hub._merge_fixtures([f1, f2])
    assert len(merged) == 2


@pytest.mark.asyncio
async def test_merge_same_teams_different_dates_not_deduped():
    hub = DataHub(supabase_url=None, supabase_key=None)
    f1 = [{"match_id": "a:1", "home_team": "Arsenal", "away_team": "Chelsea",
            "kickoff": "2026-06-01T15:00:00Z", "league": "PL", "provider": "p1"}]
    f2 = [{"match_id": "b:2", "home_team": "Arsenal", "away_team": "Chelsea",
            "kickoff": "2026-06-08T15:00:00Z", "league": "PL", "provider": "p2"}]
    merged = hub._merge_fixtures([f1, f2])
    assert len(merged) == 2


@pytest.mark.asyncio
async def test_dedup_key_is_case_insensitive():
    hub = DataHub(supabase_url=None, supabase_key=None)
    f1 = [{"match_id": "a:1", "home_team": "Arsenal FC", "away_team": "Chelsea FC",
            "kickoff": "2026-06-01T15:00:00Z", "league": "PL", "provider": "p1"}]
    f2 = [{"match_id": "b:2", "home_team": "arsenal fc", "away_team": "chelsea fc",
            "kickoff": "2026-06-01T18:00:00Z", "league": "PL", "provider": "p2"}]
    # Different kickoff times → not deduped (only date part used)
    merged = hub._merge_fixtures([f1, f2])
    # Same date (2026-06-01) but different fixture logically — dedup uses date only
    assert len(merged) == 1  # same date = deduped
