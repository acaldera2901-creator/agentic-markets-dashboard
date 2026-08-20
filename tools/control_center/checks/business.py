"""Abbonati, incassi, traffico. Numeri, non verdetti."""

from ..contract import Check, Verdict, info, unknown
from ..db import DbUnavailable, fetch_all

PIANI_PAGANTI = ("base", "premium")


def check_abbonati() -> Verdict:
    try:
        righe = fetch_all("select plan, count(*) from profiles group by 1")
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:profiles")
    per_piano = {r[0]: int(r[1]) for r in righe}
    paganti = sum(per_piano.get(p, 0) for p in PIANI_PAGANTI)
    free = per_piano.get("free", 0)
    return info(
        f"{paganti} paganti, {free} free",
        "db:profiles", value=paganti, evidence=per_piano,
    )


def check_iscrizioni() -> Verdict:
    """Nuovi profili a 7 giorni, con il confronto sui 7 precedenti.

    Il confronto viene dal database, non dallo storico su disco: cosi' la
    tendenza c'e' dal primo run e non fra una settimana.
    """
    try:
        righe = fetch_all(
            "select count(*) filter (where created_at > now() - interval '7 days'), "
            "       count(*) filter (where created_at > now() - interval '14 days' "
            "                          and created_at <= now() - interval '7 days') "
            "from profiles"
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:profiles")
    ora, prima = int(righe[0][0] or 0), int(righe[0][1] or 0)
    delta = ora - prima
    segno = f"{delta:+d}" if delta else "="
    return info(
        f"{ora} nuovi in 7 giorni ({segno} sui 7 precedenti)",
        "db:profiles", value=ora, evidence={"ultimi_7": ora, "precedenti_7": prima},
    )


def check_incassato() -> Verdict:
    """Incassato reale sommando i canali che registrano un importo.

    stripe_events non porta un importo (solo event_id, event_type,
    processed_at) e weekly_pick_purchases non ha un campo prezzo: entrambi
    restano fuori dalla somma e vengono contati a parte, invece di essere
    ignorati in silenzio.
    """
    try:
        paygate = fetch_all(
            "select count(*), coalesce(sum(amount_usd), 0) from paygate_orders "
            "where paid_at is not null"
        )[0]
        paypal = fetch_all(
            "select count(*), coalesce(sum(amount_usd), 0) from paypal_orders "
            "where paid_at is not null"
        )[0]
        weekly = fetch_all("select count(*) from weekly_pick_purchases")[0]
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:paygate_orders")

    ordini = int(paygate[0]) + int(paypal[0])
    totale = float(paygate[1]) + float(paypal[1])
    return info(
        f"{ordini} ordini pagati, {int(weekly[0])} weekly pick",
        "db:paygate_orders+paypal_orders",
        value=f"${totale:,.2f}",
        evidence={
            "paygate_ordini": int(paygate[0]), "paygate_usd": float(paygate[1]),
            "paypal_ordini": int(paypal[0]), "paypal_usd": float(paypal[1]),
            "weekly_pick_acquisti": int(weekly[0]),
            "fuori_somma": "stripe_events e weekly_pick_purchases non registrano un importo",
        },
    )


def check_traffico() -> Verdict:
    try:
        eventi = fetch_all(
            "select count(*) filter (where created_at > now() - interval '7 days'), "
            "       count(*) filter (where created_at > now() - interval '14 days' "
            "                          and created_at <= now() - interval '7 days') "
            "from events"
        )[0]
        visite = fetch_all(
            "select count(*) filter (where ts > now() - interval '7 days'), count(*) "
            "from site_visits"
        )[0]
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:events")
    ora, prima = int(eventi[0] or 0), int(eventi[1] or 0)
    visite_7, visite_totali = int(visite[0] or 0), int(visite[1] or 0)
    delta = ora - prima
    segno = f"{delta:+d}" if delta else "="

    prove = {"eventi_7": ora, "eventi_precedenti_7": prima, "visite_7": visite_7}
    # Dire "0 visite" farebbe credere che il tracking funzioni e che nessuno
    # sia passato. Misurato il 2026-08-20: site_visits ha UNA riga in tutto,
    # del 14 giugno. Il numero non e' basso: non viene scritto.
    if visite_totali <= 1:
        prove["site_visits"] = f"praticamente vuota ({visite_totali} righe in tutto): non registra"
        coda = "tracking visite non attivo"
    else:
        coda = f"{visite_7} visite"
    return info(
        f"{ora} eventi in 7 giorni ({segno}), {coda}",
        "db:events+site_visits", value=ora, evidence=prove,
    )


def checks() -> list[Check]:
    return [
        Check("abbonati", "business", "Abbonati", check_abbonati, timeout_seconds=20),
        Check("iscrizioni_7g", "business", "Nuove iscrizioni", check_iscrizioni, timeout_seconds=20),
        Check("incassato", "business", "Incassato", check_incassato, timeout_seconds=30),
        Check("traffico_7g", "business", "Traffico", check_traffico, timeout_seconds=30),
    ]
