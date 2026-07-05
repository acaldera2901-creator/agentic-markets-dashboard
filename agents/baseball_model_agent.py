"""
Baseball (MLB) model agent — #NEWSPORTS Gate 2 (lab am-lab/nuovi-sport).

Python port of the validated lab shadow harness `mlb_v2.mjs` (Gate 1 sealed
test 2018-21: floor 62 -> 67.5% hit on ~550 picks/season, 65 -> 71.8%).

Architecture (identical to football/tennis, probability-neutral):
  * SERVED probability = market devig (Pinnacle preferred, true median
    fallback) — the model NEVER moves it.
  * Selectivity = surfacing floors (settings.SURFACE_FLOOR_BASEBALL /
    NEWSPORT_BASEBALL_PREMIUM, PROVISIONAL until the live shadow confirms).
  * The era_g010/FIP model only feeds the why (pitcher duel FIP-adj, run form,
    record) and the disagreement warning (no tier upgrade when it disagrees).

Product rules enforced here (Gate 1 report, non-negotiable):
  regular season only · pre-match only · warm-up 20 games per team ·
  doubleheader-safe odds matching (teams AND start time ±3h, lab audit C2).

DARK: registered in run.py only when settings.NEWSPORT_BASEBALL_AGENT_ENABLED;
the loop self-guards too. Writes unified_predictions rows per the contract in
docs/NEWSPORTS-INTEGRATION.md (sport="baseball", source_table="mlb_model").
"""
from __future__ import annotations

import asyncio
import json
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from agents.base import BaseAgent
from config.settings import settings
from core.mlb_stats_client import get_prev_season, get_pitcher_fip, get_schedule, get_standings
from core.odds_api_client import get_h2h_events, market_consensus
from core.supabase_client import upsert_unified_rows

# Lab constants (mlb_v2.mjs — do not tune outside the lab ledger).
HOME_ADV = 0.54
GAMMA_FIP = 0.15
K_PYTH = 50
PYTH_EXP = 1.83
MIN_GAMES = 20  # warm-up: no picks before both teams played 20
ODDS_MATCH_WINDOW_H = 3  # audit C2: doubleheaders need team+time matching

CYCLE_SECONDS = 30 * 60  # odds cost ~1 credit/cycle; MLB lines move slowly pre-match


def log5(p_a: float, p_b: float) -> float:
    """Bill James log5: P(A beats B) from two win propensities."""
    return (p_a * (1 - p_b)) / (p_a * (1 - p_b) + p_b * (1 - p_a))


def pyth_prior_rating(rec: Optional[dict], prev_wp: Optional[float]) -> float:
    """Pythagorean run rating regressed to a prior (0.5 blended with last
    season's win%) with K_PYTH pseudo-games — exact lab replica."""
    rec = rec or {"wins": 0, "losses": 0, "runsScored": 0, "runsAllowed": 0}
    games = rec["wins"] + rec["losses"]
    target = 0.5 * 0.5 + 0.5 * (prev_wp if prev_wp is not None else 0.5)
    if not games:
        return target
    rs_pg = rec["runsScored"] / games
    ra_pg = rec["runsAllowed"] / games
    pyth = rs_pg**PYTH_EXP / (rs_pg**PYTH_EXP + ra_pg**PYTH_EXP)
    return (pyth * games + target * K_PYTH) / (games + K_PYTH)


def model_home_prob(rating_home: float, rating_away: float,
                    fip_home: float, fip_away: float) -> float:
    """era_g010 standalone probability (why/warning only, never served)."""
    p = log5(rating_home, rating_away)
    p = log5(p, 1 - HOME_ADV)
    z = math.log(p / (1 - p)) + GAMMA_FIP * (fip_away - fip_home)
    return 1 / (1 + math.exp(-z))


def assign_tier(conf: float, model_agrees: bool, warmup_ok: bool) -> Optional[str]:
    """Gate 1 tier: floors are inclusive on the market confidence; a model
    disagreement caps at standard (warning, no upgrade); warm-up blocks all."""
    if not warmup_ok:
        return None
    floor_std = settings.SURFACE_FLOOR_BASEBALL / 100
    floor_prem = settings.NEWSPORT_BASEBALL_PREMIUM / 100
    if conf >= floor_prem and model_agrees:
        return "premium"
    if conf >= floor_std:
        return "standard"
    return None


def build_unified_row(*, game: dict, mkt: dict, p_model: float, tier: str,
                      season: int, sp_home: str | None, sp_away: str | None,
                      fip_home: float, fip_away: float, flags: List[str],
                      recs: Dict[int, dict], now_iso: str) -> dict:
    """unified_predictions row per docs/NEWSPORTS-INTEGRATION.md."""
    home = game["teams"]["home"]["team"]
    away = game["teams"]["away"]["team"]
    rec_h = recs.get(home["id"]) or {}
    rec_a = recs.get(away["id"]) or {}
    p_home = round(mkt["p_home"], 4)
    pick_home = p_home >= 0.5
    conf = max(p_home, 1 - p_home)

    def run_form(rec: dict) -> Optional[float]:
        g = (rec.get("wins") or 0) + (rec.get("losses") or 0)
        if not g:
            return None
        return round((rec["runsScored"] - rec["runsAllowed"]) / g, 2)

    return {
        "sport": "baseball",
        "source_table": "mlb_model",
        "source_id": str(game["gamePk"]),
        "league": "MLB",
        "competition": f"MLB Regular Season {season}",
        "home_team": home["name"],
        "away_team": away["name"],
        "starts_at": game["gameDate"],
        "expires_at": game["gameDate"],
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
            "sp_home": sp_home,
            "sp_away": sp_away,
            "sp_home_fip_adj": round(fip_home, 2),
            "sp_away_fip_adj": round(fip_away, 2),
            "run_form_home": run_form(rec_h),
            "run_form_away": run_form(rec_a),
            "record_home": f"{rec_h.get('wins', '?')}-{rec_h.get('losses', '?')}",
            "record_away": f"{rec_a.get('wins', '?')}-{rec_a.get('losses', '?')}",
            "p_model": round(p_model, 4),
            "model_agrees": (p_model >= 0.5) == pick_home,
            "tier": tier,
            "flags": flags,
            "warm_up": False,  # a warm-up game never reaches this builder
        },
        "published_at": now_iso,
        "updated_at": now_iso,
    }


