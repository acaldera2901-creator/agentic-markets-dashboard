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

@pytest.mark.asyncio
async def test_fixture_writer_projects_schema_and_groups_optional_columns(monkeypatch):
    from types import SimpleNamespace
    from pathlib import Path
    import re
    import core.data_hub as module

    sent = []
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            sent.append(kwargs['json'])
            return SimpleNamespace(status_code=201, text='')
    monkeypatch.setattr(module.httpx, 'AsyncClient', Client)
    hub=DataHub(supabase_url='https://example.invalid',supabase_key='test')
    api=hub._parse_api_football({'fixture':{'id':1,'date':'2026-11-01T12:00:00Z','venue':{'name':'Stadium'}},'teams':{'home':{'name':'A'},'away':{'name':'B'}}},'PL')
    other={'match_id':'openligadb:BL1:2','home_team':'C','away_team':'D','kickoff':'2026-11-01T13:00:00Z','league':'BL1','provider':'openligadb'}
    merged=hub._merge_fixtures([[api],[other]])
    await hub._write_fixtures(merged)
    migration=Path('supabase/migrations/20260528000000_data_intelligence.sql').read_text().split(');',1)[0]
    columns=set(re.findall(r'^\s+(\w+)\s+(?:TEXT|TIMESTAMPTZ|FLOAT|INT|JSONB)',migration,re.M))
    assert len(sent)==2  # differing optional columns do not get nulled by upsert
    for batch in sent:
        assert all(set(row)==set(batch[0]) for row in batch)
        assert all(set(row)<=columns for row in batch)
        assert all('provider' not in row and '_fixture_id' not in row for row in batch)
    flattened=[row for batch in sent for row in batch]
    assert flattened[0]['venue']=='Stadium'
    assert 'venue' not in flattened[1]  # don't erase existing enrichment
    assert flattened[0]['providers_used']==['api_football']
    assert flattened[1]['providers_used']==['openligadb']
    assert 'provider' in merged[0]  # leave in-memory provider metadata intact


@pytest.mark.asyncio
async def test_fdorg_collector_uses_upcoming_normalized_fixtures(monkeypatch):
    from unittest.mock import AsyncMock
    import core.football_data_org_client as fd
    hub=DataHub(supabase_url='https://example.invalid',supabase_key='test')
    upcoming=fd._normalize({'id':42,'utcDate':'2026-11-01T12:00:00Z','homeTeam':{'name':'A'},'awayTeam':{'name':'B'}})
    fetch=AsyncMock(return_value=[upcoming])
    history=AsyncMock(side_effect=AssertionError('Never fetch FINISHED history for upcoming fixtures'))
    monkeypatch.setattr(fd,'get_fixtures',fetch)
    monkeypatch.setattr(fd,'get_historical_results',history)
    hub.quota.increment=AsyncMock()
    rows=await hub._collect_fdorg(['PL'],2026)
    fetch.assert_awaited_once()
    history.assert_not_awaited()
    assert len(rows)==1
    assert rows[0]['match_id']=='fdorg:PL:42'
    assert rows[0]['home_team']=='A'
    assert rows[0]['provider']=='fdorg'
