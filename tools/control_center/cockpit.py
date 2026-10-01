"""Il cockpit di un'area: cosa chiede ad Andrea, a che punto sono i progetti,
cosa e' fermo. Una vista, non un registro (#UNIONE-0907).

I task vivono nel blocco STATO delle project card, come righe di una lista
sotto `**Task:**`. Questo modulo li legge, li incrocia coi check dello
snapshot e ne scrive **una sola cosa**: la spunta di un task (`segna_fatto`).

Tre scelte che non si leggono dal codice:

1. **Rosso = Andrea deve agire.** Un check rosso entra in `richiedono_te`
   solo se nessuno lo ha gia' preso in carico: se una card ha un task aperto
   con `check:<id>` e owner diverso da Andrea, e' "gia' discusso e assegnato"
   e sta nella salute del progetto, non in cima alla pagina. Un rosso che
   nessun task cita invece entra sempre: e' misurato, e il primo gesto
   (triage) tocca a lui.
2. **L'ambra non chiede niente da sola.** Come nelle notifiche ("ambra non
   notifica mai"), un ambra o un non-misurato entra in `richiedono_te` solo
   se un task aperto di Andrea lo cita; altrimenti va in `da_osservare`.
3. **Il check chiude il task, non la spunta.** Un task con `check:<id>` e'
   chiuso quando il check e' verde, anche se nessuno lo ha spuntato
   (stato `verificato dal check`); se e' spuntato ma il check e' rosso torna
   aperto (`riaperto dal check`). La spunta a mano resta vera solo per i
   task che nessun check misura.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import progetti

# Lo snapshot della torre e' quello di BetRedge: i suoi check appartengono a
# quest'area. Quando un'altra area avra' i suoi check, il check dichiarera'
# l'area (campo `area` nel Verdict) — oggi non ne esiste un secondo.
AREA_DEI_CHECK = "betredge"
STALE_GIORNI = 14
RUN_SECONDI = 300  # il collector gira ogni 5 minuti: `red_runs` * 5 min = da quanto

_TASK = re.compile(r"^\s*[-*]\s+\[([ xX])\]\s+(.*?)\s*$")
_INTESTA_TASK = re.compile(r"^\*\*Task:?\*\*:?\s*$", re.I)
# Un goal e' una voce di lista senza casella: `- testo · attuale:v · obiettivo:v`.
_GOAL = re.compile(r"^\s*[-*]\s+(?!\[[ xX]\])(.*?)\s*$")
_INTESTA_GOAL = re.compile(r"^\*\*Goal:?\*\*:?\s*$", re.I)
_ATTRIBUTO_GOAL = re.compile(r"^(attuale|obiettivo|check):\s*(\S.*)$", re.I)
NON_MISURATO = "non misurato"
DA_DECIDERE = "da decidere"
_CAMPO = re.compile(r"^\*\*[^*]+\*\*")
_ATTRIBUTO = re.compile(r"^(scad|check|fatto):\s*(\S.*)$", re.I)
_DATA = re.compile(r"\d{4}-\d{2}-\d{2}")
_AREA_OK = re.compile(r"^[a-z0-9][a-z0-9_-]{0,40}$")
# "— *owner: Andrea*", "attende Andrea", "in attesa di Andrea"
_ATTENDE_ANDREA = re.compile(
    r"owner\W{0,4}andrea|(?:attesa|attende|aspetta)\W+(?:di\W+|la\W+)?(?:risposta\W+di\W+)?andrea",
    re.I)
_QUOTE = re.compile(r"^\s*>\s?")
# Chi puo' essere owner di un task. Una lista e non una sottostringa: con
# `"andrea" in owner` erano di Andrea anche `ui-andrea` e «Claude → dopo OK
# Andrea». Un nome che non e' qui vale owner solo nella forma `Nome → Nome`.
NOMI_NOTI = {
    "andrea", "michele", "claude", "tommy", "steve", "codex", "fredrik", "collaboratrice",
    "segretaria", "art-director", "ui-andrea", "programmatore-andrea", "qa-andrea",
    "ml-engineer-agentic", "marketing-betredge", "social-media-manager",
    "sports-news-curator", "reddit-betredge", "legale-compliance", "legale-contratti",
    "legale-societario", "custode-mac", "graphic-designer", "brand-visual-designer",
}
_SEP_OWNER = re.compile(r"\s*(?:→|->|/|\+|&|,)\s*|\s+")
_OWNER_FRECCIA = re.compile(r"^[A-ZÀ-Ý][\w'-]*\s*(?:→|->)\s*\S")
_NUMERO = re.compile(r"-?\d+(?:[.,]\d+)?")


# --------------------------------------------------------------------------
# parser

def _riga_pulita(riga: str) -> str:
    return _QUOTE.sub("", riga)


def attore(owner: str | None) -> str | None:
    """Chi agisce per primo: `Claude → dopo OK Andrea` e' di Claude."""
    if not owner or not owner.strip():
        return None
    return _SEP_OWNER.split(owner.strip(), maxsplit=1)[0].lower() or None


