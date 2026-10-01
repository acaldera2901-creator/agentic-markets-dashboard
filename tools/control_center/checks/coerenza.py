"""La coerenza del prodotto: cio' che pubblichiamo combacia con cio' che il DB dice?

#CERTIFICA-1001. Ogni pezzo del prodotto puo' essere corretto da solo e il
prodotto incoerente lo stesso: il 30/09 il tennis e' sparito da
unified_predictions per un giorno e nessun check e' diventato rosso, perche'
tennis_predictions era fresca e il board tennis la leggeva direttamente. Questi
controlli confrontano DUE posti che devono dire la stessa cosa.

Ogni verdetto porta in `evidence` la `soglia` e il `riparo`: `lab certifica
prodotto` li stampa cosi' come sono, e la torre mostra lo stesso verdetto.
"""

import csv
import datetime
import glob
import json
import os
import shutil
import subprocess
import threading
import time
import urllib.request
from pathlib import Path

from ..contract import Check, Verdict, amber, green, red, unknown
from ..db import REPO_ROOT, DbUnavailable, fetch_all

HISTORY_URL = "https://www.betredge.com/api/v2/history?limit=1"


# ── 1 · parita' sport: sorgente vs unified ──────────────────────────────────
# Baseline misurata l'01/10 sulle partite dal 25 al 29/09: 97-100% delle righe
# sorgente avevano la loro riga in unified, per entrambi gli sport. Il 30/09
# il tennis e' sceso a 0 (il cron moriva a 300s prima dello step tennis).
# Sotto PARITA_RED il prodotto pubblico (track record, Telegram, ledger) non
# vede piu' la maggior parte di quello che il board mostra. Fra le due soglie
# sta il ritardo legittimo: le righe nuove entrano in unified al giro dopo del
# cron (2h), e un lotto del partner feed puo' arrivare tutto insieme.
# PARITA_AMBER (90%) e' motivata dalla baseline 97-100% del 25-29/09.
# PARITA_RED (70%) e' un valore TONDO, non misurato: nessun dato dice dove
# finisce il ritardo legittimo. Da ritarare dopo un mese di storico.
PARITA_RED = 0.70
# Si contano partite DISTINTE su entrambi i lati: una join su unified con
# righe duplicate per source_id moltiplicherebbe le abbinate (150% = verde).
# I duplicati si misurano a parte, e oltre il 110% la quota e' un'anomalia.
PARITA_ANOMALIA = 1.10
PARITA_AMBER = 0.90

_PARITA = {
    "tennis": (
        "select count(distinct s.match_id), count(distinct u.source_id), count(u.id) "
        "from tennis_predictions s "
        "left join unified_predictions u on u.source_table = 'tennis_predictions' "
        "and u.source_id = s.match_id where s.scheduled_at > now()",
        "tennis_predictions",
    ),
    "calcio": (
        "select count(distinct s.match_id), count(distinct u.source_id), count(u.id) "
        "from match_predictions s "
        "left join unified_predictions u on u.source_table = 'match_predictions' "
        "and u.source_id = s.match_id where s.kickoff > now()",
        "match_predictions",
    ),
}


def check_parita(sport: str) -> Verdict:
    sql, tabella = _PARITA[sport]
    fonte = f"db:{tabella}+unified_predictions"
    soglia = f">= {PARITA_AMBER:.0%} (rosso sotto {PARITA_RED:.0%} o a 0)"
    try:
        righe = fetch_all(sql)
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", fonte)
    sorgente, unificate = int(righe[0][0] or 0), int(righe[0][1] or 0)
    righe_unified = int(righe[0][2] or 0)
    prova = {"sorgente": sorgente, "unified": unificate, "righe_unified": righe_unified,
             "soglia": soglia,
             "riparo": f"il sync {tabella} -> unified_predictions non sta girando: "
                       "guarda lo step dello sport in /api/predictions/refresh"}
    if sorgente == 0:
        return unknown(f"nessuna partita {sport} futura in {tabella}: niente da confrontare",
                       fonte, evidence=prova)
    quota = unificate / sorgente
    testo = f"{unificate}/{sorgente}"
    if quota > PARITA_ANOMALIA:
        return red(f"{sport}: {testo} partite abbinate, piu' della sorgente: misura anomala",
                   fonte, value=testo, evidence=prova)
    if unificate == 0 or quota < PARITA_RED:
        return red(f"{sport}: {testo} partite future arrivano in unified_predictions",
                   fonte, value=testo, evidence=prova)
    if quota < PARITA_AMBER:
        return amber(f"{sport}: {testo} partite future in unified_predictions",
                     fonte, value=testo, evidence=prova)
    if righe_unified > unificate * PARITA_ANOMALIA:
        return amber(f"{sport}: {righe_unified} righe unified per {unificate} partite: duplicati",
                     fonte, value=testo, evidence=prova)
    return green(f"{sport}: {testo} partite future in unified_predictions",
                 fonte, value=testo, evidence=prova)


