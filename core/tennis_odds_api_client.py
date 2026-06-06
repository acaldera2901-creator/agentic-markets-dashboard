"""The Odds API tennis adapter.

Provides current pre-match/live moneyline odds and merges them into canonical
tennis fixtures before `TennisModelAgent` scores them.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from config.settings import settings
from core.tennis_names import canonical_player_key

BASE_URL = "https://api.the-odds-api.com/v4"

# Full The Odds API tennis catalog (probed via free /sports?all=true on
# 2026-06-06, #ODDS-1). get_tennis_odds filters this against the in-season
# listing before spending credits, so off keys cost nothing. NOTE: the
# provider has NO keys for grass 250/500s (Halle, Queen's, Eastbourne,
# 's-Hertogenbosch) — between Roland Garros and Wimbledon tennis odds
# coverage is a provider limitation, not a config gap.
TENNIS_SPORT_KEYS = (
    # ATP
    "tennis_atp_aus_open_singles",
    "tennis_atp_barcelona_open",
    "tennis_atp_canadian_open",
    "tennis_atp_china_open",
    "tennis_atp_cincinnati_open",
    "tennis_atp_dubai",
    "tennis_atp_french_open",
    "tennis_atp_hamburg_open",
    "tennis_atp_indian_wells",
    "tennis_atp_italian_open",
    "tennis_atp_madrid_open",
    "tennis_atp_miami_open",
    "tennis_atp_monte_carlo_masters",
    "tennis_atp_munich",
    "tennis_atp_paris_masters",
    "tennis_atp_qatar_open",
    "tennis_atp_shanghai_masters",
    "tennis_atp_us_open",
    "tennis_atp_wimbledon",
    # WTA
    "tennis_wta_aus_open_singles",
    "tennis_wta_canadian_open",
    "tennis_wta_charleston_open",
    "tennis_wta_china_open",
    "tennis_wta_cincinnati_open",
    "tennis_wta_dubai",
    "tennis_wta_french_open",
    "tennis_wta_indian_wells",
    "tennis_wta_italian_open",
    "tennis_wta_madrid_open",
    "tennis_wta_miami_open",
    "tennis_wta_qatar_open",
    "tennis_wta_strasbourg",
    "tennis_wta_stuttgart_open",
    "tennis_wta_us_open",
    "tennis_wta_wimbledon",
    "tennis_wta_wuhan_open",
)


def _day(value: str | None) -> str:
    if not value:
        return ""
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc).date().isoformat()
    except ValueError:
        return str(value)[:10]


def _pair_key(p1: str | None, p2: str | None, scheduled_at: str | None) -> str | None:
    k1 = canonical_player_key(p1)
    k2 = canonical_player_key(p2)
    if not k1 or not k2 or k1 == k2:
        return None
    return f"{_day(scheduled_at)}:{'|'.join(sorted([k1, k2]))}"


def parse_tennis_odds_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for event in events:
        p1 = event.get("home_team") or ""
        p2 = event.get("away_team") or ""
        if not p1 or not p2:
            continue
        for bookmaker in event.get("bookmakers", []):
            for market in bookmaker.get("markets", []):
                if market.get("key") != "h2h":
                    continue
                outcomes = {o.get("name"): o.get("price") for o in market.get("outcomes", [])}
                odds_p1 = outcomes.get(p1)
                odds_p2 = outcomes.get(p2)
                if odds_p1 and odds_p2:
                    rows.append({
                        "odds_event_id": event.get("id", ""),
                        "sport_key": event.get("sport_key", ""),
                        "player1": p1,
                        "player2": p2,
                        "scheduled_at": event.get("commence_time", ""),
                        "odds_p1": float(odds_p1),
                        "odds_p2": float(odds_p2),
                        "bookmaker": bookmaker.get("key", ""),
                    })
                    break
            if rows and rows[-1].get("odds_event_id") == event.get("id"):
                break
    return rows


def merge_tennis_odds(fixtures: list[dict[str, Any]], odds_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    odds_by_key = {
        key: row
        for row in odds_rows
        if (key := _pair_key(row.get("player1"), row.get("player2"), row.get("scheduled_at")))
    }
    merged: list[dict[str, Any]] = []
    for fixture in fixtures:
        key = _pair_key(fixture.get("player1"), fixture.get("player2"), fixture.get("scheduled_at"))
        odds = odds_by_key.get(key or "")
        if not odds:
            merged.append(fixture)
            continue
        p1_key = canonical_player_key(fixture.get("player1"))
        odds_p1_key = canonical_player_key(odds.get("player1"))
        same_order = p1_key == odds_p1_key
        merged.append({
            **fixture,
            "odds_p1": odds["odds_p1"] if same_order else odds["odds_p2"],
            "odds_p2": odds["odds_p2"] if same_order else odds["odds_p1"],
            "odds_provider": "the_odds_api",
            "odds_bookmaker": odds.get("bookmaker"),
            "odds_event_id": odds.get("odds_event_id"),
        })
    return merged


async def get_tennis_odds(sport_keys: tuple[str, ...] = TENNIS_SPORT_KEYS) -> list[dict[str, Any]]:
    if not settings.ODDS_API_KEY:
        return []
    # Quota guard: the free /sports listing tells us which tournaments are
    # in-season — polling all 21 keys blind costs ~42 credits/cycle for nothing.
    from core.odds_api_client import get_active_sport_keys

    active = await get_active_sport_keys()
    if active is not None:
        sport_keys = tuple(k for k in sport_keys if k in active)
    if not sport_keys:
        return []
    rows: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        for sport_key in sport_keys:
            resp = await client.get(
                f"{BASE_URL}/sports/{sport_key}/odds",
                params={
                    "apiKey": settings.ODDS_API_KEY,
                    "regions": "eu,uk",
                    "markets": "h2h",
                    "oddsFormat": "decimal",
                    "dateFormat": "iso",
                },
            )
            if resp.status_code == 200:
                rows.extend(parse_tennis_odds_events(resp.json()))
    return rows
