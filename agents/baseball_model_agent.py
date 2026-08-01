"""
Baseball (MLB) model agent — #NEWSPORTS Gate 2 (lab am-lab/nuovi-sport).

Port Python dell'harness di shadow validato `mlb_v2.mjs`, **versione v2.2**
(loop premium 14/07: TRAIN 2011-17 + una sola run sul TEST 2018-21 con config
congelata → standard 65 = 68,3% su n=641, premium 72 = 76,8% su n=95,
consistenza TRAIN→TEST 77,0→76,8).

⚠️ #NEWSPORTS-V22-0801 — questo file era rimasto alla generazione PRE-autopsia:
aveva solo floor + accordo-modello + warm-up, e i floor del Gate 1 (62/65).
Mancavano le TRE regole nate dall'autopsia del primo shadow, che è il motivo per
cui quel primo shadow aveva chiuso il tier premium a 3/9. Mergiarlo così avrebbe
riprodotto lo stesso crollo in produzione. Le tre regole ci sono ora, e sono:

  1. CAP SERIE (v2.1) — una pick sulla stessa coppia di squadre blocca la serie
     per NEWSPORT_BASEBALL_SERIES_CAP_DAYS giorni. Otto delle nove premium del
     primo shadow erano lo stesso bet ripetuto per tutto l'homestand dei
     Dodgers: nove righe e un solo esito indipendente. Sui 10 anni il cap alza
     il premium da 77,4% a 78,6% proprio togliendo i duplicati.
  2. FLAG OPENER (v2.1) — un rilievo listato come partente probabile (molte
     presenze, quasi zero partenze) rende falso il "duello fra i partenti" su
     cui poggia il why. Flag, non blocco: la probabilità è del mercato e resta
     valida, il why non deve raccontare un duello che non c'è.
  3. TIER AL QUASI-CLOSE (v2.2) — il tier si assegna solo entro
     NEWSPORT_BASEBALL_LATE_WINDOW_HOURS ore dal primo lancio. Gli stessi floor
     sulla quota di APERTURA rendono 73,2% contro il 76,8% alla close: il tier
     pubblicato deve essere quello di quando la linea è matura. Prima della
     finestra la partita non si serve — stesso principio della finestra 2-30h
     dell'agente UFC.

Il declassamento "eps" della v2.1 (premium solo se il modello sta entro 2pt dal
mercato) NON c'è: il loop premium l'ha REVERTATO, perché sui dieci anni le bande
di dissenso non sono monotone (69,8 / 78,0 / 64,4 / 71,7 / 71,1 / 67,1%) — era
una regola letta su n=14 di shadow. Resta il solo requisito di accordo per il
premium, che sui 10 anni discrimina.

Architettura (identica a football/tennis, probability-neutral):
  * probabilità SERVITA = mercato devigato (Pinnacle preferito, mediana vera
    come fallback) — il modello non la muove MAI.
  * selettività = i floor di surfacing (settings.SURFACE_FLOOR_BASEBALL /
    NEWSPORT_BASEBALL_PREMIUM).
  * il modello era_g010/FIP alimenta solo il why (duello partenti FIP-adj, forma
    sui run, record) e l'avviso di dissenso (nessun upgrade di tier).

Regole di prodotto non negoziabili (report Gate 1):
  solo regular season · solo pre-match · warm-up 20 partite per squadra ·
  match quote doubleheader-safe (squadre E orario ±3h, audit C2).

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
from core.supabase_client import fetch_recent_sport_pairs, upsert_unified_rows

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
    """Tier v2.2: floor inclusivi sulla confidenza di mercato; il dissenso del
    modello tiene al massimo standard (avviso, nessun upgrade); il warm-up
    blocca tutto."""
    if not warmup_ok:
        return None
    floor_std = settings.SURFACE_FLOOR_BASEBALL / 100
    floor_prem = settings.NEWSPORT_BASEBALL_PREMIUM / 100
    if conf >= floor_prem and model_agrees:
        return "premium"
    if conf >= floor_std:
        return "standard"
    return None


def pair_key(a: str, b: str) -> str:
    """Chiave della serie: coppia di squadre indipendente da chi è in casa (in
    una serie MLB il fattore campo non cambia fra le partite). Identica a
    pairKey di mlb_v2.mjs."""
    return "|".join(sorted([(a or "").strip().lower(), (b or "").strip().lower()]))


def series_capped(
    home: str, away: str, now: datetime, recent: List[dict], cap_days: int
) -> bool:
    """True se su questa serie è già stata pubblicata una pick entro cap_days.

    `recent` sono le righe già pubblicate per lo sport (home_team, away_team,
    published_at). Una data illeggibile viene trattata come DENTRO la finestra:
    fail-closed, perché il costo di una pick in meno è nullo e quello di un
    campione correlato è un tier che mente.
    """
    if cap_days <= 0:
        return False
    key = pair_key(home, away)
    for row in recent:
        if pair_key(row.get("home_team") or "", row.get("away_team") or "") != key:
            continue
        raw = row.get("published_at")
        if not raw:
            return True
        try:
            when = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return True
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        if abs((now - when).total_seconds()) <= cap_days * 86400:
            return True
    return False


def hours_to_start(game_date: str | None, now: datetime) -> Optional[float]:
    """Ore che mancano al primo lancio. None se la data non è leggibile — e il
    chiamante in quel caso NON pubblica (non si può sapere se la linea è matura)."""
    if not game_date:
        return None
    try:
        start = datetime.fromisoformat(str(game_date).replace("Z", "+00:00"))
    except ValueError:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return (start - now).total_seconds() / 3600.0


def opener_flag(name: str | None, fip: dict) -> Optional[str]:
    """Flag 'possibile opener': tanti ingressi, quasi nessuna partenza. Soglie
    identiche al lab (games >= 5 e starts <= 1)."""
    if not name:
        return None
    if (fip.get("games") or 0) >= 5 and (fip.get("starts") or 0) <= 1:
        return (
            f"possibile opener: {name} "
            f"({fip.get('starts') or 0} partenze su {fip.get('games') or 0} presenze) "
            "— il duello fra i partenti non è indicativo"
        )
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

        # Cap serie: lo storico delle pick già pubblicate. Se la lettura fallisce
        # torna [] e sotto NON pubblichiamo — fail-closed, perché senza storico
        # non si può escludere di stare duplicando una serie.
        cap_days = settings.NEWSPORT_BASEBALL_SERIES_CAP_DAYS
        recent_pairs = await fetch_recent_sport_pairs("baseball", cap_days) if cap_days > 0 else []
        cap_readable = bool(recent_pairs) or cap_days <= 0
        if cap_days > 0 and not recent_pairs:
            # Distinguere "nessuna pick recente" da "lettura fallita" non è
            # possibile con una lista vuota: si prova una seconda volta e, se
            # ancora vuota, si assume il caso benigno solo quando il DB risponde.
            probe = await fetch_recent_sport_pairs("baseball", 3650)
            cap_readable = isinstance(probe, list)
            if not cap_readable:
                self.logger.warning("storico pick non leggibile: nessuna pick questo ciclo (fail-closed)")
                return 0

        rows: List[dict] = []
        published_this_cycle: List[dict] = []
        for game in games:
            if (game.get("status") or {}).get("abstractGameState") != "Preview":
                continue  # pre-match only

            # Tier al quasi-close (v2.2): fuori dalla finestra non si serve.
            hrs = hours_to_start(game.get("gameDate"), now)
            if hrs is None:
                continue  # orario illeggibile → non si può sapere se la linea è matura
            if hrs > settings.NEWSPORT_BASEBALL_LATE_WINDOW_HOURS:
                continue  # troppo presto: la quota di apertura vale 73,2%, non 76,8%
            if hrs <= 0:
                continue  # già iniziata

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

            # Cap serie (v2.1): una pick già presa su questa coppia entro la
            # finestra blocca. Si guarda sia lo storico del DB sia le pick di
            # QUESTO ciclo — un doubleheader presenta due volte la stessa coppia
            # nello stesso giro, e senza il secondo controllo il cap lo mancherebbe.
            if series_capped(
                home["team"]["name"], away["team"]["name"], now,
                recent_pairs + published_this_cycle, cap_days,
            ):
                self.logger.info(
                    "cap serie: pick già presa su %s vs %s, salto",
                    away["team"]["name"], home["team"]["name"],
                )
                continue

            flags: List[str] = []
            if not agrees:
                flags.append("il modello discorda (nessun upgrade di tier)")
            if not sp_home or not sp_away:
                flags.append("lanciatore probabile mancante")
            # Flag opener (v2.1): il why non deve raccontare un duello inesistente.
            for name, fip in ((sp_home, fip_h), (sp_away, fip_a)):
                flag = opener_flag(name, fip)
                if flag:
                    flags.append(flag)

            published_this_cycle.append({
                "home_team": home["team"]["name"],
                "away_team": away["team"]["name"],
                "published_at": now.isoformat(),
            })
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
