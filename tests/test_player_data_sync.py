import pytest
from core import player_data_sync as s
from core.player_data_sync import _parse_lineup

ONE_PAGE = {"response": [{
    "player": {"id": 276, "name": "Neymar"},
    "statistics": [{"team": {"name": "PSG"}, "league": {"name": "Ligue 1"},
                    "games": {"appearences": 20, "minutes": 1700, "position": "Attacker"},
                    "goals": {"total": 13, "assists": 6}, "shots": {"total": 55, "on": 30}}],
}], "paging": {"current": 1, "total": 1}}

# shape reale di /fixtures/lineups
RAW_LINEUP = [{
    "team": {"name": "PSG"},
    "startXI": [{"player": {"id": 276, "name": "Neymar", "number": 10, "pos": "F"}}],
    "substitutes": [{"player": {"id": 999, "name": "Sub", "number": 23, "pos": "M"}}],
}]

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

def test_parse_lineup_marks_starters_and_subs():
    out = _parse_lineup(555, RAW_LINEUP)
    starters = [e for e in out if e.is_starter]
    subs = [e for e in out if not e.is_starter]
    assert len(starters) == 1 and starters[0].player_id == "276"
    assert starters[0].shirt_number == 10 and starters[0].fixture_id == 555
    assert len(subs) == 1 and subs[0].player_id == "999"

async def test_sync_lineups_fail_soft(monkeypatch):
    async def boom(fid): raise RuntimeError("no lineup yet")
    monkeypatch.setattr(s, "get_lineups", boom)
    summary = await s.sync_player_lineups([1, 2])
    assert summary["lineups_written"] == 0 and len(summary["errors"]) == 2
