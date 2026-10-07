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
import re
import time
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from agents.base import BaseAgent
from config.settings import settings
from core.odds_api_client import consensus_is_fresh, get_h2h_events, market_consensus
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
            # `text`: tutto ciò che il tier gratuito dice dei fighter della card
            # (titolo + titolo alternativo + descrizione). Serve a
            # bout_in_card; vedi la nota lì sui limiti.
            text = " ".join(
                str(e.get(k) or "") for k in ("strEvent", "strEventAlternate", "strDescriptionEN")
            )
            windows.append({"name": e.get("strEvent"), "start_ms": start, "text": text})
        if windows:
            _windows_cache = (now, windows)
        return windows or None
    except Exception as e:
        logger.warning(f"TheSportsDB unreachable: {e}")
        if _windows_cache:
            return _windows_cache[1]  # stale beats nothing
        return None  # fail-closed


def card_windows_at(commence_ms: float, windows: list) -> List[dict]:
    """Tutte le card la cui finestra (-3h early prelims, +9h coda) contiene
    l'orario del fight."""
    return [
        w for w in windows
        if w["start_ms"] - 3 * 3.6e6 <= commence_ms <= w["start_ms"] + 9 * 3.6e6
    ]


def match_ufc_event(commence_ms: float, windows: list) -> Optional[str]:
    """UFC cards run ~6-8h from the listed start; margin -3h (early prelims)
    to +9h. A fight outside every card window is not (verifiably) UFC.
    ⚠️ È una verifica SOLO TEMPORALE: non prova che il bout sia nella card
    (vedi verify_bout_card)."""
    hits = card_windows_at(commence_ms, windows)
    return hits[0]["name"] if hits else None


# ─── Appartenenza del bout alla card (#NEWSPORTS-QUALITA-1006) ────────────────
# Prima: un fight era "UFC verificato" (org_verified=true) se il suo orario
# cadeva nella finestra di una card TheSportsDB — che non prova che QUEI due
# fighter siano nel programma. Cosa offre il tier gratuito (misurato il 6/10/2026
# con la chiave pubblica 123): eventsnextleague / lookupevent danno la CARD
# (strEvent "UFC 332 Silva vs Wang", strDescriptionEN in prosa, spesso vuota —
# vuota per le DWCS), strHomeTeam/strAwayTeam null; lookuplineup, eventresults
# e lookuptimeline tornano null per gli eventi UFC. Una lista strutturata dei
# bout NON c'è. Quindi:
#   * "bout_in_card": entrambi i fighter (tutti i token del nome, accenti e
#     ordine normalizzati) compaiono nel testo della card — tipicamente main
#     event e co-main. Solo qui org_verified=true.
#   * "time_only": la finestra torna ma i nomi no. La pick resta (il filtro
#     d'orario è quello validato in lab) ma org_verified=false: non si dichiara
#     una verifica che non è stata fatta.
# Limite dichiarato: la prosa può nominare due fighter che non si affrontano
# (es. "dopo le vittorie su X"): "bout_in_card" = "entrambi nominati dalla
# card", non "incontro confermato da un programma ufficiale".
_NAME_TOKEN_RE = re.compile(r"[a-z0-9]+")


def normalize_name_tokens(name: str | None) -> frozenset:
    """Token del nome senza accenti, minuscoli, punteggiatura via; insieme,
    quindi indipendente dall'ordine ("Wang Cong" == "Cong Wang")."""
    if not name:
        return frozenset()
    flat = unicodedata.normalize("NFKD", str(name))
    flat = "".join(c for c in flat if not unicodedata.combining(c)).lower()
    flat = flat.replace("'", "").replace("\u2019", "")  # O'Malley -> omalley
    return frozenset(_NAME_TOKEN_RE.findall(flat))


def bout_in_card(fighter_a: str, fighter_b: str, window: dict) -> bool:
    """True se ENTRAMBI i fighter compaiono (tutti i token) nel testo della card."""
    card = normalize_name_tokens(window.get("text") or window.get("name"))
    ta, tb = normalize_name_tokens(fighter_a), normalize_name_tokens(fighter_b)
    if not ta or not tb or not card:
        return False
    return ta <= card and tb <= card


def verify_bout_card(fighter_a: str, fighter_b: str, commence_ms: float,
                     windows: list) -> tuple[Optional[str], Optional[str]]:
    """(nome card, livello di verifica). Livello: "bout_in_card" se una card
    nella finestra nomina entrambi i fighter, "time_only" se torna solo
    l'orario, (None, None) se il fight non cade in nessuna card."""
    hits = card_windows_at(commence_ms, windows)
    if not hits:
        return None, None
    for w in hits:
        if bout_in_card(fighter_a, fighter_b, w):
            return w["name"], "bout_in_card"
    return hits[0]["name"], "time_only"


