"""I risultati del modello: track record vero, con le guardie che lo rendono onesto.

Fonte: pick_ledger in join con pick_settlement su (source_table, source_id),
esclusi i backfill e le quote di chiusura marcate fuzzy.

Due trappole misurate il 2026-08-20, entrambe capaci di produrre un numero
falso dall'aria credibile:
  1. result vale 'won' / 'lost' / 'void' / 'unresolved', NON 'win': una query
     scritta su 'win' restituisce zero vittorie e un ROI di -100%;
  2. sotto un campione minimo il ROI e' rumore — su 3 pick chiusi dava -100%.
"""

from ..contract import Check, Verdict, amber, green, info, red, unknown
from ..db import DbUnavailable, fetch_all

CAMPIONE_MINIMO = 30

_TRACK_SQL = """
select count(*),
       count(*) filter (where lower(s.result) = 'won'),
       sum(case when lower(s.result) = 'won'
                then coalesce(s.closing_odds, l.odds) - 1 else -1 end)
from pick_ledger l
join pick_settlement s
  on s.source_table = l.source_table and s.source_id = l.source_id
where l.is_backfill = false
  and coalesce(s.closing_odds_is_fuzzy, false) = false
  and lower(s.result) in ('won', 'lost')
  and ({finestra})
"""


def _track(finestra_sql: str, etichetta: str) -> Verdict:
    try:
        righe = fetch_all(_TRACK_SQL.format(finestra=finestra_sql))
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:pick_ledger")

    n = int(righe[0][0] or 0)
    vinti = int(righe[0][1] or 0)
    profitto = float(righe[0][2] or 0)

    if n < CAMPIONE_MINIMO:
        # Mostrare un ROI su pochi pick e' peggio che non mostrarlo: e' rumore
        # con l'aria di una misura.
        return info(
            f"campione insufficiente: {n} pick chiusi su {CAMPIONE_MINIMO} necessari",
            "db:pick_ledger",
            value=f"n={n}",
            evidence={"pick_chiusi": n, "minimo": CAMPIONE_MINIMO, "finestra": etichetta},
        )

    roi = profitto / n * 100
    hit = vinti / n * 100
    return info(
        f"{n} pick chiusi, hit rate {hit:.1f}%, profitto {profitto:+.2f}u",
        "db:pick_ledger",
        value=f"{roi:+.1f}%",
        evidence={
            "pick_chiusi": n, "vinti": vinti, "hit_rate_pct": round(hit, 1),
            "profitto_unita": round(profitto, 2), "roi_pct": round(roi, 1),
            "finestra": etichetta,
        },
    )


def check_roi_7g() -> Verdict:
    return _track("s.settled_at > now() - interval '7 days'", "7 giorni")


def check_roi_30g() -> Verdict:
    return _track("s.settled_at > now() - interval '30 days'", "30 giorni")


def check_roi_totale() -> Verdict:
    return _track("true", "totale")