def _e_owner(pezzo: str) -> bool:
    if not pezzo or len(pezzo) > 60:
        return False
    return attore(pezzo) in NOMI_NOTI or bool(_OWNER_FRECCIA.match(pezzo))


def _parse_task(corpo: str) -> dict:
    """`testo · owner · scad:AAAA-MM-GG · check:id[,id] · fatto:AAAA-MM-GG`.

    Il primo pezzo e' il testo; un pezzo `chiave:valore` noto e' un attributo;
    l'owner e' il primo pezzo che *ha la forma* di un owner (un nome di
    `NOMI_NOTI`, o `Nome → Nome`). Ogni altro pezzo torna nel testo, cosi' un
    `·` scritto nella frase («toccato … · done quando») non diventa l'owner.
    """
    pezzi = [p.strip() for p in corpo.split(" · ")]
    testo, owner, scad, fatto_il, checks, resto = pezzi[0], None, None, None, [], []
    for p in pezzi[1:]:
        m = _ATTRIBUTO.match(p)
        if m:
            chiave, valore = m.group(1).lower(), m.group(2).strip()
            if chiave == "check":
                checks += [c.strip() for c in valore.split(",") if c.strip()]
            elif chiave == "scad":
                scad = valore if _DATA.fullmatch(valore) else None
            else:
                fatto_il = valore if _DATA.fullmatch(valore) else None
        elif owner is None and _e_owner(p):
            owner = p
        else:
            resto.append(p)
    if resto:
        testo = " · ".join([testo, *resto])
    return {"testo": testo, "owner": owner, "scad": scad,
            "fatto_il": fatto_il, "checks": checks}


def _righe_task(testo: str, intesta=_INTESTA_TASK, voce=_TASK):
    """(numero di riga nel file, riga senza `>`, match) per ogni task del
    blocco STATO. Un generatore solo, usato sia per leggere sia per scrivere:
    se le due strade contassero diversamente, `indice` punterebbe a un altro
    task. Con `intesta`/`voce` di goal legge la lista `**Goal:**`."""
    dentro_stato = dentro_task = False
    for n, riga in enumerate(testo.splitlines()):
        if "<!-- STATO:start -->" in riga:
            dentro_stato = True
            continue
        if "<!-- STATO:end -->" in riga:
            return
        if not dentro_stato:
            continue
        pulita = _riga_pulita(riga).strip()
        if intesta.match(pulita):
            dentro_task = True
            continue
        if not dentro_task:
            continue
        if _CAMPO.match(pulita):   # il campo successivo chiude la lista
            dentro_task = False
            continue
        m = voce.match(_riga_pulita(riga))
        if m:
            yield n, riga, m


def tasks(testo: str) -> list[dict]:
    """I task del blocco STATO di una card. Lista vuota se la card non ne ha:
    una card vecchia senza `**Task:**` resta valida com'e'."""
    fuori = []
    for i, (n, _riga, m) in enumerate(_righe_task(testo)):
        t = _parse_task(m.group(2))
        t.update({"indice": i, "riga": n + 1, "spuntato": m.group(1).lower() == "x"})
        fuori.append(t)
    return fuori


def goals(testo: str) -> list[dict]:
    """La lista `**Goal:**` di una card-progetto. Un valore assente vale
    `non misurato` / `da decidere`: il cockpit non inventa numeri. `numerico`
    dice se attuale e obiettivo sono entrambi cifre confrontabili."""
    fuori = []
    for _n, _riga, m in _righe_task(testo, _INTESTA_GOAL, _GOAL):
        pezzi = [p.strip() for p in m.group(1).split(" · ")]
        g = {"testo": pezzi[0], "attuale": NON_MISURATO, "obiettivo": DA_DECIDERE,
             "checks": []}
        resto = []
        for p in pezzi[1:]:
            a = _ATTRIBUTO_GOAL.match(p)
            if not a:
                resto.append(p)
            elif a.group(1).lower() == "check":
                g["checks"] += [c.strip() for c in a.group(2).split(",") if c.strip()]
            else:
                g[a.group(1).lower()] = a.group(2).strip()
        if resto:
            g["testo"] = " · ".join([g["testo"], *resto])
        g["numerico"] = all(_numero(g[k]) is not None for k in ("attuale", "obiettivo"))
        fuori.append(g)
    return fuori


def _numero(valore: str) -> float | None:
    m = re.match(r"^\s*(-?\d+(?:[.,]\d+)?)", valore or "")
    return float(m.group(1).replace(",", ".")) if m else None


def e_progetto(campi: dict) -> bool:
    """`**Tipo:** progetto` fa della card un progetto di primo livello; senza,
    una card con `**Area:**` e' un workstream di quell'area."""
    return (campi.get("tipo") or "").strip().lower().startswith("progetto")


def nome_breve(campi: dict, stem: str) -> str:
    """`**Nome:**` se c'e', altrimenti il nome del file ripulito: il titolo e'
    la `description`, una frase intera, troppo lunga per una riga."""
    if campi.get("nome"):
        return campi["nome"]
    n = stem.removeprefix("project_").replace("_", " ").replace("-", " ").strip()
    return n[:1].upper() + n[1:]