def match_odds_event(game: dict, events: List[dict]) -> Optional[dict]:
    """Team names AND start time within ±3h (lab audit C2: name-only matching
    grabbed the wrong doubleheader game, sometimes already live). Pops the
    matched event so a second doubleheader game can't reuse it."""
    home = game["teams"]["home"]["team"]["name"]
    away = game["teams"]["away"]["team"]["name"]
    try:
        g_ts = datetime.fromisoformat(game["gameDate"].replace("Z", "+00:00")).timestamp()
    except (KeyError, ValueError):
        return None
    for i, ev in enumerate(events):
        if ev["home_team"] != home or ev["away_team"] != away:
            continue
        try:
            e_ts = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00")).timestamp()
        except (TypeError, ValueError):
            continue
        if abs(e_ts - g_ts) < ODDS_MATCH_WINDOW_H * 3600:
            return events.pop(i)
    return None


class BaseballModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("BaseballModelAgent")

    async def _main_loop(self) -> None:
        if not settings.NEWSPORT_BASEBALL_AGENT_ENABLED:
            self.logger.info("NEWSPORT_BASEBALL_AGENT_ENABLED is off — agent idle (dark)")
            return
        while self._running:
            try:
                written = await self._compute_cycle()
                self.set_status_detail({"last_cycle_rows": written})
            except Exception as e:  # cycle-level fail-soft (base restarts on loop crash)
                self.logger.warning(f"cycle failed (will retry next cycle): {e}")
            await asyncio.sleep(CYCLE_SECONDS)

    async def _compute_cycle(self) -> int:
        now = datetime.now(timezone.utc)
        date_iso = now.date().isoformat()
        season = now.year

        games = await get_schedule(date_iso)
        if not games:
            return 0
        standings = await get_standings(season)
        prev = await get_prev_season(season)
        events = await get_h2h_events("MLB")
        if not events:
            self.logger.info("no MLB odds this cycle (key/quota/season) — skipping")
            return 0

        rows: List[dict] = []
        for game in games:
            if (game.get("status") or {}).get("abstractGameState") != "Preview":
                continue  # pre-match only

            mkt = None
            ev = match_odds_event(game, events)
            if ev:
                mkt = market_consensus(ev["books"])
            if not mkt:
                continue  # no market probability → nothing to serve (fail-closed)

            home = game["teams"]["home"]
            away = game["teams"]["away"]
            rec_h = standings.get(home["team"]["id"])
            rec_a = standings.get(away["team"]["id"])
            warmup_ok = bool(
                rec_h and rec_a
                and rec_h["wins"] + rec_h["losses"] >= MIN_GAMES
                and rec_a["wins"] + rec_a["losses"] >= MIN_GAMES
            )

            sp_home = (home.get("probablePitcher") or {}).get("fullName")
            sp_away = (away.get("probablePitcher") or {}).get("fullName")
            fip_h, fip_a = await asyncio.gather(
                get_pitcher_fip((home.get("probablePitcher") or {}).get("id"), season, prev["lgFip"]),
                get_pitcher_fip((away.get("probablePitcher") or {}).get("id"), season, prev["lgFip"]),
            )
            p_model = model_home_prob(
                pyth_prior_rating(rec_h, prev["winpct"].get(home["team"]["id"])),
                pyth_prior_rating(rec_a, prev["winpct"].get(away["team"]["id"])),
                fip_h["fip"], fip_a["fip"],
            )

            p_home = mkt["p_home"]
            conf = max(p_home, 1 - p_home)
            agrees = (p_model >= 0.5) == (p_home >= 0.5)
            tier = assign_tier(conf, agrees, warmup_ok)
            if not tier:
                continue  # below floor / warm-up: quality>volume, nothing written

            flags: List[str] = []
            if not agrees:
                flags.append("model disagrees (no tier upgrade)")
            if not sp_home or not sp_away:
                flags.append("probable pitcher missing")

            rows.append(build_unified_row(
                game=game, mkt=mkt, p_model=p_model, tier=tier, season=season,
                sp_home=sp_home, sp_away=sp_away,
                fip_home=fip_h["fip"], fip_away=fip_a["fip"],
                flags=flags, recs=standings, now_iso=now.isoformat(),
            ))

        written = await upsert_unified_rows(rows) if rows else 0
        self.logger.info(
            f"cycle: {len(games)} games, {len(rows)} picks above floor, {written} rows upserted"
        )
        return written
