"""Le mail: cosa il CRM ha davvero mandato, e lo stato del canale di consegna.

Fonte primaria e' il database, non Resend: il motore degli invii e' il CRM in
codice (l'automation di Resend e' disabilitata dal 27/07), quindi
`crm_trigger_sends` e' il registro di cio' che e' partito. Resend serve a
sapere se e' anche ARRIVATO — domini autenticati, bounce, consegne.
"""

import requests

from ..contract import Check, Verdict, amber, green, info, red, unknown
from ..db import DbUnavailable, fetch_all, load_all_env

RESEND = "https://api.resend.com"


def check_invii_crm() -> Verdict:
    """Quante mail il CRM ha mandato, con lo spaccato per trigger."""
    try:
        finestre = fetch_all(
            "select count(*) filter (where sent_at > now() - interval '7 days'), "
            "       count(*) filter (where sent_at > now() - interval '30 days'), "
            "       count(*), count(distinct identifier) from crm_trigger_sends"
        )[0]
        per_trigger = fetch_all(
            "select trigger_key, count(*) from crm_trigger_sends "
            "where sent_at > now() - interval '30 days' group by 1 order by 2 desc"
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:crm_trigger_sends")

    sette, trenta, totale, destinatari = (int(x or 0) for x in finestre)
    return info(
        f"{sette} in 7 giorni, {trenta} in 30, {totale} in tutto verso {destinatari} indirizzi",
        "db:crm_trigger_sends",
        value=sette,
        evidence={
            "invii_7g": sette, "invii_30g": trenta, "invii_totali": totale,
            "destinatari_distinti": destinatari,
            "per_trigger_30g": {r[0]: int(r[1]) for r in per_trigger},
        },
    )


def check_copertura_trigger() -> Verdict:
    """I trigger che non hanno mai mandato niente.

    Un trigger a zero invii non e' un dettaglio: significa che un pezzo del
    ciclo di vita non raggiunge nessuno. `onb_activate` ha mandato una sola
    mail in tutto (misurato il 2026-08-20) — e' il benvenuto ai free.
    """
    try:
        righe = fetch_all(
            "select trigger_key, count(*), max(sent_at)::date "
            "from crm_trigger_sends group by 1 order by 2"
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:crm_trigger_sends")
    if not righe:
        return red("nessun trigger ha mai mandato una mail", "db:crm_trigger_sends")

    magri = [(r[0], int(r[1])) for r in righe if int(r[1]) <= 1]
    prove = {"per_trigger": {r[0]: int(r[1]) for r in righe}}
    if magri:
        nomi = ", ".join(f"{t} ({n})" for t, n in magri[:4])
        return amber(
            f"{len(magri)} trigger con un invio o meno: {nomi}",
            "db:crm_trigger_sends", value=len(magri), evidence=prove,
        )
    return green(f"{len(righe)} trigger attivi", "db:crm_trigger_sends",
                 value=len(righe), evidence=prove)


def _chiave() -> str | None:
    valore = load_all_env().get("RESEND_API_KEY")
    return valore if valore and valore.strip() else None


def check_resend_domini() -> Verdict:
    """Domini di invio e loro autenticazione (spf/dkim/dmarc)."""
    chiave = _chiave()
    if not chiave:
        return unknown(
            "manca RESEND_API_KEY: Vercel la marca sensitive e non la restituisce "
            "(verificato: 28 valori su 106 nel pull). Va incollata in "
            "~/.betredge-cc/credentials.env",
            "resend api",
        )
    try:
        resp = requests.get(f"{RESEND}/domains", headers={"Authorization": f"Bearer {chiave}"}, timeout=20)
        corpo = resp.json()
    except Exception as exc:  # noqa: BLE001
        return unknown(f"resend non raggiungibile: {exc}", "resend api")
    if resp.status_code != 200:
        return unknown(
            f"resend rifiuta la chiave: {corpo.get('message', resp.status_code)}", "resend api"
        )

    domini = corpo.get("data", [])
    if not domini:
        return red("nessun dominio configurato su Resend", "resend api:domains")
    non_verificati = [d.get("name") for d in domini if d.get("status") != "verified"]
    prove = {d.get("name"): d.get("status") for d in domini}
    if non_verificati:
        return red(
            f"domini non verificati: {', '.join(str(x) for x in non_verificati)}",
            "resend api:domains", value=f"{len(domini) - len(non_verificati)}/{len(domini)}",
            evidence=prove,
        )
    return green(
        f"{len(domini)} domini verificati", "resend api:domains",
        value=f"{len(domini)}/{len(domini)}", evidence=prove,
    )


def check_resend_consegne() -> Verdict:
    """Le ultime mail secondo Resend: consegnate, bounce, complaint."""
    chiave = _chiave()
    if not chiave:
        return unknown(
            "manca RESEND_API_KEY: serve per sapere se le mail sono ARRIVATE "
            "(il database dice solo che sono partite)",
            "resend api",
        )
    try:
        resp = requests.get(
            f"{RESEND}/emails", headers={"Authorization": f"Bearer {chiave}"}, timeout=20
        )
        corpo = resp.json()
    except Exception as exc:  # noqa: BLE001
        return unknown(f"resend non raggiungibile: {exc}", "resend api")
    if resp.status_code != 200:
        return unknown(
            f"resend non elenca le mail: {corpo.get('message', resp.status_code)}",
            "resend api:emails",
        )

    mail = corpo.get("data", [])
    if not mail:
        return info("nessuna mail nell'elenco di Resend", "resend api:emails", value=0)
    per_stato: dict[str, int] = {}
    for m in mail:
        per_stato[m.get("last_event", "?")] = per_stato.get(m.get("last_event", "?"), 0) + 1
    guasti = sum(per_stato.get(s, 0) for s in ("bounced", "complained", "failed"))
    if guasti:
        return amber(
            f"{guasti} su {len(mail)} non consegnate", "resend api:emails",
            value=guasti, evidence=per_stato,
        )
    return green(f"{len(mail)} mail, nessun bounce", "resend api:emails",
                 value=len(mail), evidence=per_stato)


def checks() -> list[Check]:
    return [
        Check("crm_invii", "email", "Invii CRM", check_invii_crm, timeout_seconds=25),
        Check("crm_copertura", "email", "Copertura trigger", check_copertura_trigger, timeout_seconds=25),
        Check("resend_domini", "email", "Domini Resend", check_resend_domini,
              ttl_seconds=3600, timeout_seconds=25),
        Check("resend_consegne", "email", "Consegne Resend", check_resend_consegne,
              ttl_seconds=1800, timeout_seconds=25),
    ]
