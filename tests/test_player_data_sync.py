import pytest
from core import player_data_sync as s

ONE_PAGE = {"response": [{
    "player": {"id": 276, "name": "Neymar"},
    "statistics": [{"team": {"name": "PSG"}, "league": {"name": "Ligue 1"},
                    "games": {"appearences": 20, "minutes": 1700, "position": "Attacker"},
                    "goals": {"total": 13, "assists": 6}, "shots": {"total": 55, "on": 30}}],
}], "paging": {"current": 1, "total": 1}}

async def test_sync_profiles_writes_and_attaches_xg(monkeypatch):
    async def fake_stats(league_id, season, page=1): return ONE_PAGE
    captured = {}
    async def fake_upsert(profiles):
        captured["profiles"] = profiles
        return len(profiles)
    monkeypatch.setattr(s, "get_player_season_stats", fake_stats)
    monkeypatch.setattr(s, "upsert_player_profiles", fake_upsert)
    # limita a una sola lega Tier 1 per il test
    monkeypatch.setattr(s, "LEAGUE_DATA_TIER", {"FL1": {"id": 61, "name": "Ligue 1", "tier": 1}})

    xg = {"FL1": {"neymar": 0.62}}
    summary = await s.sync_player_profiles(season=2025, today_iso="2026-06-20", xg_lookup=xg)

    assert summary["profiles_written"] == 1
    assert captured["profiles"][0].xg_per90_season == 0.62
    assert captured["profiles"][0].eligible_for_player_markets is True

async def test_sync_profiles_fail_soft_per_league(monkeypatch):
    async def boom(league_id, season, page=1): raise RuntimeError("api down")
    async def fake_upsert(profiles): return len(profiles)
    monkeypatch.setattr(s, "get_player_season_stats", boom)
    monkeypatch.setattr(s, "upsert_player_profiles", fake_upsert)
    monkeypatch.setattr(s, "LEAGUE_DATA_TIER", {"FL1": {"id": 61, "name": "Ligue 1", "tier": 1}})
    summary = await s.sync_player_profiles(season=2025, today_iso="2026-06-20")
    assert summary["profiles_written"] == 0
    assert summary["errors"]            # errore registrato, nessuna eccezione propagata
