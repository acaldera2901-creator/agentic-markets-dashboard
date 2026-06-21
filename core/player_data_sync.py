"""Orchestratore dei dati giocatore: compone fonti -> normalizza -> scrive.

Fail-soft: una lega che fallisce non interrompe le altre né solleva.
"""
from __future__ import annotations
import logging

from core.player_data_tier import LEAGUE_DATA_TIER
from core.player_models import normalize_season_stats, build_profile, PlayerLineupEntry
from core.player_data_writers import upsert_player_profiles, upsert_player_lineups
from core.football_api_client import get_player_season_stats, get_lineups

logger = logging.getLogger(__name__)


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
