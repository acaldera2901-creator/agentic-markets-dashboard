"""La pipeline dei dati: freschezza, quota delle fonti, qualita' dei settlement."""

import json
from collections import namedtuple
from datetime import date

from ..contract import Check, Verdict, amber, green, red, unknown
from ..db import REPO_ROOT, DbUnavailable, fetch_all

FreshSpec = namedtuple("FreshSpec", "id label table column red_after_s via_pkey")

FRESHNESS = (
    # via_pkey: su odds_snapshots (20,9 milioni di righe) non esiste un indice
    # su captured_at, quindi max() e' una scansione completa — misurata 33,4s,
    # ogni 5 minuti, sul database di produzione. Le righe entrano in ordine di
    # tempo, quindi l'ultima per chiave primaria e' anche la piu' recente: la
    # stessa risposta in 0,65s usando un indice che esiste gia'. Aggiungere un
    # indice sarebbe una scrittura su prod, cioe' una decisione gated, e qui
    # non serve.
    FreshSpec("odds_freshness", "Quote", "odds_snapshots", "captured_at", 3600, True),
    FreshSpec("predictions_freshness", "Predizioni calcio", "match_predictions", "computed_at", 14400, False),
    FreshSpec("tennis_freshness", "Predizioni tennis", "tennis_predictions", "computed_at", 21600, False),
)

QUOTA_AMBER = 0.70
QUOTA_RED = 0.90

# `odds_api_remaining` NON e' un contatore di consumo: e' il residuo del piano,
# scritto nella stessa colonna requests_made. Trattarlo come uso invertirebbe
# il significato del tile — 85.845 su 5.000.000 sembrerebbe un 2% di consumo
# mentre e' il credito che resta.
QUOTA_ESCLUSI = ("odds_api_remaining",)

VOID_AMBER = 0.20
VOID_RED = 0.50


