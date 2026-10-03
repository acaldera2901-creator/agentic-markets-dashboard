"""I percorsi dell'utente finale: il prodotto funziona per chi lo usa?

Gli altri check misurano i pezzi (pagine 200, DB, daemon, claim). Questi
misurano cosa vede un visitatore anonimo su betredge.com in produzione, con un
browser vero: le pagine sono client-rendered, e l'HTML del server dice
«Nothing to show right now» anche quando la board e' piena (misurato 03/10).
Una sonda curl qui produrrebbe rossi falsi, o verdi falsi.

Regole della sonda (#TORRE-PERCORSI-0310):
- SOLO lettura. Ogni richiesta non-GET del browser viene abortita: niente
  /api/track (inquinerebbe il funnel con un bot ogni ora), niente submit,
  niente account, niente checkout. Le interazioni sono click che aprono UI.
- Un solo giro di browser condiviso fra i sei check, e TTL di un'ora: 5
  pagine all'ora, non 5 ogni 5 minuti. Il Vercel Security Checkpoint scatta
  sul polling aggressivo; se scatta lo stesso, il verdetto e' '?', non rosso.
- Playwright solo se e' gia' nel venv: se manca, '?' col motivo.
- Viewport 390px per tutto il giro: il percorso mobile e' quello piu' fragile,
  e misurarlo una volta sola tiene basso il numero di richieste.
"""

import re
import threading
import time

from ..contract import Check, Verdict, amber, green, red, unknown

BASE = "https://www.betredge.com"
# UA onesto: un browser mobile vero, piu' il nome della sonda, cosi' chi legge
# i log di Vercel sa chi e'.
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Mobile/15E148 BetRedge-ControlCenter/1.0 (+torre percorsi)")
VIEWPORT = {"width": 390, "height": 844}
MOBILE_PAGES = ("/", "/predictions", "/plans", "/history")
PAGE_TIMEOUT_MS = 30_000

# Misurato il 03/10 alle 12 UTC: la home mostrava 35 card con la probabilita'
# del modello (33 bloccate + 2 letture complete) con 198 partite di calcio e
# 80 di tennis nelle API. 6 e' una sezione piena (Top opportunities ne mostra
# 6): sotto quella soglia la board e' semi-vuota, non rotta, quindi ambra.
BOARD_MIN = 6
# Il «perche'» di una lettura completa: sotto i 40 caratteri non e' una
# spiegazione, e' un'etichetta. Le due misurate il 03/10 erano 230 e 210.
WHY_MIN_CHARS = 40
PIANI_ATTESI = ("Free", "Base", "Pro")
# Un pixel di tolleranza: lo scrollbar e l'arrotondamento subpixel.
OVERFLOW_TOLLERANZA_PX = 1

_CACHE: dict = {}
_LOCK = threading.Lock()
_CACHE_S = 60  # i sei check dello stesso giro condividono un solo browser

_JS_CARDS = """() => [...document.querySelectorAll('article.br-card')].map(a => ({
  variant: a.dataset.variant || '',
  model: (a.querySelector('.br-card__model-n')?.textContent || '').replace('%', '').trim(),
  pick: a.querySelector('.br-card__pick-v')?.dataset.locked !== 'true',
  why: (a.querySelector('.br-card__why')?.textContent || '').trim(),
}))"""

_JS_SIGNUP = """() => {
  const m = document.querySelector('.auth-modal');
  if (!m) return {modal: false};
  const box = m.querySelectorAll('.auth-consent input[type=checkbox]');
  const terms = !!m.querySelector('.auth-consent a[href="/terms"]');
  const submit = [...m.querySelectorAll('button')].find(b => b.previousElementSibling
    && b.previousElementSibling.classList.contains('auth-consent'));
  return {modal: true,
          create: !!m.querySelector('input[autocomplete="new-password"]'),
          checkbox: box.length, checked: [...box].filter(b => b.checked).length,
          terms_link: terms, submit_disabled: submit ? submit.disabled : null};
}"""