def check_picks_oggi() -> Verdict:
    try:
        righe = fetch_all(
            "select count(*), count(*) filter (where commence_time > now()) "
            "from pick_ledger where captured_at::date = current_date and is_backfill = false"
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:pick_ledger")
    totale = int(righe[0][0] or 0)
    futuri = int(righe[0][1] or 0)
    return info(
        f"{totale} pick oggi, di cui {futuri} ancora da giocare",
        "db:pick_ledger", value=totale, evidence={"oggi": totale, "da_giocare": futuri},
    )


def check_bankroll() -> Verdict:
    try:
        righe = fetch_all("select count(*), max(bankroll) from bankroll_history")
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:bankroll_history")
    if not righe or not righe[0][0]:
        # Non si stima: la tabella e' vuota e va deciso se popolarla.
        return unknown(
            "bankroll_history e' vuota: nessuna curva da mostrare",
            "db:bankroll_history",
        )
    return info(f"bankroll {float(righe[0][1]):.2f}", "db:bankroll_history",
                value=round(float(righe[0][1]), 2))


# ── il check che rende «una volta per tutte» una cosa misurata ──────────────
# #SETTLE-0909. Il difetto strutturale, ripetuto due volte in due giorni: lo
# STESSO numero viene calcolato in piu' posti, e i posti non sono d'accordo.
#   · il 09/09 c'erano due fonti di verita' su «la partita e' finita» (il flag
#     della fonte e il verbo di una stringa di note) e vinceva la sbagliata;
#   · il 10/09 su /history c'erano tre riquadri che misuravano tre cose diverse
#     sotto un unico titolo, e «139 EVENTS» erano le partite del board live.
# Nessun test poteva accorgersene, perche' ogni pezzo era corretto DA SOLO.
# Questo check confronta cio' che il PRODOTTO PUBBLICA con cio' che il DB
# RICALCOLA, e diventa rosso quando divergono. E' l'unica forma di garanzia che
# sopravvive a un refactor della UI.
# Questa SQL deve rispecchiare RIGA PER RIGA i filtri di
# app/api/v2/history/route.ts, eccezione del World Cup compresa
# (`wasShownAsPick`: le righe sotto il floor sono escluse TRANNE il World Cup,
# dove il floor era stato abbassato di proposito). Se le due regole divergono,
# il check confronta due cose diverse e la tolleranza nasconde il difetto
# invece di rivelarlo — cioe' diventa il problema che dovrebbe misurare.
_PUBBLICO_SQL = """
select count(*) filter (where result in ('won','lost')),
       count(*) filter (where result = 'won')
from unified_predictions
where is_historical = true
  and is_demo = false
  and published_at is not null
  and pick is not null
  and verification_state = 'verified'
  and (coalesce((nullif(notes,'')::jsonb -> 'surface' ->> 'below_floor'), 'false') <> 'true'
       or competition = 'World Cup')
"""

# L'unica differenza che resta e' la deduplica delle partite gemelle, che la
# route fa in lettura (lib/dedupe-fixtures) e la SQL non puo' replicare in modo
# leggibile. Misurata il 10/09: 4 righe su 1.610, cioe' 0,2 punti. Le soglie
# stanno appena sopra quel rumore — non larghe abbastanza da coprire un difetto.
_SCARTO_MAX_PUNTI = 0.6
_SCARTO_MAX_RIGHE = 25


def check_history_coerente() -> Verdict:
    """Il numero pubblicato su /history combacia con quello ricalcolato dal DB?"""
    import json
    import urllib.request

    try:
        righe = fetch_all(_PUBBLICO_SQL)
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:unified_predictions")

    n_db = int(righe[0][0] or 0)
    vinti_db = int(righe[0][1] or 0)
    if n_db == 0:
        return unknown("nessuna pick verificata nel DB: niente da confrontare",
                       "db:unified_predictions")

    try:
        with urllib.request.urlopen(
            "https://betredge.com/api/v2/history?limit=1", timeout=20
        ) as risposta:
            stats = json.loads(risposta.read().decode())["stats"]
    except Exception as exc:
        return unknown(f"/api/v2/history non raggiungibile: {exc}", "web:/api/v2/history")

    n_api = int(stats.get("n") or 0)
    if n_api == 0:
        return red(
            "l'API pubblica 0 pick verificate mentre il DB ne ha "
            f"{n_db}: il cancello di verifica sta escludendo tutto",
            "web:/api/v2/history",
            value="n=0",
            evidence={"n_api": 0, "n_db": n_db},
        )

    hit_db = vinti_db / n_db * 100
    hit_api = float((stats.get("win_rate") or "0%").rstrip("%") or 0)
    scarto_punti = abs(hit_api - hit_db)
    scarto_righe = abs(n_api - n_db)

    prova = {
        "hit_pubblicato": round(hit_api, 1),
        "hit_ricalcolato": round(hit_db, 1),
        "n_pubblicato": n_api,
        "n_ricalcolato": n_db,
        "copertura_pubblicata": stats.get("coverage"),
        "escluse_pubblicate": stats.get("unverified_excluded"),
    }

    if scarto_punti > _SCARTO_MAX_PUNTI or scarto_righe > _SCARTO_MAX_RIGHE:
        return red(
            f"/history pubblica {hit_api:.1f}% su {n_api} pick, il DB ne ricalcola "
            f"{hit_db:.1f}% su {n_db}: due numeri per lo stesso fatto",
            "web:/api/v2/history",
            value=f"scarto {scarto_punti:.1f}pt / {scarto_righe} righe",
            evidence=prova,
        )

    # Il campo `coverage` deve esistere: se manca, il deploy in produzione e'
    # precedente al cancello di verifica e la pagina sta promettendo «senza
    # filtri» su dati filtrati — o il contrario.
    if stats.get("coverage") is None:
        return amber(
            "/history risponde senza `coverage`: il deploy pubblico e' anteriore "
            "al cancello di verifica",
            "web:/api/v2/history",
            evidence=prova,
        )

    return green(
        f"/history coerente col DB: {hit_api:.1f}% su {n_api} pick, "
        f"copertura {float(stats['coverage']) * 100:.1f}%",
        "web:/api/v2/history",
        value=f"{hit_api:.1f}%",
        evidence=prova,
    )


def checks() -> list[Check]:
    return [
        Check("roi_totale", "risultati", "ROI totale", check_roi_totale, timeout_seconds=30),
        Check("roi_30g", "risultati", "ROI 30 giorni", check_roi_30g, timeout_seconds=30),
        Check("roi_7g", "risultati", "ROI 7 giorni", check_roi_7g, timeout_seconds=30),
        Check("picks_oggi", "risultati", "Pick di oggi", check_picks_oggi, timeout_seconds=25),
        Check("bankroll", "risultati", "Bankroll", check_bankroll, timeout_seconds=20),
        Check("history_coerente", "risultati", "History coerente col DB",
              check_history_coerente, timeout_seconds=40),
    ]
