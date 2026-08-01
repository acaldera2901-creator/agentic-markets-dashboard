"""
MMA (UFC) model agent — #NEWSPORTS Gate 2 (lab am-lab/nuovi-sport).

Python port of the validated lab shadow harness `ufc_v2.mjs` (Gate 1 sealed
test 2021-23: floor 70 -> 81.4% hit, 75 -> 86.5%). Pick = the MARKET favourite
above the floor — no model on top (Elo/age/reach are dead beyond the price;
the UFC favourite-longshot bias makes the high floors earn more than implied).

Operational red flags from the Gate 1 audit, all enforced here:
  * 2-30h pre-fight window only (post weigh-in: closes missed-weight + most
    substitutions; odds are near the close the Gate was validated on).
  * UFC-only org filter via TheSportsDB (the odds feed key covers ALL MMA
    orgs + speculative futures) — FAIL-CLOSED: verification down = no picks.
  * Min 3 books unless Pinnacle prices the fight (no exotic single-book picks).
  * Ambiguous matchups (same fighter in 2+ feed entries) are skipped.

DARK: registered in run.py only when settings.NEWSPORT_MMA_AGENT_ENABLED; the
loop self-guards too. Rows follow docs/NEWSPORTS-INTEGRATION.md (sport="mma",
source_table="ufc_model", sides in the home/away slots — prod convention).
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import Counter
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from agents.base import BaseAgent
from config.settings import settings
from core.odds_api_client import get_h2h_events, market_consensus
from core.supabase_client import upsert_unified_rows

logger = logging.getLogger("MmaModelAgent")

MIN_H, MAX_H = 2, 30          # lab audit M1/M10: post weigh-in window
MIN_BOOKS = 3                 # lab audit M6: never a pick on 1 exotic book
CYCLE_SECONDS = 30 * 60

# TheSportsDB free tier — UFC league id 4443, next-events listing.
SPORTSDB_URL = "https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=4443"
_windows_cache: tuple[float, list] | None = None
_WINDOWS_TTL = 20 * 3600      # card list changes weekly; lab used 20h


async def get_ufc_windows() -> Optional[list]:
    """Upcoming UFC card windows [{name, start_ms}], None = verification down
    (FAIL-CLOSED upstream: no picks). Stale cache beats nothing (lab)."""
    global _windows_cache
    now = time.monotonic()
    if _windows_cache and now - _windows_cache[0] < _WINDOWS_TTL:
        return _windows_cache[1]
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(SPORTSDB_URL)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}")
        events = (resp.json() or {}).get("events") or []
        windows = []
        for e in events:
            ts = e.get("strTimestamp")
            if not ts:
                continue
            iso = ts if ts.endswith("Z") else ts + "Z"
            try:
                start = datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000
            except ValueError:
                continue
            windows.append({"name": e.get("strEvent"), "start_ms": start})
        if windows:
            _windows_cache = (now, windows)
        return windows or None
    except Exception as e:
        logger.warning(f"TheSportsDB unreachable: {e}")
        if _windows_cache:
            return _windows_cache[1]  # stale beats nothing
        return None  # fail-closed


def match_ufc_event(commence_ms: float, windows: list) -> Optional[str]:
    """UFC cards run ~6-8h from the listed start; margin -3h (early prelims)
    to +9h. A fight outside every card window is not (verifiably) UFC."""
    for w in windows:
        if w["start_ms"] - 3 * 3.6e6 <= commence_ms <= w["start_ms"] + 9 * 3.6e6:
            return w["name"]
    return None


def assign_tier(conf: float) -> Optional[str]:
    floor_std = settings.SURFACE_FLOOR_MMA / 100
    floor_prem = settings.NEWSPORT_MMA_PREMIUM / 100
    if conf >= floor_prem:
        return "premium"
    if conf >= floor_std:
        return "standard"
    return None


def build_unified_row(*, ev: dict, mkt: dict, tier: str, ufc_event: str,
                      hours_to_fight: float, flags: List[str], now_iso: str) -> dict:
    """unified_predictions row per docs/NEWSPORTS-INTEGRATION.md (fighter A in
    the home slot, fighter B in the away slot — prod convention)."""
    p_home = round(mkt["p_home"], 4)
    pick_home = p_home >= 0.5
    conf = max(p_home, 1 - p_home)
    return {
        "sport": "mma",
        "source_table": "ufc_model",
        "source_id": str(ev["event_id"]),
        "league": "UFC",
        "competition": ufc_event,
        "home_team": ev["home_team"],
        "away_team": ev["away_team"],
        "starts_at": ev["commence_time"],
        "expires_at": ev["commence_time"],
        "pick": "HOME" if pick_home else "AWAY",
        "p_home": p_home,
        "p_draw": None,  # 2-outcome sport
        "p_away": round(1 - p_home, 4),
        "confidence_score": round(conf * 100),
        "odds": mkt["odds_home"] if pick_home else mkt["odds_away"],
        "bookmaker": mkt["source"],
        "edge_percent": None,  # market-anchored: no edge claim, ever
        # DARK phase: paper until activation flips the flag chain (deploy-gate).
        "signal_type": "paper",
        "is_historical": False,
        "is_demo": False,
        "notes": json.dumps({
            "p_home": p_home,
            "p_away": round(1 - p_home, 4),
            "odds_home": mkt["odds_home"],
            "odds_away": mkt["odds_away"],
            "mkt_source": mkt["source"],
            "n_books": mkt["n_books"],
        }),
        "enrichment": {
            "tier": tier,
            "org_verified": True,   # fail-closed filter: a row exists only if verified
            "n_books": mkt["n_books"],
            "window_ok": True,      # ditto: 2-30h enforced before the builder
            "hours_to_fight": round(hours_to_fight, 1),
            "flags": flags,
        },
        "published_at": now_iso,
        "updated_at": now_iso,
    }


class MmaModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("MmaModelAgent")

    async def _main_loop(self) -> None:
        if not settings.NEWSPORT_MMA_AGENT_ENABLED:
            self.logger.info("NEWSPORT_MMA_AGENT_ENABLED is off — agent idle (dark)")
            return
        while self._running:
            try:
                written = await self._compute_cycle()
                self.set_status_detail({"last_cycle_rows": written})
            except Exception as e:  # cycle-level fail-soft
                self.logger.warning(f"cycle failed (will retry next cycle): {e}")
            await asyncio.sleep(CYCLE_SECONDS)

    async def _compute_cycle(self) -> int:
        events = await get_h2h_events("UFC")
        if not events:
            self.logger.info("no MMA odds this cycle (key/quota) — skipping")
            return 0

        windows = await get_ufc_windows()
        if windows is None:
            # Lab audit: the feed has every org + rumor futures. Without the
            # org check we cannot claim "UFC" — fail-closed, zero picks today.
            self.logger.warning("UFC org verification unavailable — NO picks (fail-closed)")
            return 0

        # Ambiguous-matchup guard: the same fighter in 2+ feed entries means
        # speculative/duplicate listings — skip them all (lab audit C1).
        fighter_counts = Counter()
        for ev in events:
            fighter_counts[ev["home_team"]] += 1
            fighter_counts[ev["away_team"]] += 1

        now = datetime.now(timezone.utc)
        now_ms = now.timestamp() * 1000
        rows: List[dict] = []
        waiting = 0
        for ev in events:
            try:
                commence_ms = datetime.fromisoformat(
                    ev["commence_time"].replace("Z", "+00:00")
                ).timestamp() * 1000
            except (TypeError, ValueError):
                continue
            hours = (commence_ms - now_ms) / 3.6e6

            mkt = market_consensus(ev["books"])
            if not mkt:
                continue
            conf = max(mkt["p_home"], 1 - mkt["p_home"])
            tier = assign_tier(conf)
            if not tier:
                continue
            if hours > MAX_H:
                waiting += 1
                continue
            if hours < MIN_H:
                continue
            if mkt["n_books"] < MIN_BOOKS and mkt["source"] != "pinnacle":
                continue  # exotic single-book price — never a pick
            ufc_event = match_ufc_event(commence_ms, windows)
            if not ufc_event:
                continue  # non-UFC org or unverifiable
            if fighter_counts[ev["home_team"]] > 1 or fighter_counts[ev["away_team"]] > 1:
                continue  # ambiguous matchup

            rows.append(build_unified_row(
                ev=ev, mkt=mkt, tier=tier, ufc_event=ufc_event,
                hours_to_fight=hours, flags=[], now_iso=now.isoformat(),
            ))

        written = await upsert_unified_rows(rows) if rows else 0
        self.logger.info(
            f"cycle: {len(events)} fights in feed, {len(rows)} picks in window, "
            f"{waiting} candidates waiting (> {MAX_H}h), {written} rows upserted"
        )
        return written