def livello_ticket(t: dict) -> str:
    """Rosso se c'e' un check rosso misurato o e' un rosso senza owner
    (triage); il resto — scaduto, non misurato, BLOCCATO in attesa — ambra.
    La stessa regola di `livelloTicket` in cockpit.html."""
    if t.get("tipo") == "check" or any(e.get("level") == "red" for e in t.get("evidenza") or []):
        return "red"
    return "amber"


def livello_verdetto(richiedono: list[dict]) -> str:
    livelli = [livello_ticket(t) for t in richiedono]
    return "red" if "red" in livelli else "amber" if livelli else "green"


_ORDINE_LIVELLO = {"red": 0, "amber": 1, "unknown": 2, "sconosciuto": 2, "green": 3}


def _peggiore(livelli) -> str | None:
    return min((lv for lv in livelli if lv), key=lambda lv: _ORDINE_LIVELLO.get(lv, 4),
               default=None)


# --------------------------------------------------------------------------
# derivazione

def _e_andrea(owner: str | None) -> bool:
    return attore(owner) == "andrea"


def senza_numeri_fissi(testo: str) -> str:
    """Il titolo di un task senza le cifre copiate a mano nella card
    («sbloccare il settle: 1930 pick…» -> «sbloccare il settle»): il numero
    vero e' quello del check, e sta nel `perche`. Toglie le parentesi con
    cifre e la coda dopo `:` se contiene cifre; se non resta niente, il testo."""
    s = re.sub(r"\s*\([^)]*\d[^)]*\)", "", testo)
    s = re.sub(r":\s+[^:]*\d.*$", "", s).strip()
    return s or testo


def _numeri(testo: str | None) -> list[float]:
    return [float(n.replace(",", ".")) for n in _NUMERO.findall(testo or "")]


def _diverge(attuale: str | None, live: str | None) -> bool | None:
    """True se un numero scritto nella card non compare nel valore vivo.
    None se la card non scrive numeri o il check non c'e': niente da dire."""
    scritti = _numeri(attuale)
    if not scritti or live is None:
        return None
    vivi = _numeri(live)
    for n in scritti:
        if n in vivi:
            vivi.remove(n)
        else:
            return True
    return False