def _human(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h {(seconds % 3600) // 60:02d}m"
    return f"{seconds // 86400}g {(seconds % 86400) // 3600}h"


def check_freshness(spec: FreshSpec) -> Verdict:
    if spec.via_pkey:
        sql = (
            f"select extract(epoch from now() - {spec.column}) from {spec.table} "
            "order by id desc limit 1"
        )
    else:
        sql = f"select extract(epoch from now() - max({spec.column})) from {spec.table}"
    try:
        righe = fetch_all(sql)
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", f"db:{spec.table}")

    eta = righe[0][0] if righe else None
    if eta is None:
        return red(f"{spec.table} e' vuota", f"db:{spec.table}")

    eta = float(eta)
    testo = _human(eta)
    if eta > spec.red_after_s:
        return red(
            f"ultimo dato {testo} fa (limite {_human(spec.red_after_s)})",
            f"db:{spec.table}",
            value=testo,
            evidence={"age_s": int(eta), "limite_s": spec.red_after_s},
        )
    return green(f"ultimo dato {testo} fa", f"db:{spec.table}", value=testo,
                 evidence={"age_s": int(eta)})


def check_quota(provider: str) -> Verdict:
    try:
        righe = fetch_all(
            "select requests_made, requests_limit from source_quota_log "
            "where provider = %s and date = current_date",
            (provider,),
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:source_quota_log")

    if not righe:
        return unknown(
            "nessuna riga di quota per oggi: la fonte non e' stata usata o non registra",
            "db:source_quota_log",
        )

    fatte, limite = int(righe[0][0] or 0), int(righe[0][1] or 0)
    if limite <= 0:
        return unknown(f"limite non dichiarato ({fatte} richieste oggi)", "db:source_quota_log")

    frazione = fatte / limite
    testo = f"{frazione * 100:.0f}%"
    prove = {"fatte": fatte, "limite": limite}
    if frazione >= QUOTA_RED:
        return red(f"{fatte} di {limite} richieste oggi", "db:source_quota_log",
                   value=testo, evidence=prove)
    if frazione >= QUOTA_AMBER:
        return amber(f"{fatte} di {limite} richieste oggi", "db:source_quota_log",
                     value=testo, evidence=prove)
    return green(f"{fatte} di {limite} richieste oggi", "db:source_quota_log",
                 value=testo, evidence=prove)


def check_void_rate() -> Verdict:
    """Quanta parte dei settlement recenti finisce in void.

    Non e' un dettaglio statistico: un void rate alto significa che il track
    record non si produce affatto, perche' i pick non vengono ne' vinti ne'
    persi. Misurato il 2026-08-20: 94% a 30 giorni.

    #SETTLE-0909 — IL DENOMINATORE ESCLUDE LE RIGHE SENZA PICK. `void` in
    questo prodotto ha due significati diversi che finivano nello stesso
    conteggio:
      1. «abbiamo mostrato una pick e non si e' potuta risolvere» — il difetto
         che questo check esiste per misurare;
      2. «non c'era nessuna pick da risolvere» (`pick_ledger.pick` NULL: riga
         sotto il floor, nessuna direzione dichiarata) — che e' `void` per
         DEFINIZIONE, non per guasto.
    Contando anche il secondo, il check misurava in gran parte quanto e' severo
    il nostro floor di confidenza, non se il track record si produce. Misurato
    il 10/09: sul totale dava 86% (958 su 1113), un rosso che nessun intervento
    sul settlement poteva far scendere — cioe' un allarme che non si puo'
    spegnere, che e' lo stesso che non averlo.

    #VOID-DENOM-0910 — e il primo tentativo di denominatore era ANCORA sbagliato.
    Escludeva `pick_ledger.pick IS NULL`, ma il mastro registra la pick anche per
    le righe che il floor sopprime: quelle arrivano al settlement con
    `unified_predictions.pick = NULL` (azzerata da unified-adapter.ts:232) e si
    chiudono `void` per definizione. Misurato il 10/09 a 30 giorni:

        denominatore «mastro»    84 chiusure, 32 void  -> 38%   (falso)
        denominatore «servita»   77 chiusure,  4 void  ->  5%   (vero, VERDE)

    Le 28 righe di differenza erano sotto floor, mai mostrate come direzione, e
    si chiudono `void` per definizione. La query NON filtra piu' su
    `pick_ledger.pick`: per «quante delle pick PUBBLICATE non si sono risolte»
    il criterio e' la riga servita, e un buco del mirror del mastro non deve
    far sparire una pick dal denominatore (22 righe sono in questo caso).
    Sulle chiusure con esito: 29 vinte, 13 perse — hit rate 69%.
    Eseguita contro produzione prima di spedirla: 4 su 77.
    """
    try:
        righe = fetch_all(
            """
            -- #VOID-DENOM-0910: le colonne sono NOMINATE. Il codice qui sotto
            -- legge per posizione, ma due colonne entrambe chiamate `count`
            -- si sovrascrivono a vicenda appena qualcuno ispeziona la query
            -- in JSON (e' successo verificandola).
            select count(*) as totale,
                   count(*) filter (where lower(s.result) = 'void') as void
            from pick_settlement_current s
            join pick_ledger l
              on l.source_table = s.source_table
             and l.source_id = s.source_id
             and l.model_version = s.model_version
            join unified_predictions up
              on up.source_table = l.source_table
             and up.source_id = l.source_id
            where s.settled_at > now() - interval '30 days'
              -- #VOID-DENOM-0910: il filtro era `l.pick is not null`, cioe' la
              -- pick nel MASTRO. Sbagliato: il mastro registra la pick anche per
              -- righe che il floor poi sopprime, e quelle si chiudono `void` per
              -- DEFINIZIONE. La pick PUBBLICATA e' quella della riga servita
              -- (`unified_predictions.pick`), che `lib/unified-adapter.ts:232`
              -- azzera sotto floor.
              and up.pick is not null
              and l.is_backfill = false
            """
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:pick_settlement")

    totale = int(righe[0][0] or 0)
    void = int(righe[0][1] or 0)
    if totale == 0:
        return unknown("nessun settlement negli ultimi 30 giorni", "db:pick_settlement")

    frazione = void / totale
    testo = f"{frazione * 100:.0f}%"
    prove = {"void": void, "totale": totale}
    if frazione >= VOID_RED:
        return red(
            f"{void} su {totale} settlement sono void: il track record non si produce",
            "db:pick_settlement", value=testo, evidence=prove,
        )
    if frazione >= VOID_AMBER:
        return amber(f"{void} su {totale} settlement sono void", "db:pick_settlement",
                     value=testo, evidence=prove)
    return green(f"{void} su {totale} settlement sono void", "db:pick_settlement",
                 value=testo, evidence=prove)


def _providers() -> list[str]:
    try:
        righe = fetch_all(
            "select distinct provider from source_quota_log where date = current_date order by 1"
        )
    except DbUnavailable:
        return []
    return [r[0] for r in righe if r[0] not in QUOTA_ESCLUSI]


# #HISTORY-FRESHNESS-1026 — lo snapshot storico delle 26 leghe fuori dal free
# tier di football-data.org (data/summer_leagues/history.json) e' la meta'
# storica del loro modello e la fonte della loro forma. Si rinnova solo con la
# PR settimanale di refresh-history.yml; il 26/10 era fermo al 21/09 (35 giorni)
# perche' la PR non veniva mergiata e il giro del 19/10 era fallito.
# Il file letto e' quello della vetrina (REPO_ROOT, origin/main): lo stesso che
# va in deploy, come fa coerenza.py con result_sources.json.
HISTORY_FILE = REPO_ROOT / "data" / "summer_leagues" / "history.json"
HISTORY_AMBER_DAYS = 8    # un giro settimanale saltato
HISTORY_RED_DAYS = 15     # due giri saltati: il modello gira su dati vecchi
HISTORY_LEAGUE_STALE_DAYS = 21  # solo evidenza: una lega puo' essere fuori stagione


def judge_history_snapshot(doc: dict, today: date) -> Verdict:
    source = "file:data/summer_leagues/history.json"
    try:
        generated = date.fromisoformat(str(doc.get("generated_at")))
    except ValueError:
        return unknown("generated_at assente o illeggibile", source)

    eta = (today - generated).days
    ferme = {}
    for code, block in sorted((doc.get("leagues") or {}).items()):
        last = (block or {}).get("last_match_at")
        try:
            if last and (today - date.fromisoformat(last)).days > HISTORY_LEAGUE_STALE_DAYS:
                ferme[code] = last
        except ValueError:
            ferme[code] = last
    evidence = {
        "generated_at": str(generated),
        "refresh_status": doc.get("refresh_status"),
        "failed_leagues": doc.get("failed_leagues") or [],
        "leghe_ferme": ferme,
    }
    testa = f"storico al {generated} ({eta} giorni)"
    if eta > HISTORY_RED_DAYS:
        return red(f"{testa}: refresh settimanale non arrivato su main", source, value=eta, evidence=evidence)
    if eta > HISTORY_AMBER_DAYS:
        return amber(f"{testa}: un giro di refresh saltato", source, value=eta, evidence=evidence)
    if doc.get("refresh_status") not in (None, "ok"):
        falliti = ", ".join(doc.get("failed_leagues") or []) or "?"
        return amber(f"{testa}, refresh parziale: {falliti}", source, value=eta, evidence=evidence)
    return green(testa, source, value=eta, evidence=evidence)


def check_history_snapshot() -> Verdict:
    try:
        doc = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return unknown(f"snapshot illeggibile: {exc}", "file:data/summer_leagues/history.json")
    return judge_history_snapshot(doc, date.today())


def checks() -> list[Check]:
    fatti = [
        Check(spec.id, "pipeline", spec.label, lambda s=spec: check_freshness(s), timeout_seconds=20)
        for spec in FRESHNESS
    ]
    fatti.append(
        Check("void_rate", "pipeline", "Void rate 30g", check_void_rate, timeout_seconds=25)
    )
    fatti.append(
        Check("history_snapshot", "pipeline", "Storico 26 leghe", check_history_snapshot, timeout_seconds=10)
    )
    fatti += [
        Check(
            f"quota_{p}", "pipeline", f"Quota {p}",
            lambda prov=p: check_quota(prov), timeout_seconds=20,
        )
        for p in _providers()
    ]
    return fatti
