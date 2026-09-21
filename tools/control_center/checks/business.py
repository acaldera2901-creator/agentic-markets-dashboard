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
    """Traffico a 7 giorni letto SOLO da `events`.

    #MIS-A — leggeva anche `site_visits`, che ha una riga sintetica del
    14/06 e non e' nostra: appartiene al backoffice separato di Tommy, che
    e' live e la legge. Due sistemi di telemetria, uno solo scritto: il
    ramo difensivo "tracking visite non attivo" diceva che il tracking non
    andava mentre `events` registrava regolarmente.

    Le SESSIONI contano solo il traffico CON CONSENSO: senza consenso il
    beacon parte comunque ma senza `session_id` (regola in
    lib/track-event.ts), e circa un page_view su cinque arriva cosi'. Il
    caveat sta nell'evidenza perche' e' vero: senza dichiararlo avremmo
    solo sostituito un numero falso con un altro.
    """
    try:
        righe = fetch_all(
            "select count(*) filter (where created_at > now() - interval '7 days'), "
            "       count(distinct session_id) filter "
            "           (where created_at > now() - interval '7 days'), "
            "       count(*) filter (where created_at > now() - interval '14 days' "
            "                          and created_at <= now() - interval '7 days') "
            "from events where event_type = 'page_view'"
        )[0]
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:events")
    viste, sessioni, prima = int(righe[0] or 0), int(righe[1] or 0), int(righe[2] or 0)
    delta = viste - prima
    segno = f"{delta:+d}" if delta else "="
    return info(
        f"{viste} pagine viste in 7 giorni ({segno}), {sessioni} sessioni",
        "db:events", value=viste,
        evidence={
            "viste_7": viste,
            "viste_precedenti_7": prima,
            "sessioni_7": sessioni,
            "caveat_sessioni": "solo traffico con consenso: senza consenso il "
                               "beacon parte senza session_id (~20% dei page_view)",
        },
    )


def checks() -> list[Check]:
    return [
        Check("abbonati", "business", "Abbonati", check_abbonati, timeout_seconds=20),
        Check("iscrizioni_7g", "business", "Nuove iscrizioni", check_iscrizioni, timeout_seconds=20),
        Check("incassato", "business", "Incassato", check_incassato, timeout_seconds=30),
        Check("traffico_7g", "business", "Traffico", check_traffico, timeout_seconds=30),
    ]