def _iso(quando: str | None) -> datetime | None:
    try:
        return datetime.strptime(quando, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def goal_live(g: dict, checks: dict, adesso: datetime) -> dict:
    """Il valore vivo dei check di un goal accanto al testo della card.
    Un check: la sua headline (e `value`). Piu' check: quanti sono verdi."""
    vivi = [checks[c] for c in g["checks"] if c in checks]
    fuori = {"attuale_live": None, "valore_live": None, "misurato_alle": None,
             "eta_live_min": None, "diverge": None}
    if not vivi:
        return fuori
    if len(g["checks"]) == 1:
        fuori["attuale_live"] = vivi[0].get("headline")
        fuori["valore_live"] = vivi[0].get("value")
    else:
        verdi = sum(1 for c in vivi if c.get("level") == "green")
        fuori["attuale_live"] = f"{verdi}/{len(g['checks'])} verdi"
        fuori["valore_live"] = verdi
    quando = [q for q in (_iso(c.get("measured_at")) for c in vivi) if q]
    if quando:
        vecchio = min(quando)   # il piu' vecchio: l'eta' non si abbellisce
        fuori["misurato_alle"] = vecchio.strftime("%Y-%m-%dT%H:%M:%SZ")
        fuori["eta_live_min"] = int((adesso - vecchio).total_seconds() // 60)
    fuori["diverge"] = _diverge(g.get("attuale"), fuori["attuale_live"])
    return fuori


SPUNTATO_NON_VERDE = "spuntato ma il check non è verde"


def stato_task(t: dict, checks: dict) -> str:
    """aperto · fatto · verificato dal check · riaperto dal check ·
    spuntato ma il check non è verde (ambra, non misurato o assente: la spunta
    a mano non chiude un task che un check misura)."""
    livelli = [(checks.get(c) or {}).get("level") for c in t["checks"]]
    if t["checks"] and all(lv == "green" for lv in livelli):
        return "fatto" if t["spuntato"] else "verificato dal check"
    if t["spuntato"]:
        if "red" in livelli:
            return "riaperto dal check"
        return SPUNTATO_NON_VERDE if t["checks"] else "fatto"
    return "aperto"


def _chiuso(stato: str) -> bool:
    return stato in ("fatto", "verificato dal check")


def _da_quando_check(check_id: str, stato: dict, inizi: dict | None = None) -> str | None:
    """Inizio della serie rossa corrente: il primo rosso in `history.jsonl`
    (`inizi`, da `inizi_rosso`); senza storico, la stima `red_runs` x 5 min,
    che perde ogni giro saltato (Mac in stop: 47 minuti persi misurati)."""
    if inizi and inizi.get(check_id):
        t = _iso(inizi[check_id])
        if t:
            return t.strftime("%Y-%m-%dT%H:%MZ")
    runs = int(((stato.get("alerts") or {}).get(check_id) or {}).get("red_runs") or 0)
    quando = ((stato.get("checks") or {}).get(check_id) or {}).get("measured_at")
    if not runs or not quando:
        return None
    try:
        t = datetime.strptime(quando, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return (t - timedelta(seconds=(runs - 1) * RUN_SECONDI)).strftime("%Y-%m-%dT%H:%MZ")


def _aree(valore: str | None) -> set[str]:
    return {a for a in re.split(r"[\s,/·]+", (valore or "").lower()) if a}


def _ultimo_tocco(scheda: dict, lista: list[dict]) -> str | None:
    """La data dichiarata nello STATO, o una spunta piu' recente. L'mtime solo
    come ripiego: un ritocco in blocco (il 31/08 ha toccato decine di card)
    la sposta senza che nessuno abbia lavorato al progetto."""
    date_ = [d for d in [scheda.get("stato_data"), *(t["fatto_il"] for t in lista)] if d]
    if date_:
        return max(date_)
    if scheda.get("modificato"):
        return datetime.fromtimestamp(scheda["modificato"]).date().isoformat()
    return None


def _giorni(dal: str | None, oggi: date) -> int | None:
    if not dal:
        return None
    try:
        return (oggi - date.fromisoformat(dal[:10])).days
    except ValueError:
        return None


def _ev_check(cid: str, stato: dict) -> dict:
    c = (stato.get("checks") or {}).get(cid) or {}
    return {"check": cid, "level": c.get("level", "sconosciuto"),
            "headline": c.get("headline"), "evidence": c.get("evidence"),
            "source": c.get("source"), "measured_at": c.get("measured_at")}


def _pending_di_andrea(pending: str | None) -> list[str]:
    """Le voci dei Pending che dicono esplicitamente che tocca ad Andrea
    (`Andrea: …`, `owner: Andrea`, `attende Andrea`). «scelta di Andrea» no:
    racconta una decisione, non chiede un gesto."""
    fuori = []
    for voce in re.split(r"\s+·\s+|;\s+", pending or ""):
        voce = voce.strip()
        if re.match(r"^\W*andrea\b\s*[:—–-]", voce, re.I) or _ATTENDE_ANDREA.search(voce):
            fuori.append(voce)
    return fuori


def costruisci(area: str, stato: dict, card: list[tuple[dict, str]],
               oggi: date | None = None, inizi: dict | None = None,
               adesso: datetime | None = None) -> dict:
    """Funzione pura: `card` e' [(scheda di progetti._scheda, testo)].
    `inizi` = {check: primo rosso della serie} da `inizi_rosso`; `adesso`
    serve solo all'eta' dei valori vivi dei goal."""
    oggi = oggi or date.today()
    adesso = adesso or datetime.now(timezone.utc)
    checks = stato.get("checks") or {}
    nostri_check = checks if area == AREA_DEI_CHECK else {}

    richiedono, progetti_, archivio, in_carico, in_coda = [], [], [], [], []
    progetto = None                      # la card `Tipo: progetto` dell'area
    avvisi: list[str] = []
    citati_da_andrea: set[str] = set()   # check coperti da un task di Andrea
    citati_da_altri: set[str] = set()    # check presi in carico da altri, su card viva
    fermi_da_altri: dict[str, dict] = {}  # check citati da altri solo su card ferme
    senza_owner: set[str] = set()        # check citati da task senza owner
    task_per_card: dict[str, list[dict]] = {}

    def _lv(c):
        return (nostri_check.get(c) or {}).get("level")

    for scheda, testo in card:
        campi = progetti._campi(progetti._blocco_stato(testo))
        if area not in _aree(campi.get("area")):
            continue
        lista = tasks(testo)
        for t in lista:
            t["stato"] = stato_task(t, nostri_check)
            t["attore"] = attore(t["owner"])
        tocco = _ultimo_tocco(scheda, lista)
        eta = _giorni(tocco, oggi)
        stale = eta is None or eta > STALE_GIORNI
        archiviata = scheda.get("fase") == "ARCHIVIATO"
        ferma = stale or archiviata
        fonte = f"card:{scheda['id']}"
        nome = nome_breve(campi, scheda["file"][:-3])
        task_per_card[scheda["id"]] = [{
            "testo": t["testo"], "owner": t["owner"], "attore": t["attore"],
            "stato": t["stato"], "scad": t["scad"], "check": t["checks"],
            "card": scheda["id"], "nome_card": nome, "fatto": t["fatto_il"],
            "spuntato": t["spuntato"], "indice": t["indice"]} for t in lista]

        for t in lista:
            if _chiuso(t["stato"]):
                continue
            non_verdi = [c for c in t["checks"] if _lv(c) != "green"]
            if not _e_andrea(t["owner"]):
                if non_verdi and t["attore"]:
                    in_carico.append({"titolo": t["testo"], "owner": t["owner"],
                                      "checks": non_verdi, "fonte": fonte,
                                      "card": scheda["id"], "nome_card": nome,
                                      "giorni_fermo": eta, "card_ferma": ferma})
                    if ferma:
                        # Una card archiviata o ferma non silenzia un rosso per
                        # sempre: resta in carico, ma il check resta a vista.
                        for c in non_verdi:
                            fermi_da_altri.setdefault(c, {"owner": t["owner"], "card": scheda["id"],
                                                          "giorni_fermo": eta})
                    else:
                        citati_da_altri.update(non_verdi)
                elif non_verdi:
                    senza_owner.update(non_verdi)   # nessuno lo ha preso: resta triage
                continue
            citati_da_andrea.update(t["checks"])
            scaduto = bool(t["scad"]) and t["scad"] < oggi.isoformat()
            if not (non_verdi or scaduto):
                if not ferma:
                    in_coda.append({"tipo": "task", "titolo": t["testo"], "card": scheda["id"],
                                    "nome_card": nome, "scad": t["scad"], "eta_giorni": eta,
                                    "fonte": f"{fonte} riga {t['riga']}", "indice": t["indice"]})
                continue
            if not non_verdi and stale:
                continue   # un task scaduto su una card ferma e' archivio, non urgenza
            perche = []
            if t["stato"] == "riaperto dal check":
                perche.append("spuntato ma il check e' ancora rosso: riaperto")
            elif t["stato"] == SPUNTATO_NON_VERDE:
                perche.append("spuntato a mano ma il check non e' verde: non e' fatto")
            for c in non_verdi:
                perche.append(f"{c} {_lv(c) or 'sconosciuto'}: "
                              f"{(nostri_check.get(c) or {}).get('headline', 'check assente dallo snapshot')}")
            if scaduto:
                perche.append(f"scaduto il {t['scad']}")
            da = [d for d in (_da_quando_check(c, stato, inizi) for c in non_verdi) if d]
            vivo = any(c in nostri_check for c in t["checks"])
            richiedono.append({
                "tipo": "task",
                "titolo": senza_numeri_fissi(t["testo"]) if vivo else t["testo"],
                "testo": t["testo"],    # il testo esatto della card: lo vuole /api/task/fatto
                "perche": " · ".join(perche),
                "evidenza": [_ev_check(c, stato) for c in non_verdi],
                "da_quando": min(da) if da else (t["scad"] if scaduto else None),
                "owner": t["owner"],
                "azione": t["testo"] + (" — si chiude da solo quando il check torna verde"
                                        if t["checks"] else ""),
                "fonte": f"{fonte} riga {t['riga']}", "progetto": scheda["id"],
                "indice": t["indice"],
            })

        if not ferma:
            pa = campi.get("prossima azione") or ""
            if (scheda.get("fase") == "BLOCCATO"
                    and (_ATTENDE_ANDREA.search(pa) or _ATTENDE_ANDREA.search(campi.get("fase") or ""))):
                in_coda.append({"tipo": "bloccato", "titolo": pa or scheda["titolo"],
                                "card": scheda["id"], "nome_card": nome, "scad": None,
                                "eta_giorni": eta, "fonte": fonte,
                                "perche": "progetto BLOCCATO in attesa di Andrea"})
            for voce in _pending_di_andrea(campi.get("pending")):
                in_coda.append({"tipo": "pending", "titolo": voce, "card": scheda["id"],
                                "nome_card": nome, "scad": None, "eta_giorni": eta,
                                "fonte": fonte})

        lista_goal = goals(testo) if e_progetto(campi) else []
        collegati = sorted({c for t in lista for c in t["checks"]}
                           | {c for g in lista_goal for c in g["checks"]})
        sal = [_ev_check(c, stato) for c in collegati]
        peggiore = _peggiore(c["level"] for c in sal)
        aperti = [t for t in lista if not _chiuso(t["stato"])]
        aperti.sort(key=lambda t: (t["scad"] or "9999", t["indice"]))
        verifica = _DATA.findall(campi.get("verifica") or "")
        if e_progetto(campi):
            if progetto is not None:
                avvisi.append(f"{scheda['id']}: seconda card Tipo progetto per l'area "
                              f"{area}, vale la prima ({progetto['id']})")
                task_per_card.pop(scheda["id"], None)
                continue
            for g in lista_goal:
                g["salute"] = _peggiore(_ev_check(c, stato)["level"] for c in g["checks"])
                g.update(goal_live(g, nostri_check, adesso))
            progetto = {
                "id": scheda["id"], "nome": nome,
                "titolo": scheda["titolo"], "fase": scheda.get("fase"),
                "done_quando": campi.get("done quando"),
                "prossima_azione": campi.get("prossima azione"),
                "goal": lista_goal, "salute": {"livello": peggiore, "checks": sal},
                "task_chiusi": len(lista) - len(aperti), "task_totali": len(lista),
                "ultimo_tocco": tocco, "giorni_fermo": eta,
            }
            continue
        voce = {
            "id": scheda["id"], "nome": nome,
            "titolo": scheda["titolo"], "fase": scheda.get("fase"),
            "goal": campi.get("goal") or campi.get("done quando"),
            "task_chiusi": len(lista) - len(aperti), "task_totali": len(lista),
            "prossimo_task": aperti[0]["testo"] if aperti else None,
            "prossima_azione": campi.get("prossima azione"),
            "salute": {"livello": peggiore, "checks": sal},
            "ultimo_tocco": tocco, "giorni_fermo": eta,
            "ultima_verifica": max(verifica) if verifica else scheda.get("stato_data"),
            "tasks": lista,
            "ferma": ferma, "perche_qui": None,
        }
        motivo = ("archiviato" if archiviata else f"fermo da {eta} giorni (> {STALE_GIORNI})")
        rossi_aperti = sorted({c for t in aperti for c in t["checks"] if _lv(c) == "red"})
        if ferma and not rossi_aperti:
            archivio.append({"id": voce["id"], "nome": voce["nome"], "titolo": voce["titolo"],
                             "fase": voce["fase"], "ultimo_tocco": tocco, "giorni_fermo": eta,
                             "task_chiusi": voce["task_chiusi"], "task_totali": voce["task_totali"],
                             "motivo": motivo})
        else:
            if ferma:
                # Una card che genera un rosso non e' archivio: sta qui, marcata.
                voce["perche_qui"] = (f"{motivo}, ma ha un task aperto su un check rosso: "
                                      + ", ".join(rossi_aperti))
            progetti_.append(voce)

    da_osservare = []
    for cid, c in nostri_check.items():
        lv = c.get("level")
        if lv not in ("red", "amber", "unknown") or cid in citati_da_andrea:
            continue
        if cid in citati_da_altri:
            continue   # gia' assegnato su una card viva: vive in `in_carico`
        if cid in fermi_da_altri:
            f = fermi_da_altri[cid]
            da_osservare.append({"check": cid, "level": lv, "headline": c.get("headline"),
                                 "in_carico_a": f["owner"], "card": f["card"],
                                 "giorni_fermo": f["giorni_fermo"],
                                 "nota": "in carico ad altri su una card ferma o archiviata"})
            continue
        if lv == "red":
            richiedono.append({
                "tipo": "check", "titolo": f"{cid}: {c.get('headline')}",
                "perche": "rosso misurato e nessun task lo prende in carico"
                          + (" (citato da un task senza owner)" if cid in senza_owner else ""),
                "evidenza": [_ev_check(cid, stato)],
                "da_quando": _da_quando_check(cid, stato, inizi), "owner": "Andrea (triage)",
                "azione": f"assegnalo: un task con check:{cid} nella card del progetto",
                "fonte": f"check:{cid} · /api/state",
            })
        else:
            da_osservare.append({"check": cid, "level": lv, "headline": c.get("headline")})

    ordine_fase = {"BLOCCATO": 0, "ATTIVO": 1, "OPERATIVO": 2}
    progetti_.sort(key=lambda p: (p["ferma"], ordine_fase.get(p["fase"] or "", 9),
                                  p["giorni_fermo"] or 0))
    archivio.sort(key=lambda p: p["giorni_fermo"] if p["giorni_fermo"] is not None else 10**6)
    in_coda.sort(key=lambda x: (x["scad"] or "9999", x["eta_giorni"] or 0))
    # I quattro numeri della banda del verdetto, derivati qui e non in pagina:
    # cosi' la pagina non ha una seconda regola di conteggio da tenere allineata.
    daemon = [c for cid, c in nostri_check.items() if cid.startswith("launchd_")]
    numeri = {
        "progetti_attivi": len(progetti_),
        "bloccati": sum(1 for p in progetti_ if p["fase"] == "BLOCCATO"),
        "daemon_vivi": sum(1 for c in daemon if c.get("level") == "green"),
        "daemon_totali": len(daemon),
        "ultima_spunta": max((t["fatto_il"] for p in progetti_ for t in p["tasks"]
                              if t["fatto_il"]), default=None),
    }
    if progetto is not None:
        # Il progetto somma i suoi workstream: la salute e' la peggiore fra la
        # sua e quella dei workstream vivi; l'avanzamento conta anche i task
        # delle card in archivio, perche' un loro task rosso sale comunque in
        # `richiedono_te` e i due numeri devono parlare degli stessi task.
        progetto["salute"]["livello"] = _peggiore(
            [progetto["salute"]["livello"], *(w["salute"]["livello"] for w in progetti_)])
        tutte = [progetto, *progetti_, *archivio]
        progetto["avanzamento"] = {"task_chiusi": sum(w["task_chiusi"] for w in tutte),
                                   "task_totali": sum(w["task_totali"] for w in tutte)}
        progetto["task"] = [t for w in tutte for t in task_per_card.get(w["id"], [])]
        progetto["n_workstream"] = len(progetti_) + len(archivio)
        progetto["n_workstream_attivi"] = len(progetti_)
        progetto["n_workstream_vivi"] = len(progetti_)
        progetto["n_workstream_archivio"] = len(archivio)
    return {
        "area": area, "assente": False, "oggi": oggi.isoformat(),
        "snapshot": stato.get("generated_at"),
        "verdetto": {"livello": livello_verdetto(richiedono), "n_richiedono_te": len(richiedono)},
        "numeri": numeri,
        "progetto": progetto,
        "n_in_coda": len(in_coda),
        "richiedono_te": richiedono,
        "in_coda_per_te": in_coda,
        "workstream": progetti_,
        "progetti": progetti_,   # alias storico di `workstream`: lo legge cockpit.html
        "avvisi": avvisi,
        "in_carico": in_carico,
        "da_osservare": da_osservare,
        "archivio": {"conteggio": len(archivio), "elenco": archivio},
    }


def area_valida(area: str) -> bool:
    return bool(_AREA_OK.match(area or ""))


def _card_dal_disco() -> list[tuple[dict, str]]:
    card = []
    for chiave, etichetta, f in progetti._percorsi():
        testo = progetti._testo_per_elenco(f)
        if testo is None:
            continue
        card.append((progetti._scheda(f, chiave, etichetta, testo), testo))
    return card


_CACHE_INIZI: dict = {}


def inizi_rosso(check_ids, percorso: Path | None = None) -> dict[str, str]:
    """{check: `at` del primo rosso della serie rossa corrente} da
    `history.jsonl`, letto dal fondo: si ferma al primo giro non rosso di ogni
    check. Una riga senza quel check (check nato dopo, giro parziale) non
    spezza la serie. Se lo storico manca o non si legge: {} e vale la stima."""
    from .snapshot import HISTORY_FILE
    f = Path(percorso) if percorso else HISTORY_FILE
    aperti = set(check_ids)
    if not aperti:
        return {}
    try:
        st = f.stat()
        chiave = (str(f), st.st_size, st.st_mtime_ns, frozenset(aperti))
        if chiave in _CACHE_INIZI:
            return dict(_CACHE_INIZI[chiave])
        righe = f.read_bytes().splitlines()
    except OSError:
        return {}
    inizi: dict[str, str] = {}
    for riga in reversed(righe):
        if not aperti:
            break
        try:
            r = json.loads(riga)
        except ValueError:
            continue
        for cid in list(aperti):
            c = (r.get("checks") or {}).get(cid)
            if c is None:
                continue
            if c.get("level") == "red" and r.get("at"):
                inizi[cid] = r["at"]
            else:
                aperti.discard(cid)
    _CACHE_INIZI.clear()   # una voce sola: lo storico cambia ogni 5 minuti
    _CACHE_INIZI[chiave] = dict(inizi)
    return inizi


def _rossi(stato: dict) -> list[str]:
    return [cid for cid, c in (stato.get("checks") or {}).items() if c.get("level") == "red"]


def cockpit(area: str, stato: dict, oggi: date | None = None) -> dict:
    """Dal disco: le card dei tre registri e lo snapshot passato dal server.

    Un'area che nessuna card dichiara (e che non e' quella dei check) non e'
    un cockpit vuoto: risponde `{"assente": true, ...}` e il server la serve
    come 404, cosi' la pagina distingue «area sbagliata» da «niente da fare»."""
    card = _card_dal_disco()
    note = aree(card)
    if area not in note and area != AREA_DEI_CHECK:
        return {"area": area, "assente": True, "aree": note,
                "messaggio": f"nessuna card dichiara **Area:** {area}"}
    return costruisci(area, stato, card, oggi, inizi_rosso(_rossi(stato)))


def aree(card: list[tuple[dict, str]]) -> list[str]:
    """Le aree dichiarate dalle card (`**Area:**`), non una lista scritta qui.
    Un valore che non e' uno slug valido non diventa un'area."""
    trovate: set[str] = set()
    for _scheda, testo in card:
        trovate |= _aree(progetti._campi(progetti._blocco_stato(testo)).get("area"))
    return sorted(a for a in trovate if area_valida(a))


def costruisci_hub(stato: dict, card: list[tuple[dict, str]],
                   oggi: date | None = None, inizi: dict | None = None,
                   adesso: datetime | None = None) -> dict:
    """Funzione pura: i progetti di primo livello e il verdetto di tutte le aree.

    Il verdetto aggrega ogni area, anche quelle che non hanno ancora una card
    progetto: un rosso di un workstream orfano chiede Andrea lo stesso. Un
    ticket di una card con due aree compare in entrambe: si conta una volta.
    """
    visti: dict[tuple, dict] = {}
    coda: dict[tuple, dict] = {}
    elenco = []
    for area in aree(card):
        c = costruisci(area, stato, card, oggi, inizi, adesso)
        for t in c["richiedono_te"]:
            visti.setdefault((t.get("fonte"), t.get("titolo")), t)
        for t in c["in_coda_per_te"]:
            coda.setdefault((t.get("fonte"), t.get("titolo")), t)
        p = c["progetto"]
        if p is None:
            continue
        g = p["goal"]
        elenco.append({
            "id": p["id"], "area": area, "nome": p["nome"], "fase": p["fase"],
            "goal_sintesi": p["done_quando"] or (g[0]["testo"] if g else None),
            "goal": g,
            "salute": p["salute"]["livello"],
            # I check collegati ai goal e ai task del progetto, uno per LED sulla
            # scheda dell'hub: LED misurati, non una fila di verdi decorativa.
            "salute_checks": [{"check": s["check"], "level": s["level"]}
                              for s in p["salute"]["checks"]],
            "verdetto": c["verdetto"],
            "n_richiedono_te": c["verdetto"]["n_richiedono_te"],
            "avanzamento": p["avanzamento"],
            "n_workstream": p["n_workstream"],
            "n_workstream_vivi": p["n_workstream_vivi"],
            "n_workstream_archivio": p["n_workstream_archivio"],
            "n_in_coda": c["n_in_coda"],
            "ultimo_tocco": max([d for d in [p["ultimo_tocco"],
                                             *(w["ultimo_tocco"] for w in c["workstream"])] if d],
                                default=None),
        })
    richiedono = list(visti.values())
    elenco.sort(key=lambda p: (-p["n_richiedono_te"], p["nome"].lower()))
    return {
        "oggi": (oggi or date.today()).isoformat(), "snapshot": stato.get("generated_at"),
        "verdetto": {"livello": livello_verdetto(richiedono), "n_richiedono_te": len(richiedono)},
        "progetti": elenco,
        "in_coda_per_te": list(coda.values()),
        "n_in_coda": len(coda),
        "aree": aree(card),
        "slot_liberi": True,
    }


def hub(stato: dict, oggi: date | None = None) -> dict:
    """Le card si leggono una volta sola per tutte le aree."""
    return costruisci_hub(stato, _card_dal_disco(), oggi, inizi_rosso(_rossi(stato)))


# --------------------------------------------------------------------------
# l'unica scrittura

def _percorso(ident: str) -> Path | None:
    """Il file di una card, **solo** se l'id compare nell'indice."""
    for chiave, _etichetta, f in progetti._percorsi():
        if f"{chiave}/{f.stem}" == ident:
            return f
    return None


def segna_fatto(ident: str, indice: int, testo_atteso: str,
                oggi: date | None = None) -> dict:
    """Spunta un task: `- [ ]` -> `- [x]` e ` · fatto:AAAA-MM-GG` in coda.

    Tocca solo quella riga. Pretende il testo del task: se la card e' cambiata
    sotto la pagina (un altro agente ha riordinato la lista), l'indice punta a
    un altro task e la scrittura si rifiuta invece di spuntare quello sbagliato.
    Scrive su temporaneo e rinomina, dopo aver lasciato il `.bak`.
    """
    f = _percorso(ident)
    if f is None:
        return {"ok": False, "errore": "card non nell'indice"}
    f = f.resolve()   # se un giorno la card e' un symlink, si riscrive il file, non il link
    try:
        prima = f.read_text(encoding="utf-8")
    except OSError as e:
        return {"ok": False, "errore": f"lettura: {e}"}
    trovato = None
    for i, (n, riga, m) in enumerate(_righe_task(prima)):
        if i == indice:
            trovato = (n, riga, m)
            break
    if trovato is None:
        return {"ok": False, "errore": f"nessun task con indice {indice}"}
    n, riga, m = trovato
    t = _parse_task(m.group(2))
    # Il titolo del ticket puo' essere quello senza numeri fissi: e' derivato
    # dalla stessa riga, quindi riconosce lo stesso task.
    if testo_atteso not in (t["testo"], senza_numeri_fissi(t["testo"])):
        return {"ok": False, "errore": "il task a quell'indice non e' quello atteso: ricarica"}
    if m.group(1).lower() == "x":
        return {"ok": False, "errore": "gia' fatto"}

    giorno = (oggi or date.today()).isoformat()
    # Il primo "[ ]" della riga grezza e' la casella: prima c'e' solo il
    # prefisso `>` della citazione e il trattino, il testo viene dopo.
    a = riga.find("[ ]")
    nuova = riga[:a] + "[x]" + riga[a + 3:].rstrip() + f" · fatto:{giorno}"
    righe = prima.splitlines(keepends=True)
    fine = righe[n][len(righe[n].rstrip("\r\n")):]
    righe[n] = nuova + fine
    dopo = "".join(righe)

    try:
        if f.read_text(encoding="utf-8") != prima:
            return {"ok": False, "errore": "la card e' cambiata durante la scrittura: riprova"}
        shutil.copy2(f, f.with_name(f.name + ".bak"))
        fd, tmp = tempfile.mkstemp(dir=str(f.parent), prefix=".task-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(dopo)
                fh.flush()
                os.fsync(fh.fileno())
            shutil.copymode(f, tmp)
            os.replace(tmp, f)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
    except OSError as e:
        return {"ok": False, "errore": f"scrittura: {e}"}
    return {"ok": True, "id": ident, "indice": indice, "riga": n + 1, "fatto": giorno}
