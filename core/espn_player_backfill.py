"""Backfill profili giocatore da ESPN (I/O). Fonte gratuita che copre WC +
club leagues, dove api-football free non da` statistiche.

Per una competizione: enumera le partite CONCLUSE (scoreboard, giorno per
giorno nella finestra), scarica i summary, estrae+aggrega le stat per-giocatore
(core.espn_player_stats), costruisce i profili con soglia per-competizione e li
scrive in player_profiles. Fail-soft. Usa l'API site ESPN (nessuna key).
"""
from __future__ import annotations
import logging
from datetime import date, timedelta

import httpx

from core.espn_player_stats import parse_summary_players, aggregate_players
from core.player_models import build_profile
from core.player_data_tier import min_appearances_for
from core.player_data_writers import upsert_player_profiles

logger = logging.getLogger(__name__)

_SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer"


async def _scoreboard_event_ids(client: httpx.AsyncClient, espn_league: str, day: date) -> list[str]:
    try:
        r = await client.get(f"{_SITE}/{espn_league}/scoreboard",
                             params={"dates": day.strftime("%Y%m%d")})
        if r.status_code != 200:
            return []
        out = []
        for e in r.json().get("events", []):
            if e.get("status", {}).get("type", {}).get("state") == "post":
                out.append(str(e.get("id")))
        return out
    except Exception:
        return []


async def _event_player_rows(client: httpx.AsyncClient, espn_league: str, event_id: str) -> list[dict]:
    try:
        r = await client.get(f"{_SITE}/{espn_league}/summary", params={"event": event_id})
        if r.status_code != 200:
            return []
        return parse_summary_players(r.json())
    except Exception:
        return []


async def build_competition_profiles(espn_league: str, our_league: str, season: int,
                                     today_iso: str, days_back: int = 35) -> tuple[list, dict]:
    """Ritorna (profiles, summary) per una competizione. Non scrive."""
    summary = {"league": our_league, "events": 0, "players": 0, "eligible": 0, "errors": []}
    today = date.fromisoformat(today_iso[:10])
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, timeout=20.0) as client:
        event_ids: list[str] = []
        for d in range(days_back + 1):
            event_ids.extend(await _scoreboard_event_ids(client, espn_league, today - timedelta(days=d)))
        event_ids = list(dict.fromkeys(event_ids))  # dedup, ordine stabile
        rows: list[dict] = []
        for eid in event_ids:
            r = await _event_player_rows(client, espn_league, eid)
            if r:
                rows.extend(r)
                summary["events"] += 1
    seasons = aggregate_players(rows, league=our_league, season=season)
    floor = min_appearances_for(our_league)
    profiles = [build_profile(s, None, today_iso, min_appearances=floor) for s in seasons]
    summary["players"] = len(profiles)
    summary["eligible"] = sum(1 for p in profiles if p.eligible_for_player_markets)
    return profiles, summary


async def backfill_espn(competitions: list[dict], today_iso: str,
                        days_back: int = 35, dry_run: bool = False) -> dict:
    """competitions: [{our_league, espn_league, season}]. Scrive player_profiles
    (o conta se dry_run). Fail-soft per competizione."""
    result = {"profiles_written": 0, "competitions": [], "errors": []}
    for comp in competitions:
        try:
            profiles, summ = await build_competition_profiles(
                comp["espn_league"], comp["our_league"], comp["season"],
                today_iso, days_back=days_back,
            )
            if profiles and not dry_run:
                summ["written"] = await upsert_player_profiles(profiles)
                result["profiles_written"] += summ["written"]
            else:
                summ["written"] = len(profiles) if dry_run else 0
                if dry_run:
                    result["profiles_written"] += len(profiles)
            result["competitions"].append(summ)
        except Exception as exc:
            result["errors"].append(f"{comp.get('our_league')}:{exc}")
    return result
