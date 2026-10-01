"""I risultati del modello: track record vero, con le guardie che lo rendono onesto.

Fonte: pick_ledger in join con pick_settlement su (source_table, source_id),
esclusi i backfill e le quote di chiusura marcate fuzzy.

Due trappole misurate il 2026-08-20, entrambe capaci di produrre un numero
falso dall'aria credibile:
  1. result vale 'won' / 'lost' / 'void' / 'unresolved', NON 'win': una query
     scritta su 'win' restituisce zero vittorie e un ROI di -100%;
  2. sotto un campione minimo il ROI e' rumore — su 3 pick chiusi dava -100%.
"""

from ..contract import Check, Verdict, green, info, red, unknown
from ..db import DbUnavailable, fetch_all

CAMPIONE_MINIMO = 30

_TRACK_SQL = """
select count(*),
       count(*) filter (where lower(s.result) = 'won'),
       sum(case when lower(s.result) = 'won'
                then coalesce(s.closing_odds, l.odds) - 1 else -1 end)
from pick_ledger l
join pick_settlement_current s   -- #SETTLE-0909: la vista espone SOLO la revisione corrente
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


# ── /history coerente col DB ────────────────────────────────────────────────
# #CERTIFICA-1001 — il check `history_coerente` vive in checks/coerenza.py: la
# SQL «specchio» che stava qui non poteva replicare il dedup delle gemelle, ed
# era diventata un rosso falso (156 gemelle note contro una tolleranza di 25).
# Ora si ricalcola eseguendo il codice vero della route sulle righe del DB.


# ── il buco che non si vedeva da nessuna parte ──────────────────────────────
# #SETTLE-0909. Misurate il 10/09: 27 pick PUBBLICATE E MOSTRATE, partite fra
# l'11/06 e il 24/08, con `result` NULL. Non vinte, non perse, non void, non
# `unresolved`: invisibili in entrambe le direzioni — fuori dal track record e
# non contate nemmeno come buchi.
#
# Come ci sono arrivate: a monte `tennis_predictions.outcome = 'expired'` con
# `winner` NULL. Lo spazzino a monte le ha marcate scadute, il ponte verso la
# riga pubblica non e' passato, e da lì NESSUNO le riguarda piu' — quello a
# monte seleziona `outcome IS NULL`, il backstop TS pretende `winner NOT NULL`.
# Un buco permanente per costruzione, e nessun test poteva vederlo perche' ogni
# pezzo era corretto da solo.
#
# Questo check chiede la domanda che nessuno chiedeva: «c'e' una pick che
# abbiamo MOSTRATO, la cui partita e' finita, e di cui non sappiamo dire com'e'
# andata?». Se la risposta e' si', e' rosso.
_ORFANE_SQL = """
select count(*),
       min(starts_at)::date::text,
       count(*) filter (where sport = 'tennis'),
       count(*) filter (where sport = 'football')
from unified_predictions
where result is null
  and published_at is not null
  and pick is not null
  and is_demo = false
  and starts_at < now() - interval '48 hours'
"""


def check_history_orfane() -> Verdict:
    """Pick mostrate, partita finita, nessun esito: buchi muti nello storico."""
    try:
        righe = fetch_all(_ORFANE_SQL)
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:unified_predictions")

    n = int(righe[0][0] or 0)
    if n == 0:
        return green(
            "nessuna pick mostrata senza esito: lo storico non ha buchi muti",
            "db:unified_predictions", value=0,
        )

    piu_vecchia = righe[0][1] or "?"
    prova = {
        "orfane": n, "piu_vecchia": piu_vecchia,
        "tennis": int(righe[0][2] or 0), "football": int(righe[0][3] or 0),
    }
    # La soglia e' ZERO, di proposito: una pick mostrata di cui non sappiamo
    # l'esito e' un difetto anche se e' una sola. Il recupero e' possibile —
    # l'archivio ESPN arriva a gennaio — quindi non c'e' motivo di tollerarle.
    return red(
        f"{n} pick mostrate senza esito (la piu' vecchia del {piu_vecchia}): "
        "fuori dal track record e non contate nemmeno come buchi",
        "db:unified_predictions", value=n, evidence=prova,
    )


def checks() -> list[Check]:
    return [
        Check("roi_totale", "risultati", "ROI totale", check_roi_totale, timeout_seconds=30),
        Check("roi_30g", "risultati", "ROI 30 giorni", check_roi_30g, timeout_seconds=30),
        Check("roi_7g", "risultati", "ROI 7 giorni", check_roi_7g, timeout_seconds=30),
        Check("picks_oggi", "risultati", "Pick di oggi", check_picks_oggi, timeout_seconds=25),
        Check("bankroll", "risultati", "Bankroll", check_bankroll, timeout_seconds=20),
        Check("history_orfane", "risultati", "Pick mostrate senza esito",
              check_history_orfane, timeout_seconds=30),
    ]