# ─── Card di sviluppo escluse (#NEWSPORTS-DWCS-EXCL-0921, port dal lab) ───────
# Port di DEV_CARD_RE di ufc_v2.mjs: Dana White's Contender Series e Road to
# UFC sono escluse dalle pick FUTURE (regola pre-registrata il 21/09). Il
# motivo che regge è OPERATIVO: sono la sorgente della coda di settlement
# manuale (lo scores endpoint copre 3 giorni e Wikipedia non pubblica i bout
# DWCS), quindi il ledger resta cieco a tratti; il motivo di qualità è debole
# (78,8% card principali vs 75,0% DWCS/RTU, n=16). TheSportsDB scrive "Dana
# Whites Contender Series" senza apostrofo: la regex guarda "contender series".
_DEV_CARD_RE = re.compile(r"contender series|road to ufc", re.I)


def is_development_card(event_name: str | None) -> bool:
    return bool(event_name) and bool(_DEV_CARD_RE.search(event_name))


def assign_tier(conf: float) -> Optional[str]:
    floor_std = settings.SURFACE_FLOOR_MMA / 100
    floor_prem = settings.NEWSPORT_MMA_PREMIUM / 100
    if conf >= floor_prem:
        return "premium"
    if conf >= floor_std:
        return "standard"
    return None


def build_unified_row(*, ev: dict, mkt: dict, tier: str, ufc_event: str,
                      hours_to_fight: float, flags: List[str], now_iso: str,
                      org_verification: str) -> dict:
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
        "event_name": f"{ev['home_team']} vs {ev['away_team']}",
        "home_team": ev["home_team"],
        "away_team": ev["away_team"],
        "starts_at": ev["commence_time"],
        "expires_at": ev["commence_time"],
        "pick": "HOME" if pick_home else "AWAY",
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
            "p_draw": None,
            "p_away": round(1 - p_home, 4),
            "odds_home": mkt["odds_home"],
            "odds_away": mkt["odds_away"],
            "mkt_source": mkt["source"],
            "n_books": mkt["n_books"],
            # #NEWSPORTS-QUALITA-1006: quote derivate (mediana pari) e età della quota
            "odds_derived": bool(mkt.get("odds_derived")),
            "odds_last_update": mkt.get("last_update"),
        }),
        "enrichment": {
            "tier": tier,
            # true SOLO se la card nomina entrambi i fighter; "time_only" = la
            # sola finestra oraria, che non prova l'appartenenza del bout.
            "org_verified": org_verification == "bout_in_card",
            "org_verification": org_verification,
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
        dev_cards = 0
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
            if not consensus_is_fresh(mkt, now, settings.NEWSPORT_ODDS_MAX_AGE_HOURS):
                continue  # quota stantia o età illeggibile (#NEWSPORTS-FIX-REVIEW-1007)
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
            ufc_event, verification = verify_bout_card(
                ev["home_team"], ev["away_team"], commence_ms, windows,
            )
            if not ufc_event:
                continue  # non-UFC org or unverifiable
            if is_development_card(ufc_event):
                dev_cards += 1
                continue  # DWCS / Road to UFC: fuori dalle pick (#NEWSPORTS-DWCS-EXCL-0921)
            if fighter_counts[ev["home_team"]] > 1 or fighter_counts[ev["away_team"]] > 1:
                continue  # ambiguous matchup

            flags: List[str] = []
            if verification != "bout_in_card":
                flags.append("card verificata solo per orario: fighter non nominati dalla card")
            rows.append(build_unified_row(
                ev=ev, mkt=mkt, tier=tier, ufc_event=ufc_event,
                hours_to_fight=hours, flags=flags, now_iso=now.isoformat(),
                org_verification=verification,
            ))

        # keep_published_at: il bout è riscritto a ogni ciclo della finestra 2-30h,
        # ma published_at resta la PRIMA pubblicazione (#NEWSPORTS-FIX-REVIEW-1007:
        # prima ogni ciclo lo sovrascriveva con `now`).
        written = await upsert_unified_rows(rows, keep_published_at=True) if rows else 0
        self.logger.info(
            f"cycle: {len(events)} fights in feed, {len(rows)} picks in window, "
            f"{waiting} candidates waiting (> {MAX_H}h), {dev_cards} on development cards "
            f"(excluded), {written} rows upserted"
        )
        return written
