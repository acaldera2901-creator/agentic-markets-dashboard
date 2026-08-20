"""I risultati del modello: track record vero, con le guardie che lo rendono onesto.

Fonte: pick_ledger in join con pick_settlement su (source_table, source_id),
esclusi i backfill e le quote di chiusura marcate fuzzy.

Due trappole misurate il 2026-08-20, entrambe capaci di produrre un numero
falso dall'aria credibile:
  1. result vale 'won' / 'lost' / 'void' / 'unresolved', NON 'win': una query
     scritta su 'win' restituisce zero vittorie e un ROI di -100%;
  2. sotto un campione minimo il ROI e' rumore — su 3 pick chiusi dava -100%.
"""

from ..contract import Check, Verdict, info, unknown
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


def checks() -> list[Check]:
    return [
        Check("roi_totale", "risultati", "ROI totale", check_roi_totale, timeout_seconds=30),
        Check("roi_30g", "risultati", "ROI 30 giorni", check_roi_30g, timeout_seconds=30),
        Check("roi_7g", "risultati", "ROI 7 giorni", check_roi_7g, timeout_seconds=30),
        Check("picks_oggi", "risultati", "Pick di oggi", check_picks_oggi, timeout_seconds=25),
        Check("bankroll", "risultati", "Bankroll", check_bankroll, timeout_seconds=20),
    ]