_JS_PLANS = """() => [...document.querySelectorAll('article.plan-card')].map(c => ({
  nome: (c.querySelector('.plan-card-head h4')?.textContent || '').trim(),
  prezzo: (c.querySelector('.price-line strong')?.textContent || '').trim(),
}))"""

_JS_HISTORY = """() => ({
  kpi: [...document.querySelectorAll('.am-statbar .am-kpi .v')].map(e => e.textContent.trim()),
  won: (document.querySelector('.tr-big.tr-win')?.textContent || '').trim(),
})"""

_JS_OVERFLOW = """() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]"""


class PlaywrightUnavailable(Exception):
    """Playwright o il suo chromium non ci sono: il percorso diventa '?'."""


def _bloccata(status: int | None, title: str) -> bool:
    return status in (403, 429) or "checkpoint" in (title or "").lower()


def _visita(pagina, path: str, osservazione: dict) -> bool:
    """Apre la pagina e registra status, titolo, larghezze. False se bloccata."""
    risposta = pagina.goto(BASE + path, wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
    status = risposta.status if risposta else None
    titolo = pagina.title()
    scroll_w, client_w = pagina.evaluate(_JS_OVERFLOW)
    bloccata = _bloccata(status, titolo)
    osservazione["pagine"][path] = {"status": status, "title": titolo[:80],
                                    "scroll_w": scroll_w, "client_w": client_w,
                                    "bloccata": bloccata}
    return not bloccata


def _passo(osservazione: dict, nome: str, fn) -> None:
    # Un passo rotto non deve portarsi via gli altri cinque percorsi.
    try:
        fn()
    except Exception as exc:  # noqa: BLE001 - qualsiasi guasto e' un '?' di quel passo
        osservazione["errori"][nome] = f"{type(exc).__name__}: {str(exc)[:160]}"


def _giro() -> dict:
    """Un giro di browser: tutte le osservazioni dei sei percorsi."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise PlaywrightUnavailable("serve playwright nel venv (non installato)") from exc

    oss: dict = {"pagine": {}, "errori": {}, "api": {}}

    def _ascolta(risposta):
        url = risposta.url
        try:
            if "/api/predictions" in url and "/v2/" not in url:
                oss["api"]["calcio"] = int(risposta.json().get("count") or 0)
            elif url.endswith("/api/tennis"):
                oss["api"]["tennis"] = len(risposta.json().get("matches") or [])
            elif "/api/v2/yesterday-read" in url:
                oss["api"]["letture"] = len(risposta.json().get("reads") or [])
            elif "/api/v2/history" in url:
                oss["api"]["history"] = risposta.json().get("stats") or {}
        except Exception:  # noqa: BLE001 - un corpo illeggibile resta non catturato
            pass

    def _solo_get(route):
        if route.request.method == "GET":
            route.continue_()
        else:
            oss.setdefault("abortite", 0)
            oss["abortite"] += 1
            route.abort()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                ctx = browser.new_context(user_agent=UA, viewport=VIEWPORT,
                                          is_mobile=True, has_touch=True)
                ctx.route("**/*", _solo_get)
                pagina = ctx.new_page()
                pagina.on("response", _ascolta)

                def board():
                    if not _visita(pagina, "/", oss):
                        return
                    oss["board"] = pagina.evaluate(_JS_CARDS)

                def gate():
                    if "board" not in oss:
                        raise RuntimeError("home non misurata")
                    # Il visitatore tocca una partita bloccata: deve aprirsi il
                    # gate (account), non un bottone morto.
                    cta = pagina.locator("article.br-card[data-variant=premiumLocked] a.br-cta")
                    if cta.count():
                        cta.first.click(timeout=8000)
                        pagina.wait_for_selector(".auth-modal", timeout=8000)
                        oss["gate"] = True
                        switch = pagina.locator(".auth-mode-switch button")
                        if switch.count() >= 2:
                            switch.nth(1).click(timeout=5000)  # «Create profile»: UI, nessun submit
                        oss["signup"] = pagina.evaluate(_JS_SIGNUP)
                    else:
                        oss["gate"] = None  # nessuna card bloccata da toccare

                def piani():
                    if not _visita(pagina, "/plans", oss):
                        return
                    oss["piani"] = pagina.evaluate(_JS_PLANS)
                    base = pagina.locator("article.plan-card").filter(
                        has=pagina.locator("h4", has_text="Base")).locator("button")
                    if base.count():
                        base.last.click(timeout=8000)
                        pagina.wait_for_selector(".auth-modal", timeout=8000)
                        oss["piani_cta"] = pagina.evaluate(_JS_SIGNUP)

                def storico():
                    if not _visita(pagina, "/history", oss):
                        return
                    pagina.wait_for_selector(".am-statbar .am-kpi .v", timeout=10000)
                    oss["history"] = pagina.evaluate(_JS_HISTORY)

                def predictions():
                    _visita(pagina, "/predictions", oss)

                _passo(oss, "board", board)
                _passo(oss, "gate", gate)
                _passo(oss, "piani", piani)
                _passo(oss, "storico", storico)
                _passo(oss, "predictions", predictions)
            finally:
                browser.close()
    except PlaywrightUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 - chromium assente o non avviabile
        if not oss["pagine"]:
            raise PlaywrightUnavailable(f"browser non avviabile: {str(exc)[:160]}") from exc
        oss["errori"]["browser"] = str(exc)[:160]
    return oss


def osserva() -> dict:
    """Il giro di browser, condiviso dai sei check dello stesso giro di torre."""
    with _LOCK:
        if _CACHE and time.monotonic() - _CACHE["at"] < _CACHE_S:
            if "errore" in _CACHE:
                raise PlaywrightUnavailable(_CACHE["errore"])
            return _CACHE["val"]
        try:
            val = _giro()
        except PlaywrightUnavailable as exc:
            _CACHE.clear()
            _CACHE.update(at=time.monotonic(), errore=str(exc))
            raise
        _CACHE.clear()
        _CACHE.update(at=time.monotonic(), val=val)
        return val


def _misura(fonte: str, passo: str, path: str):
    """(osservazione, None) oppure (None, Verdict unknown) col motivo."""
    try:
        oss = osserva()
    except PlaywrightUnavailable as exc:
        return None, unknown(f"non misurato: {exc}", fonte)
    pagina = oss["pagine"].get(path) or {}
    if pagina.get("bloccata"):
        return None, unknown(f"{path} bloccata dal Vercel Security Checkpoint "
                             f"(status {pagina.get('status')})", fonte, evidence=pagina)
    if passo in oss["errori"]:
        return None, unknown(f"non misurato: {oss['errori'][passo]}", fonte,
                             evidence={"pagina": pagina})
    return oss, None


def _intero(testo) -> int | None:
    cifre = re.sub(r"\D", "", str(testo or ""))
    return int(cifre) if cifre else None


def _percento(testo) -> str | None:
    m = re.search(r"\d+(?:[.,]\d+)?", str(testo or ""))
    return m.group(0).replace(",", ".") if m else None


# ── 1 · il visitatore anonimo vede la board ────────────────────────────────
def check_percorso_board() -> Verdict:
    fonte = f"browser:{BASE}/"
    soglia = f">= {BOARD_MIN} partite con la probabilita' del modello"
    oss, nonmisurato = _misura(fonte, "board", "/")
    if nonmisurato:
        return nonmisurato
    cards = oss.get("board") or []
    con_previsione = [c for c in cards if c.get("model", "").isdigit()]
    n = len(con_previsione)
    in_api = sum(v for k, v in oss["api"].items() if k in ("calcio", "tennis"))
    prova = {"soglia": soglia, "card": len(cards), "con_previsione": n,
             "api": {k: oss["api"].get(k) for k in ("calcio", "tennis")},
             "riparo": "la home non disegna le card: guarda /api/predictions e "
                       "/api/tennis nel browser e il render di article.br-card"}
    if n >= BOARD_MIN:
        return green(f"la home mostra {n} partite con previsione", fonte, value=n, evidence=prova)
    if n > 0:
        return amber(f"la home mostra solo {n} partite con previsione", fonte,
                     value=n, evidence=prova)
    if in_api > 0:
        return red(f"la home e' vuota ma le API servono {in_api} partite", fonte,
                   value=0, evidence=prova)
    return unknown("home vuota e API vuote (o non catturate): niente da mostrare, "
                   "non una rottura misurata", fonte, evidence=prova)


# ── 2 · una partita mostra previsione e perche' ────────────────────────────
def check_percorso_scheda_partita() -> Verdict:
    """Cosa un anonimo puo' leggere di una partita, e cosa succede se la tocca.

    Per un anonimo ogni card della board e' bloccata (modalEnabled = !locked,
    app/app/page.tsx): la scheda completa NON si apre, si apre il gate. La
    lettura completa che un anonimo vede davvero e' «Ieri · esito reale»:
    pick, probabilita' e il perche', servita da /api/v2/yesterday-read.
    La scheda di un utente Free/Pro richiede un account: non misurata.
    """
    fonte = f"browser:{BASE}/+api:/api/v2/yesterday-read"
    soglia = f"ogni lettura completa con pick, % e perche' (>= {WHY_MIN_CHARS} caratteri)"
    oss, nonmisurato = _misura(fonte, "board", "/")
    if nonmisurato:
        return nonmisurato
    letture = [c for c in oss.get("board") or [] if c.get("variant") == "settled"]
    complete = [c for c in letture if c.get("pick") and c.get("model", "").isdigit()
                and len(c.get("why", "")) >= WHY_MIN_CHARS]
    in_api = oss["api"].get("letture")
    prova = {"soglia": soglia, "letture": len(letture), "complete": len(complete),
             "api_letture": in_api,
             "gate_su_card_bloccata": oss["errori"].get("gate") or oss.get("gate"),
             "non_misura": "la scheda completa di un utente Free/Pro (serve un account)",
             "riparo": "card «settled» senza il perche': guarda .br-card__why e il campo "
                       "explanation di /api/v2/yesterday-read"}
    if letture and len(complete) < len(letture):
        return red(f"{len(letture) - len(complete)} letture su {len(letture)} senza "
                   f"previsione o senza perche'", fonte,
                   value=f"{len(complete)}/{len(letture)}", evidence=prova)
    if not letture:
        if in_api:
            return red(f"l'API serve {in_api} letture, la home non ne mostra nessuna",
                       fonte, value=0, evidence=prova)
        return unknown("nessuna lettura completa pubblica oggi: niente da misurare",
                       fonte, evidence=prova)
    gate = "; partita bloccata -> gate account" if oss.get("gate") is True else ""
    return green(f"{len(complete)} letture complete con previsione e perche'{gate}",
                 fonte, value=f"{len(complete)}/{len(letture)}", evidence=prova)


# ── 3 · piani e CTA ────────────────────────────────────────────────────────
def check_percorso_piani() -> Verdict:
    fonte = f"browser:{BASE}/plans"
    soglia = "Free, Base e Pro con prezzo; la CTA a pagamento apre il passo account"
    oss, nonmisurato = _misura(fonte, "piani", "/plans")
    if nonmisurato:
        return nonmisurato
    piani = oss.get("piani") or []
    # Il nome sta nell'h4 («BetRedge Pro»): l'eyebrow e' copy («Everything»).
    visti = {n: p["prezzo"] for p in piani for n in PIANI_ATTESI
             if n in (p.get("nome") or "").split()}
    mancanti = [n for n in PIANI_ATTESI if not visti.get(n)]
    cta = oss.get("piani_cta") or {}
    prova = {"soglia": soglia, "piani": visti, "cta": cta,
             "non_misura": "il checkout dopo l'account (POST /api/paygate/checkout e "
                           "Shopify richiedono una sessione): nessun ordine viene creato",
             "riparo": "piano senza prezzo o CTA morta: guarda article.plan-card in /plans"}
    if mancanti:
        return red(f"/plans non mostra: {', '.join(mancanti)}", fonte,
                   value=f"{len(PIANI_ATTESI) - len(mancanti)}/{len(PIANI_ATTESI)}",
                   evidence=prova)
    if not (cta.get("modal") and cta.get("create")):
        return red("«Start with Base» non porta al passo account", fonte, evidence=prova)
    prezzi = " · ".join(f"{n} {visti[n]}" for n in PIANI_ATTESI)
    return green(f"{prezzi}; la CTA apre l'account (checkout oltre: non misurato)",
                 fonte, value="3/3", evidence=prova)


# ── 4 · signup con gate +18 e ToS ──────────────────────────────────────────
def check_percorso_signup() -> Verdict:
    fonte = f"browser:{BASE}/ (modale account)"
    soglia = "form con +18 e ToS non pre-spuntati e invio disabilitato finche' mancano"
    oss, nonmisurato = _misura(fonte, "gate", "/")
    if nonmisurato:
        return nonmisurato
    s = oss.get("signup")
    prova = {"soglia": soglia, "form": s,
             "non_misura": "la creazione dell'account (nessun submit)",
             "riparo": "#SIGNUP-GATE in app/app/page.tsx: +18 e ToS obbligatori"}
    if s is None:
        return unknown("nessuna partita bloccata da toccare: modale non aperta", fonte,
                       evidence=prova)
    if not s.get("modal") or not s.get("create"):
        return red("il form di registrazione non si apre", fonte, evidence=prova)
    difetti = []
    if s.get("checkbox", 0) < 2:
        difetti.append(f"{s.get('checkbox', 0)} caselle di consenso invece di >= 2")
    if s.get("checked"):
        difetti.append(f"{s['checked']} caselle gia' spuntate")
    if not s.get("terms_link"):
        difetti.append("manca il link ai Terms")
    if s.get("submit_disabled") is not True:
        difetti.append("invio non bloccato senza consenso")
    if difetti:
        return red("gate di registrazione incompleto: " + "; ".join(difetti), fonte,
                   evidence=prova)
    return green("form con +18 e ToS, invio bloccato finche' non spuntati", fonte,
                 value=f"{s['checkbox']} consensi", evidence=prova)


# ── 5 · track record: pagina = API ─────────────────────────────────────────
def check_percorso_track_record() -> Verdict:
    """/history mostra gli stessi numeri che la sua API le ha servito?

    Complementare a `history_coerente` (API = codice sul DB): insieme fanno la
    catena pagina = API = DB. Il confronto usa la risposta che la pagina stessa
    ha ricevuto, quindi un settlement fra due richieste non crea rossi falsi.
    """
    fonte = f"browser:{BASE}/history+api:/api/v2/history"
    soglia = "settled, vinte e hit rate della pagina identici all'API"
    oss, nonmisurato = _misura(fonte, "storico", "/history")
    if nonmisurato:
        return nonmisurato
    h = oss.get("history") or {}
    api = oss["api"].get("history")
    if not api:
        return unknown("risposta di /api/v2/history non catturata", fonte,
                       evidence={"soglia": soglia, "pagina": h})
    kpi = h.get("kpi") or []
    pagina = {"n": _intero(kpi[0]) if kpi else None, "won": _intero(h.get("won")),
              "hit": _percento(kpi[2]) if len(kpi) > 2 else None}
    attesa = {"n": api.get("n"), "won": api.get("won"), "hit": _percento(api.get("win_rate"))}
    prova = {"soglia": soglia, "pagina": pagina, "api": attesa,
             "riparo": "la pagina ricalcola o arrotonda in proprio: deve leggere stats "
                       "di /api/v2/history"}
    if None in pagina.values():
        return unknown("numeri della pagina non leggibili (markup cambiato?)", fonte,
                       evidence=prova)
    diversi = [k for k in pagina if str(pagina[k]) != str(attesa[k])]
    if diversi:
        return red(f"/history mostra {pagina}, l'API dice {attesa}", fonte,
                   value=f"diversi: {', '.join(diversi)}", evidence=prova)
    return green(f"/history = API: {pagina['n']} settled, {pagina['won']} vinte, "
                 f"{pagina['hit']}%", fonte, value=pagina["n"], evidence=prova)


# ── 6 · mobile 390px senza overflow orizzontale ───────────────────────────
def check_percorso_mobile() -> Verdict:
    fonte = f"browser:{BASE} @390px"
    soglia = f"scrollWidth <= clientWidth + {OVERFLOW_TOLLERANZA_PX}px su {len(MOBILE_PAGES)} pagine"
    try:
        oss = osserva()
    except PlaywrightUnavailable as exc:
        return unknown(f"non misurato: {exc}", fonte)
    pagine = oss["pagine"]
    misurate = {p: pagine[p] for p in MOBILE_PAGES if p in pagine and not pagine[p]["bloccata"]}
    prova = {"soglia": soglia,
             "larghezze": {p: f"{v['scroll_w']}/{v['client_w']}" for p, v in misurate.items()},
             "non_misura": "testo tagliato da overflow-x:hidden (non scorre, quindi non e' "
                           "overflow per chi usa la pagina)",
             "riparo": "un elemento piu' largo di 390px: cercalo con scrollWidth in devtools"}
    if not misurate:
        return unknown("nessuna pagina misurata a 390px", fonte, evidence=prova)
    larghe = [p for p, v in misurate.items()
              if v["scroll_w"] > v["client_w"] + OVERFLOW_TOLLERANZA_PX]
    if larghe:
        return red(f"overflow orizzontale a 390px: {', '.join(larghe)}", fonte,
                   value=f"{len(misurate) - len(larghe)}/{len(misurate)}", evidence=prova)
    mancanti = [p for p in MOBILE_PAGES if p not in misurate]
    if mancanti:
        return amber(f"{len(misurate)} pagine ok a 390px, non misurate: {', '.join(mancanti)}",
                     fonte, value=f"{len(misurate)}/{len(MOBILE_PAGES)}", evidence=prova)
    return green(f"{len(misurate)} pagine su {len(MOBILE_PAGES)} senza overflow a 390px",
                 fonte, value=f"{len(misurate)}/{len(MOBILE_PAGES)}", evidence=prova)


def checks() -> list[Check]:
    # TTL un'ora: il giro costa un chromium e 4 pagine. Il timeout copre
    # l'attesa sul lock: cinque check aspettano che il primo finisca il giro.
    ttl, timeout = 3600, 150
    return [
        Check("percorso_board", "percorsi", "Board per l'anonimo",
              check_percorso_board, ttl_seconds=ttl, timeout_seconds=timeout),
        Check("percorso_scheda_partita", "percorsi", "Lettura partita con perche'",
              check_percorso_scheda_partita, ttl_seconds=ttl, timeout_seconds=timeout),
        Check("percorso_piani", "percorsi", "Piani e CTA fino all'account",
              check_percorso_piani, ttl_seconds=ttl, timeout_seconds=timeout),
        Check("percorso_signup", "percorsi", "Signup con +18 e ToS",
              check_percorso_signup, ttl_seconds=ttl, timeout_seconds=timeout),
        Check("percorso_track_record", "percorsi", "Track record pagina = API",
              check_percorso_track_record, ttl_seconds=ttl, timeout_seconds=timeout),
        Check("percorso_mobile", "percorsi", "Mobile 390px senza overflow",
              check_percorso_mobile, ttl_seconds=ttl, timeout_seconds=timeout),
    ]
