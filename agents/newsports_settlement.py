"""
#NEWSPORTS-SETTLE-LEDGER-1008 — settlement e registro sigillato di MLB e UFC.

Prima di questo modulo nessun percorso regolava le righe baseball/mma: ogni
fetch del settlement (Python e cron TS) filtra sport=football, quindi una pick
MLB/UFC sarebbe rimasta senza esito per sempre e fuori dallo storico.

Regole (una per sport, nessuna "riusata" dal calcio):
- MLB: esito da statsapi per ``gamePk`` (= source_id), non per squadre+data
  (la doubleheader regolava gara 2 col punteggio di gara 1). Rinviata o
  cancellata = void. Pareggio ("Final: Tied") = void.
- UFC: esito da The Odds API /scores per id evento (= source_id). Punteggio
  pari / nessun vincitore (pareggio, no contest) = void: sul moneyline a due vie
  non è una sconfitta.
- Oltre ``UNRESOLVED_AFTER_H`` senza esito leggibile: ``unresolved`` (stato
  terminale senza timbro, come il tennis) — mai un void inventato.
- Il registro sigillato si regola sul pick SIGILLATO, non su quello servito:
  se la lettura del sigillo fallisce, la riga aspetta il ciclo dopo.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from core import mlb_stats_client
from core.odds_api_client import _fetch_scores, normalize_name
from core.supabase_client import (
    fetch_sealed_pick,
    fetch_unsettled_newsports_rows,
    record_pick_settlement,
    settle_unified_prediction,
)

logger = logging.getLogger("newsports_settlement")

MLB_MODEL_VERSION = "mlb-market-anchored-v1"
UFC_MODEL_VERSION = "ufc-market-anchored-v1"
MODEL_VERSION_BY_TABLE = {"mlb_model": MLB_MODEL_VERSION, "ufc_model": UFC_MODEL_VERSION}
UFC_SPORT_KEY = "mma_mixed_martial_arts"
UNRESOLVED_AFTER_H = 72.0   # /scores copre 3 giorni: oltre, la fonte non risponde più

_MLB_VOID_STATES = {"Postponed", "Cancelled"}
_MLB_FINAL_STATES = {"Final", "Game Over", "Completed Early"}


def classify_mlb(entries: list[dict]) -> Optional[dict]:
    """Voci statsapi di una gara → {'void': True} | {'home': int, 'away': int} | None."""
    states = [((g.get("status") or {}).get("detailedState") or "") for g in entries]
    if any(s in _MLB_VOID_STATES for s in states):
        return {"void": True}
    for g, s in zip(entries, states):
        if s in _MLB_FINAL_STATES or s.startswith("Final"):
            t = g.get("teams") or {}
            hs, as_ = (t.get("home") or {}).get("score"), (t.get("away") or {}).get("score")
            if hs is None or as_ is None:
                return None
            if int(hs) == int(as_):
                return {"void": True}
            return {"home": int(hs), "away": int(as_)}
    return None


def classify_ufc(event: Optional[dict], home: str, away: str) -> Optional[dict]:
    """Evento /scores → {'void': True} | {'home': x, 'away': y} | None (non ancora / illeggibile)."""
    if not event or not event.get("completed"):
        return None
    by_name = {}
    for s in event.get("scores") or []:
        try:
            by_name[normalize_name(s.get("name") or "")] = float(s.get("score"))
        except (TypeError, ValueError):
            return None
    h, a = by_name.get(normalize_name(home)), by_name.get(normalize_name(away))
    if h is None or a is None:
        return None
    if h == a:
        return {"void": True}
    return {"home": h, "away": a}


def grade(pick: Optional[str], res: dict) -> tuple[str, Optional[str]]:
    """(result, outcome) per un pick HOME/AWAY. outcome = lato vincente."""
    if res.get("void"):
        return "void", None
    outcome = "home" if res["home"] > res["away"] else "away"
    return ("won" if (pick or "").lower() == outcome else "lost"), outcome


def _hours_since(starts_at: str, now: datetime) -> float:
    try:
        s = datetime.fromisoformat(str(starts_at).replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    return (now - s).total_seconds() / 3600.0


def _score_text(res: dict) -> Optional[str]:
    if res.get("void"):
        return None
    return f"{res['home']:g}-{res['away']:g}"


async def _result_for(row: dict, ufc_scores: Optional[list]) -> Optional[dict]:
    if row.get("source_table") == "mlb_model":
        try:
            entries = await mlb_stats_client.get_game_entries(int(row["source_id"]))
        except (TypeError, ValueError):
            return None
        return classify_mlb(entries) if entries else None
    if row.get("source_table") == "ufc_model":
        ev = next((e for e in (ufc_scores or []) if e.get("id") == row.get("source_id")), None)
        return classify_ufc(ev, row.get("home_team") or "", row.get("away_team") or "")
    return None


async def settle_newsports_cycle(now: Optional[datetime] = None) -> int:
    """Un giro di settlement MLB/UFC. Ritorna le righe chiuse. Con zero righe
    baseball/mma (sport dark) non scrive nulla e non chiama fonti esterne."""
    now = now or datetime.now(timezone.utc)
    rows = await fetch_unsettled_newsports_rows()
    if not rows:
        return 0
    ufc_scores = None
    if any(r.get("source_table") == "ufc_model" for r in rows):
        ufc_scores = await _fetch_scores(UFC_SPORT_KEY)
    closed = 0
    for row in rows:
        mv = MODEL_VERSION_BY_TABLE.get(row.get("source_table"))
        if not mv:
            logger.warning("newsports settle: source_table sconosciuta %s", row.get("source_table"))
            continue
        res = await _result_for(row, ufc_scores)
        if res is None:
            if _hours_since(row.get("starts_at"), now) < UNRESOLVED_AFTER_H:
                continue
            result, outcome, score = "unresolved", None, None
        else:
            result, outcome = grade(row.get("pick"), res)
            score = _score_text(res)
        # Registro: si regola il pick SIGILLATO. Lettura fallita = si riprova dopo.
        ok, sealed = await fetch_sealed_pick(row["source_table"], str(row["source_id"]), mv)
        if not ok:
            continue
        if sealed:
            s_result = result if res is None else grade(sealed.get("pick"), res)[0]
            await record_pick_settlement(
                source_table=row["source_table"], source_id=str(row["source_id"]),
                model_version=mv, result=s_result, outcome=outcome, final_score=score,
            )
        source = "mlb-statsapi" if row["source_table"] == "mlb_model" else "odds-api-scores"
        if await settle_unified_prediction(
            str(row["id"]), result, final_score=score,
            verification_source=source if result in ("won", "lost") else None,
        ):
            closed += 1
            logger.info("newsports settled %s %s → %s (%s)", row.get("sport"),
                        row.get("source_id"), result, score)
    return closed