# ── 5 · freschezza per lega ─────────────────────────────────────────────────
# predictions_freshness guarda il max() globale: una lega che il refresh salta
# resta invisibile finche' ne gira almeno un'altra. Il refresh e' ogni 2h; la
# lega piu' vecchia misurata l'01/10 era a 5,7h. Oltre 12h una lega ha perso
# sei giri di fila. Solo le leghe con partite nei prossimi 7 giorni: una lega
# in pausa non deve diventare rossa.
LEGA_RED_ORE = 12


def check_freschezza_leghe() -> Verdict:
    fonte = "db:match_predictions"
    try:
        righe = fetch_all(
            "select league, extract(epoch from now() - max(computed_at)) / 3600 "
            "from match_predictions "
            "where kickoff between now() and now() + interval '7 days' "
            "group by 1 order by 2 desc"
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", fonte)
    if not righe:
        return unknown("nessuna lega con partite nei prossimi 7 giorni", fonte)
    vecchie = [(lega, round(float(ore), 1)) for lega, ore in righe if float(ore) > LEGA_RED_ORE]
    prova = {"leghe": len(righe), "ferme": vecchie, "soglia": f"<= {LEGA_RED_ORE}h per lega",
             "riparo": "la lega non entra piu' nel giro di /api/predictions/refresh: "
                       "controlla la sua fetch nel log del cron"}
    if vecchie:
        nomi = ", ".join(f"{lega} {ore}h" for lega, ore in vecchie[:6])
        return red(f"{len(vecchie)} leghe su {len(righe)} ferme oltre {LEGA_RED_ORE}h: {nomi}",
                   fonte, value=len(vecchie), evidence=prova)
    peggiore = round(float(righe[0][1]), 1)
    return green(f"{len(righe)} leghe tutte entro {LEGA_RED_ORE}h (la piu' vecchia {peggiore}h)",
                 fonte, value=f"{peggiore}h", evidence=prova)


# ── 2 e 3 · /history ricalcolato col codice vero ────────────────────────────
class ReplayUnavailable(Exception):
    """tsx, node o l'API non disponibili: il confronto diventa '?', mai verde."""


# Le stesse condizioni WHERE, lo stesso ORDER e lo stesso LIMIT di
# app/api/v2/history/route.ts (STATS_CAP 5000). La LOGICA invece non si copia:
# la esegue history_replay.ts importando le funzioni della route.
_ROUTE_SQL = """
select id, sport, competition, event_name, home_team, away_team,
       player_one, player_two, market, pick, status,
       result, signal_type, is_paper, is_verified, is_demo,
       starts_at, settled_at, notes, world_cup_stage, group_name,
       confidence_score, verification_state, is_historical
from unified_predictions
where is_historical = true and is_demo = false
  and result is distinct from 'unresolved' and published_at is not null
order by starts_at desc nulls last, settled_at desc nulls last, id desc
limit 5000
"""

# Il denominatore onesto: ogni pick pubblicata la cui partita e' finita da
# oltre 48h, qualunque sia il suo esito (unresolved e NULL compresi).
_FINITE_SQL = """
select sport, competition, market, home_team, away_team, pick, notes, result,
       starts_at, settled_at, confidence_score, verification_state, is_historical
from unified_predictions
where is_demo = false and published_at is not null and pick is not null
  and starts_at < now() - interval '48 hours'
order by starts_at desc nulls last, settled_at desc nulls last, id desc
limit 20000
"""
# Tetto difensivo, non una finestra: la copertura e' all-time come l'headline.
# L'01/10 le righe erano ~1/3 del tetto. Se lo si tocca, la popolazione e'
# troncata e copertura_onesta diventa '?' invece di misurare una parte.
FINITE_MAX = 20000

# Stessa serializzazione dell'RPC exec_sql che usa la route (lib/db.ts): i
# timestamp arrivano come le stesse stringhe, e il dedup li confronta come tali.
_AS_JSON = "select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from ({q}) t"

_SCRIPT = Path(__file__).with_name("history_replay.ts")
_CACHE: dict = {}
_LOCK = threading.Lock()
_CACHE_S = 60  # i due check dello stesso giro condividono una sola misura


def _node() -> str | None:
    # Il collector gira sotto launchd con PATH minimo: node (nvm) non c'e'.
    trovato = shutil.which("node")
    if trovato:
        return trovato
    candidati = sorted(glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin/node")))
    candidati += ["/opt/homebrew/bin/node", "/usr/local/bin/node"]
    return next((c for c in reversed(candidati) if os.path.exists(c)), None)


def _replay(route_rows: list, finished_rows: list) -> dict:
    node = _node()
    cli = REPO_ROOT / "node_modules" / "tsx" / "dist" / "cli.mjs"
    if not node or not cli.exists():
        raise ReplayUnavailable(f"tsx non disponibile (node={node}, tsx={cli.exists()})")
    entrata = json.dumps({"route_rows": route_rows, "finished_rows": finished_rows})
    try:
        esito = subprocess.run([node, str(cli), str(_SCRIPT)], input=entrata, cwd=REPO_ROOT,
                               capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired as exc:
        raise ReplayUnavailable("replay tsx oltre 90s") from exc
    if esito.returncode != 0:
        raise ReplayUnavailable(f"replay tsx fallito: {esito.stderr.strip()[-200:]}")
    return json.loads(esito.stdout)


def _api_stats() -> dict:
    try:
        with urllib.request.urlopen(HISTORY_URL, timeout=20) as risposta:
            return json.loads(risposta.read().decode())["stats"]
    except Exception as exc:  # noqa: BLE001 - qualsiasi guasto e' un '?'
        raise ReplayUnavailable(f"/api/v2/history non raggiungibile: {exc}") from exc


def misura_history() -> tuple[dict, dict]:
    """(replay, stats API). Solleva ReplayUnavailable o DbUnavailable."""
    with _LOCK:
        if _CACHE and time.monotonic() - _CACHE["at"] < _CACHE_S:
            return _CACHE["val"]
        route_rows = fetch_all(_AS_JSON.format(q=_ROUTE_SQL))[0][0]
        finished_rows = fetch_all(_AS_JSON.format(q=_FINITE_SQL))[0][0]
        stats = _api_stats()
        val = (_replay(route_rows, finished_rows), stats)
        _CACHE.update(at=time.monotonic(), val=val)
        return val


def check_history_coerente() -> Verdict:
    """/history pubblica gli stessi n/W/L che il suo codice ricalcola dal DB?

    #CERTIFICA-1001 — sostituisce la SQL «specchio» che c'era in results.py.
    Quella non poteva replicare il dedup delle gemelle, ed era tarata su 4
    gemelle (10/09): l'01/10 erano 156, note e spiegate (#DUP-FIXTURES-0821),
    e il check era rosso da settimane per un difetto suo — un rosso falso
    abitua a ignorare la torre. Ora il ricalcolo esegue lib/dedupe-fixtures,
    lib/track-record e lib/surfacing-gate sulle righe del DB, quindi la
    tolleranza e' ZERO: stesso codice, stessi dati, stesso numero. L'unica
    differenza possibile e' un settlement fra la lettura del DB e la GET, che
    sparisce al giro dopo: l'alerting chiede due rossi consecutivi, e il check
    non ha TTL, quindi sono due misure vere e non una riusata due volte.
    """
    fonte = "web:/api/v2/history+db:unified_predictions"
    soglia = "n, vinte e perse identiche"
    try:
        replay, stats = misura_history()
    except (ReplayUnavailable, DbUnavailable) as exc:
        return unknown(f"non ricalcolabile: {exc}", fonte, evidence={"soglia": soglia})
    db = replay["headline"]
    if any(k not in stats for k in ("n", "won", "lost")):
        return unknown("l'API non espone n/won/lost: niente da confrontare", fonte,
                       evidence={"soglia": soglia, "campi": sorted(stats)})
    api = {k: int(stats.get(k) or 0) for k in ("n", "won", "lost")}
    if db["n"] == 0 and api["n"] == 0:
        # Due zeri uguali non sono coerenza: e' una popolazione non misurata.
        return unknown("DB e API entrambi a 0 pick: popolazione vuota", fonte,
                       evidence={"soglia": soglia})
    prova = {"api": api, "ricalcolato": db, "gemelle_tolte": replay["declared"]["dedup_dropped"],
             "righe_route": replay["route_rows"], "soglia": soglia,
             "cosa_prova": "la coerenza fra la route in produzione e il suo codice "
                           "eseguito sul DB, non la correttezza del codice condiviso. "
                           "Il codice e' quello di REPO_ROOT (la vetrina, origin/main): "
                           "fra un merge e il deploy un rosso transitorio e' possibile",
             "riparo": "la route e il suo codice divergono: un filtro in route.ts non e' "
                       "piu' quello di history_replay.ts (o viceversa)"}
    if api != db:
        return red(f"/history pubblica {api['n']} pick ({api['won']}W/{api['lost']}L), "
                   f"il codice sul DB ne ricalcola {db['n']} ({db['won']}W/{db['lost']}L)",
                   fonte, value=f"scarto {abs(api['n'] - db['n'])}", evidence=prova)
    return green(f"/history = DB ricalcolato: {db['n']} pick, {db['won']}W/{db['lost']}L",
                 fonte, value=db["n"], evidence=prova)


# La copertura e' un claim in prosa («il 98,4% di quelle che abbiamo
# mostrato», app/app/page.tsx:11089, 5 lingue). Oltre 2 punti di scarto la
# frase dice una cosa diversa da quella vera.
COPERTURA_MAX_PUNTI = 2.0


def check_copertura_onesta() -> Verdict:
    fonte = "web:/api/v2/history+db:unified_predictions"
    soglia = f"scarto <= {COPERTURA_MAX_PUNTI:g} punti"
    try:
        replay, stats = misura_history()
    except (ReplayUnavailable, DbUnavailable) as exc:
        return unknown(f"non ricalcolabile: {exc}", fonte, evidence={"soglia": soglia})
    # Quando la route pubblichera' la copertura canonica (PR coerenza), si
    # confronta quella; fino ad allora il campo dichiarato e' `coverage`.
    dichiarata = stats.get("coverage_canonical", stats.get("coverage"))
    onesta = replay["honest"]["coverage"]
    prova = {**replay["honest"], "dichiarata": dichiarata, "soglia": soglia,
             "riparo": "la copertura conta solo le righe gia' chiuse: il denominatore "
                       "deve includere unresolved e senza esito (route.ts, WHERE)"}
    if replay.get("finished_rows", 0) >= FINITE_MAX:
        return unknown(f"popolazione troncata a {FINITE_MAX} righe: alza il tetto", fonte,
                       evidence=prova)
    if dichiarata is None or onesta is None:
        return unknown("l'API non espone la copertura, o non ci sono pick finite",
                       fonte, evidence=prova)
    scarto = abs(float(dichiarata) - float(onesta)) * 100
    testo = f"{float(dichiarata) * 100:.1f}% vs {float(onesta) * 100:.1f}%"
    if scarto > COPERTURA_MAX_PUNTI:
        return red(f"copertura dichiarata {testo} ricalcolata su tutte le pick mostrate e finite",
                   fonte, value=testo, evidence=prova)
    return green(f"copertura dichiarata coerente: {testo}", fonte, value=testo, evidence=prova)


# ── 4 · il registro dei claim pubblici ──────────────────────────────────────
CLAIMS_FILE = REPO_ROOT / "docs" / "claims.tsv"
CAMPI = ("id", "dove", "testo", "misura", "operatore", "soglia", "stato", "atteso")
_OPERATORI = {
    ">=": lambda a, b: a >= b, "<=": lambda a, b: a <= b, ">": lambda a, b: a > b,
    "<": lambda a, b: a < b, "==": lambda a, b: a == b,
}


def leggi_claims(path: Path | None = None) -> list[dict]:
    with open(path or CLAIMS_FILE, encoding="utf-8", newline="") as fh:
        lettore = csv.DictReader(fh, delimiter="\t")
        if tuple(lettore.fieldnames or ()) != CAMPI:
            raise ValueError(f"intestazione diversa da {CAMPI}: {lettore.fieldnames}")
        righe = [r for r in lettore if (r.get("id") or "").strip()
                 and not r["id"].startswith("#")]
    for r in righe:
        mancanti = [c for c in CAMPI if r.get(c) is None]
        if mancanti:
            raise ValueError(f"claim {r.get('id')}: colonne mancanti {mancanti}")
    return righe


def _json_path(dato, percorso: str):
    for pezzo in percorso.split("."):
        dato = dato[int(pezzo)] if isinstance(dato, list) else dato[pezzo]
    return dato


def misura_claim(misura: str) -> tuple[float, bool]:
    """(numero, popolazione dichiarata?). ValueError se la misura non e' valida."""
    tipo, _, corpo = misura.partition(":")
    corpo = corpo.strip()
    if tipo == "sql":
        # Trust boundary: il file e' versionato, ma resta un SELECT singolo,
        # e fetch_all lo esegue comunque in una transazione READ ONLY.
        if not corpo.lower().startswith(("select", "with")) or ";" in corpo:
            raise ValueError("solo un SELECT singolo")
        riga = fetch_all(corpo)[0]
        valore = riga[0]
        # Seconda colonna facoltativa = la popolazione su cui il numero e'
        # misurato. Obbligatoria per i claim '== 0' (vedi valuta_claim): uno
        # zero su una tabella vuota non e' un claim che regge.
        if len(riga) > 1 and not riga[1]:
            raise ValueError("popolazione vuota: niente su cui misurare")
        if len(riga) > 1:
            return float(valore if valore is not None else 0), True
    elif tipo == "api":
        url, _, percorso = corpo.partition("#")
        if not url.startswith("https://www.betredge.com/"):
            raise ValueError("solo endpoint pubblici di betredge.com")
        with urllib.request.urlopen(url, timeout=20) as risposta:
            valore = _json_path(json.loads(risposta.read().decode()), percorso)
    else:
        raise ValueError(f"misura non riconosciuta: {tipo!r}")
    if valore is None:
        # Nessuna riga su cui misurare (es. top-5 in pausa): e' un '?', non
        # uno zero — uno zero renderebbe rosso un claim che oggi non si gioca.
        raise ValueError("nessun dato da misurare")
    return float(valore), False


def valuta_claim(riga: dict) -> dict:
    """Esito di un claim: True regge, False rotto, None non misurato."""
    voce = {"id": riga["id"], "dove": riga["dove"], "testo": riga["testo"],
            "soglia": f"{riga['operatore']} {riga['soglia']}", "atteso": riga["atteso"],
            "misura": "-", "esito": None}
    stato = riga["stato"].strip()
    if stato != "attivo":
        # Saltare un claim e' un'affermazione: «non e' piu' nel copy da quel
        # giorno». Senza una data valida non si salta, resta un '?'.
        parti = stato.split()
        if len(parti) == 2 and parti[0] == "ritirato":
            try:
                datetime.date.fromisoformat(parti[1])
                return {**voce, "esito": "ritirato", "nota": stato}
            except ValueError:
                pass
        return {**voce, "nota": f"stato non valido {stato!r}: attivo | ritirato AAAA-MM-GG"}
    if riga["misura"].strip() in ("", "-"):
        return {**voce, "nota": "non misurabile da qui"}
    op = _OPERATORI.get(riga["operatore"].strip())
    if op is None:
        return {**voce, "nota": f"operatore non valido: {riga['operatore']!r}"}
    try:
        valore, con_popolazione = misura_claim(riga["misura"])
        if riga["operatore"].strip() == "==" and not con_popolazione:
            raise ValueError("un claim '==' deve dichiarare la popolazione (2a colonna)")
    except DbUnavailable as exc:
        return {**voce, "nota": f"database non raggiungibile: {exc}"}
    except Exception as exc:  # noqa: BLE001 - una misura rotta e' un '?', non un verde
        return {**voce, "nota": f"misura fallita: {str(exc)[:120]}"}
    return {**voce, "misura": round(valore, 3), "esito": op(valore, float(riga["soglia"]))}


def check_claims() -> Verdict:
    fonte = "docs/claims.tsv"
    try:
        voci = [valuta_claim(r) for r in leggi_claims()]
    except (OSError, ValueError) as exc:
        return unknown(f"registro dei claim illeggibile: {exc}", fonte)
    attivi = [v for v in voci if v["esito"] != "ritirato"]
    rotti = [v for v in attivi if v["esito"] is False]
    ignoti = [v for v in attivi if v["esito"] is None]
    prova = {"claims": voci, "soglia": "0 claim rotti",
             "riparo": "togli il claim dal copy (e segnalo 'ritirato AAAA-MM-GG') "
                       "o consegna il dato che lo regge"}
    testo = (f"{len(rotti)} rotti, {len(ignoti)} non misurati su {len(attivi)} claim attivi"
             f" ({len(voci) - len(attivi)} ritirati)")
    if not attivi:
        # Un registro vuoto o tutto ritirato non ha misurato niente.
        return unknown(f"nessun claim attivo da misurare: {testo}", fonte, evidence=prova)
    if rotti:
        # Il rosso resta finche' c'e' un rotto, ma un claim che si rompe DOPO
        # l'audit 01/10 (atteso «regge» o «?») cambia la headline e si nomina
        # per primo: altrimenti il 16esimo rotto sparirebbe nei 15 gia' noti.
        peggiorati = [v for v in rotti if v["atteso"] not in ("rotto", "in parte")]
        nomi = ", ".join(v["id"] for v in peggiorati[:6]) or "-"
        return red(f"{testo} · {len(peggiorati)} peggiorati: {nomi} · "
                   f"{len(rotti) - len(peggiorati)} attesi dall'audit 01/10",
                   fonte, value=len(rotti), evidence={**prova, "peggiorati":
                                                      [v["id"] for v in peggiorati]})
    if ignoti:
        return amber(testo, fonte, value=len(ignoti), evidence=prova)
    return green(testo, fonte, value=0, evidence=prova)


def checks() -> list[Check]:
    return [
        Check("parita_tennis", "coerenza", "Tennis: sorgente = unified",
              lambda: check_parita("tennis"), timeout_seconds=25),
        Check("parita_calcio", "coerenza", "Calcio: sorgente = unified",
              lambda: check_parita("calcio"), timeout_seconds=25),
        Check("freschezza_leghe", "coerenza", "Freschezza per lega",
              check_freschezza_leghe, timeout_seconds=25),
        # Stesso id di prima: la torre conserva la storia del check.
        Check("history_coerente", "risultati", "History coerente col DB",
              check_history_coerente, timeout_seconds=120),
        Check("copertura_onesta", "coerenza", "Copertura dichiarata onesta",
              check_copertura_onesta, timeout_seconds=120),
        # Un solo check per il registro, non uno per claim: ogni rosso notifica,
        # e 15 claim rotti noti sarebbero 15 notifiche ogni 6 ore.
        Check("claim_registry", "coerenza", "Claim pubblici vs dato",
              check_claims, ttl_seconds=3600, timeout_seconds=180),
    ]
