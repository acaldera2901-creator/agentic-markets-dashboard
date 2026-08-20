"""La pipeline dei dati: freschezza, quota delle fonti, qualita' dei settlement."""

from collections import namedtuple

from ..contract import Check, Verdict, amber, green, red, unknown
from ..db import DbUnavailable, fetch_all

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
    """
    try:
        righe = fetch_all(
            "select count(*), count(*) filter (where lower(result) = 'void') "
            "from pick_settlement where settled_at > now() - interval '30 days'"
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


def checks() -> list[Check]:
    fatti = [
        Check(spec.id, "pipeline", spec.label, lambda s=spec: check_freshness(s), timeout_seconds=20)
        for spec in FRESHNESS
    ]
    fatti.append(
        Check("void_rate", "pipeline", "Void rate 30g", check_void_rate, timeout_seconds=25)
    )
    fatti += [
        Check(
            f"quota_{p}", "pipeline", f"Quota {p}",
            lambda prov=p: check_quota(prov), timeout_seconds=20,
        )
        for p in _providers()
    ]
    return fatti
