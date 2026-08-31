"""#LEDGER-MIRROR-0831 — chiude nel registro i pick SIGILLATI rimasti orfani.

NON ESEGUIRE senza APPROVE di Andrea (= write su produzione, su
`pick_settlement`). Questo script e' l'esecutore della proposta gated: scritto,
verificato e idempotente, ma NON eseguito qui.

IL BUCO CHE CHIUDE
  `pick_ledger` promette che ogni riga sigillata ha il suo esito in
  `pick_settlement`. Misurato su produzione il 31/08: 88 pick sigillati con la
  partita iniziata da piu' di sei ore e nessuna riga di chiusura, dal 27/06 al
  29/08. Tre cause, tutte lato scrittura e nessuna sul dato:

    60 righe 'unresolved'  -> lo step E di app/api/cron/settle chiudeva la riga
                              servita dopo 48h e non scriveva il mirror;
    17 righe 'void'        -> il ramo void-abbandonata di
                              agents/result_settlement.py, stesso buco;
     8 righe 'won'/'lost'  -> 27/06-11/07, precedenti all'introduzione del
                              mirror: residuo storico.

  Le due cause attive sono chiuse nel codice dallo stesso commit di questo file.
  Questo script serve al RESIDUO: le righe gia' perse non tornano da sole,
  perche' entrambi i percorsi di settlement filtrano su `result IS NULL` e la
  riga servita ormai un risultato ce l'ha.

DA DOVE PRENDE L'ESITO
  Dalla riga servita in `unified_predictions`, che l'esito ce l'ha gia': non si
  ricontatta nessun provider e non si ricalcola niente. Se la riga servita non
  ha un `result`, il pick viene SALTATO e contato: non si inventa una chiusura.

COSA NON SCRIVE
  `closing_odds` e' sempre NULL. Non per prudenza: misurato il 31/08, nelle
  ultime 30 giornate le righe `is_closing` di `odds_snapshots` sono 1.410, ma
  1.169 vengono da stake/roobet — la via che per regola di sistema alimenta solo
  la misura, mai il prodotto — e le 241 di `odds_api` coprono OTTO partite,
  nessuna delle quali compare in `pick_ledger`. La sovrapposizione fra «partite
  con una chiusura» e «partite su cui abbiamo dato un pick» e' ZERO, quindi ogni
  CLV scritto qui sarebbe inventato.

IMMUTABILITA' E IDEMPOTENZA
  Solo INSERT. `is_backfill=TRUE` tiene queste righe distinguibili per sempre da
  quelle scritte in avanti. Il dedup e' sul terno (source_table, source_id,
  model_version) che ha un indice UNIQUE (`pick_settlement_pick_key`, verificato
  su produzione), quindi un secondo giro e' un no-op.

USO (gated)
  .venv/Scripts/python.exe -m scripts.backfill_sealed_orphans --dry-run
  .venv/Scripts/python.exe -m scripts.backfill_sealed_orphans --apply
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone

import httpx

# Gli helper REST stanno nel backfill sorella: stesso package, stesse credenziali,
# stesso contratto. Riusarli e' meglio che una seconda copia che diverge — la
# lezione della chiave scritta a mano in tre posti.
from scripts.backfill_pick_ledger import _headers, _insert, _rest, _select, _to_result

log = logging.getLogger("backfill_sealed_orphans")

SOURCE_TABLE = "match_predictions"
GRACE_HOURS = 6
# PostgREST TRONCA la risposta a 1000 righe ignorando `limit` (misurato il
# 28/08 su odds_snapshots: una finestra da 7409 tornava tagliata a 1000). Qui le
# tabelle sono piccole, ma paginare e' l'unico modo di non dipendere da quel
# fatto: una pagina piena vuol dire «forse ce n'e' ancora».
PAGE = 1000


def _cutoff_iso() -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=GRACE_HOURS)).isoformat()


def _select_all(client: httpx.Client, table: str, params: dict[str, str]) -> list[dict]:
    """Tutte le righe, a pagine. Una pagina piena non prova che sia finita."""
    fuori: list[dict] = []
    offset = 0
    while True:
        p = dict(params) | {"limit": str(PAGE), "offset": str(offset)}
        blocco = _select(client, table, p)
        fuori.extend(blocco)
        if len(blocco) < PAGE:
            return fuori
        offset += PAGE


def outcome_from_score(final_score: str | None) -> str | None:
    """HOME/DRAW/AWAY dal punteggio finale. `None` senza punteggio: una partita
    abbandonata o mai scorata non ha un esito realizzato, e inventarne uno
    metterebbe una bugia sulla prova pubblica."""
    if not final_score or "-" not in final_score:
        return None
    casa, _, fuori = final_score.partition("-")
    try:
        c, f = int(casa.strip()), int(fuori.strip())
    except ValueError:
        return None
    return "DRAW" if c == f else ("HOME" if c > f else "AWAY")


def _final_score_from_notes(notes) -> str | None:
    """`notes` e' una colonna TEXT che porta un JSON; il punteggio ci viene
    unito da mergeFinalScore / settle_unified_prediction. Tollerante per
    costruzione: qualunque forma inattesa vale «nessun punteggio»."""
    import json

    if isinstance(notes, dict):
        v = notes.get("final_score")
        return str(v) if v else None
    if isinstance(notes, str) and notes.strip():
        try:
            obj = json.loads(notes)
        except ValueError:
            return None
        if isinstance(obj, dict) and obj.get("final_score"):
            return str(obj["final_score"])
    return None


def sealed_orphans(client: httpx.Client) -> list[dict]:
    """I pick sigillati, oltre la grazia, senza riga di chiusura."""
    ledger = _select_all(
        client,
        "pick_ledger",
        {
            "select": "source_table,source_id,model_version,sport,home_team,away_team,commence_time",
            "source_table": f"eq.{SOURCE_TABLE}",
            # Il cutoff si calcola QUI: PostgREST non valuta `now()`, passa il
            # valore a Postgres come letterale e "now()-6hours" non e' un
            # timestamp valido.
            "commence_time": f"lt.{_cutoff_iso()}",
            "order": "commence_time.asc",
        },
    )
    chiuse = {
        (r["source_table"], str(r["source_id"]), r["model_version"])
        for r in _select_all(
            client,
            "pick_settlement",
            {"select": "source_table,source_id,model_version"},
        )
    }
    return [
        r
        for r in ledger
        if (r["source_table"], str(r["source_id"]), r["model_version"]) not in chiuse
    ]


def served_rows(client: httpx.Client, source_ids: list[str]) -> dict[str, dict]:
    """Le righe servite corrispondenti, per `external_event_id`. A blocchi: un
    `in.(...)` con 88 id sta in un URL, con 900 no."""
    fuori: dict[str, dict] = {}
    for i in range(0, len(source_ids), 50):
        blocco = source_ids[i : i + 50]
        # Le virgole dentro un id romperebbero la lista PostgREST; gli id sono
        # `espn:<n>`, `oddsapi:<hex>` o numerici, ma si citano comunque.
        lista = ",".join(f'"{x}"' for x in blocco)
        for r in _select(
            client,
            "unified_predictions",
            {
                "select": "external_event_id,sport,result,notes,settled_at",
                "sport": "eq.football",
                "external_event_id": f"in.({lista})",
            },
        ):
            fuori[str(r["external_event_id"])] = r
    return fuori


def settlement_row(orfana: dict, servita: dict) -> dict:
    punteggio = _final_score_from_notes(servita.get("notes"))
    return {
        "source_table": orfana["source_table"],
        "source_id": str(orfana["source_id"]),
        "model_version": orfana["model_version"],
        "result": _to_result(servita.get("result")),
        "outcome": outcome_from_score(punteggio),
        "final_score": punteggio,
        "closing_odds": None,
        "is_backfill": True,
    }


def run(apply: bool) -> int:
    with httpx.Client(timeout=30.0) as client:
        orfane = sealed_orphans(client)
        log.info("pick sigillati orfani oltre le %sh: %d", GRACE_HOURS, len(orfane))
        if not orfane:
            return 0

        servite = served_rows(client, [str(o["source_id"]) for o in orfane])
        righe: list[dict] = []
        senza_riga_servita = 0
        senza_esito = 0
        for o in orfane:
            s = servite.get(str(o["source_id"]))
            if s is None:
                senza_riga_servita += 1
                continue
            if not s.get("result"):
                # La riga servita e' ancora aperta: la chiusura la scrivera' il
                # settlement quando l'esito arriva. Non e' un orfano da sanare.
                senza_esito += 1
                continue
            righe.append(settlement_row(o, s))

        per_esito: dict[str, int] = {}
        for r in righe:
            per_esito[r["result"]] = per_esito.get(r["result"], 0) + 1
        log.info("da scrivere: %d  %s", len(righe), per_esito)
        log.info(
            "saltati: %d senza riga servita, %d ancora senza esito",
            senza_riga_servita,
            senza_esito,
        )
        con_punteggio = sum(1 for r in righe if r["final_score"])
        log.info(
            "con punteggio finale: %d/%d (le altre restano senza outcome, non con un outcome finto)",
            con_punteggio,
            len(righe),
        )

        if not apply:
            for r in righe[:10]:
                log.info("  DRY %s %s -> %s %s", r["source_id"], r["model_version"], r["result"], r["final_score"])
            log.info("DRY-RUN: nessuna scrittura. Servono --apply e l'APPROVE di Andrea.")
            return 0

        _insert(
            client,
            "pick_settlement",
            righe,
            on_conflict="source_table,source_id,model_version",
        )
        log.info("scritte %d righe di chiusura (is_backfill=TRUE)", len(righe))
        restanti = len(sealed_orphans(client))
        log.info("orfani rimasti dopo la scrittura: %d", restanti)
        return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser(description="#LEDGER-MIRROR-0831 (gated)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true", help="stampa, non scrive")
    g.add_argument("--apply", action="store_true", help="scrive (serve APPROVE)")
    a = ap.parse_args(argv)
    if not settings_ok():
        log.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY non configurate")
        return 2
    return run(apply=bool(a.apply))


def settings_ok() -> bool:
    try:
        return bool(_rest()) and bool(_headers().get("apikey"))
    except Exception:
        return False


if __name__ == "__main__":
    sys.exit(main())
