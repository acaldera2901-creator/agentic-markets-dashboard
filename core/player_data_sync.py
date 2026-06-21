"""Orchestratore dei dati giocatore: compone fonti -> normalizza -> scrive.

Fail-soft: una lega che fallisce non interrompe le altre né solleva.
"""
from __future__ import annotations

from core.player_data_tier import LEAGUE_DATA_TIER
from core.player_models import normalize_season_stats, build_profile, PlayerLineupEntry, PlayerMatchStat
from core.player_data_writers import upsert_player_profiles, upsert_player_lineups, upsert_player_match_stats
from core.football_api_client import get_player_season_stats, get_lineups, get_fixture_player_stats


def _parse_lineup(fixture_id: int, raw: list[dict]) -> list[PlayerLineupEntry]:
    out: list[PlayerLineupEntry] = []
    for team_block in raw or []:
        team = (team_block.get("team") or {}).get("name", "")
        for is_starter, key in ((True, "startXI"), (False, "substitutes")):
            for item in team_block.get(key) or []:
                p = item.get("player") or {}
                if not p.get("id"):
                    continue
                out.append(PlayerLineupEntry(
                    player_id=str(p["id"]),
                    fixture_id=fixture_id,
                    team=team,
                    position=p.get("pos", "") or "",
                    shirt_number=p.get("number"),
                    is_starter=is_starter,
                ))
    return out


def _parse_fixture_players(fixture_id: int, league: str, match_date: str,
                           raw: list[dict]) -> list[PlayerMatchStat]:
    out: list[PlayerMatchStat] = []
    for team_block in raw or []:
        team = (team_block.get("team") or {}).get("name", "")
        for item in team_block.get("players") or []:
            p = item.get("player") or {}
            stats = (item.get("statistics") or [{}])[0]
            games = stats.get("games") or {}
            goals = stats.get("goals") or {}
            shots = stats.get("shots") or {}
            if not p.get("id"):
                continue
            out.append(PlayerMatchStat(
                player_id=str(p["id"]),
                fixture_id=fixture_id,
                league=league,
                team=team,
                minutes=int(games.get("minutes") or 0),
                goals=int(goals.get("total") or 0),
                assists=int(goals.get("assists") or 0),
                shots=int(shots.get("total") or 0),
                xg=None,                      # api-football non fornisce xg affidabile
                started=not bool(games.get("substitute", True)),
                match_date=match_date,
            ))
    return out


async def sync_player_lineups(fixture_ids: list[int]) -> dict:
    summary = {"lineups_written": 0, "fixtures": 0, "errors": []}
    for fid in fixture_ids:
        try:
            raw = await get_lineups(fid)
            entries = _parse_lineup(fid, raw)
            if entries:
                summary["lineups_written"] += await upsert_player_lineups(entries)
                summary["fixtures"] += 1
        except Exception as exc:
            summary["errors"].append(f"{fid}:{exc}")
    return summary


async def backfill_recent_match_stats(fixtures: list[dict]) -> dict:
    summary = {"stats_written": 0, "fixtures": 0, "errors": []}
    for fx in fixtures:
        try:
            raw = await get_fixture_player_stats(fx["fixture_id"])
            rows = _parse_fixture_players(fx["fixture_id"], fx["league"], fx["date"], raw)
            if rows:
                summary["stats_written"] += await upsert_player_match_stats(rows)
                summary["fixtures"] += 1
        except Exception as exc:
            summary["errors"].append(f"{fx.get('fixture_id')}:{exc}")
    return summary


async def sync_player_profiles(
    season: int,
    today_iso: str,
    xg_lookup: dict[str, dict[str, float]] | None = None,
) -> dict:
    summary = {"profiles_written": 0, "leagues": 0, "errors": []}
    xg_lookup = xg_lookup or {}
    for code, meta in LEAGUE_DATA_TIER.items():
        try:
            profiles = []
            page, total = 1, 1
            while page <= total:
                data = await get_player_season_stats(meta["id"], season, page=page)
                total = data.get("paging", {}).get("total", 1)
                seasons = normalize_season_stats(data.get("response", []), code, season)
                league_xg = xg_lookup.get(code, {})
                for st in seasons:
                    xg90 = league_xg.get(st.name.strip().lower()) if meta["tier"] == 1 else None
                    profiles.append(build_profile(st, xg90, today_iso))
                page += 1
            written = await upsert_player_profiles(profiles)
            summary["profiles_written"] += written
            summary["leagues"] += 1
        except Exception as exc:
            summary["errors"].append(f"{code}:{exc}")
    return summary
