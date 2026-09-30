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
_CAMPO = re.compile(r"^\*\*[^*]+\*\*")
_ATTRIBUTO = re.compile(r"^(scad|check|fatto):\s*(\S.*)$", re.I)
_DATA = re.compile(r"\d{4}-\d{2}-\d{2}")
_AREA_OK = re.compile(r"^[a-z0-9][a-z0-9_-]{0,40}$")
# "— *owner: Andrea*", "attende Andrea", "in attesa di Andrea"
_ATTENDE_ANDREA = re.compile(
    r"owner\W{0,4}andrea|(?:attesa|attende|aspetta)\W+(?:di\W+|la\W+)?(?:risposta\W+di\W+)?andrea",
    re.I)
_QUOTE = re.compile(r"^\s*>\s?")


# --------------------------------------------------------------------------
# parser

def _riga_pulita(riga: str) -> str:
    return _QUOTE.sub("", riga)


def _parse_task(corpo: str) -> dict:
    """`testo · owner · scad:AAAA-MM-GG · check:id[,id] · fatto:AAAA-MM-GG`.

    Il primo pezzo e' il testo; un pezzo `chiave:valore` noto e' un attributo;
    il primo pezzo senza chiave e' l'owner. Pezzi in piu' tornano nel testo,
    cosi' un `·` scritto nella frase non si perde.
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
        elif owner is None and p:
            owner = p
        else:
            resto.append(p)
    if resto:
        testo = " · ".join([testo, *resto])
    return {"testo": testo, "owner": owner, "scad": scad,
            "fatto_il": fatto_il, "checks": checks}


def _righe_task(testo: str):
    """(numero di riga nel file, riga senza `>`, match) per ogni task del
    blocco STATO. Un generatore solo, usato sia per leggere sia per scrivere:
    se le due strade contassero diversamente, `indice` punterebbe a un altro
    task."""
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
        if _INTESTA_TASK.match(pulita):
            dentro_task = True
            continue
        if not dentro_task:
            continue
        if _CAMPO.match(pulita):   # il campo successivo chiude la lista
            dentro_task = False
            continue
        m = _TASK.match(_riga_pulita(riga))
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


# --------------------------------------------------------------------------
# derivazione

def _e_andrea(owner: str | None) -> bool:
    return bool(owner) and "andrea" in owner.lower()


def stato_task(t: dict, checks: dict) -> str:
    """aperto · fatto · verificato dal check · riaperto dal check."""
    livelli = [(checks.get(c) or {}).get("level") for c in t["checks"]]
    if t["checks"] and all(lv == "green" for lv in livelli):
        return "fatto" if t["spuntato"] else "verificato dal check"
    if t["spuntato"]:
        return "riaperto dal check" if "red" in livelli else "fatto"
    return "aperto"


def _chiuso(stato: str) -> bool:
    return stato in ("fatto", "verificato dal check")


def _da_quando_check(check_id: str, stato: dict) -> str | None:
    """Inizio della serie rossa corrente, dai run consecutivi dell'isteresi."""
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


def costruisci(area: str, stato: dict, card: list[tuple[dict, str]],
               oggi: date | None = None) -> dict:
    """Funzione pura: `card` e' [(scheda di progetti._scheda, testo)]."""
    oggi = oggi or date.today()
    checks = stato.get("checks") or {}
    nostri_check = checks if area == AREA_DEI_CHECK else {}

    richiedono, progetti_, archivio, in_carico = [], [], [], []
    citati_da_andrea: set[str] = set()   # check coperti da un task di Andrea
    citati_da_altri: set[str] = set()    # check presi in carico da altri

    for scheda, testo in card:
        if area not in _aree(progetti._campi(progetti._blocco_stato(testo)).get("area")):
            continue
        campi = progetti._campi(progetti._blocco_stato(testo))
        lista = tasks(testo)
        for t in lista:
            t["stato"] = stato_task(t, nostri_check)
        tocco = _ultimo_tocco(scheda, lista)
        eta = _giorni(tocco, oggi)
        stale = eta is None or eta > STALE_GIORNI
        fonte = f"card:{scheda['id']}"

        for t in lista:
            if _chiuso(t["stato"]):
                continue
            non_verdi = [c for c in t["checks"]
                         if (nostri_check.get(c) or {}).get("level") != "green"]
            if not _e_andrea(t["owner"]):
                citati_da_altri.update(non_verdi)
                if non_verdi:
                    in_carico.append({"titolo": t["testo"], "owner": t["owner"],
                                      "checks": non_verdi, "fonte": fonte})
                continue
            citati_da_andrea.update(t["checks"])
            scaduto = bool(t["scad"]) and t["scad"] < oggi.isoformat()
            if not (non_verdi or scaduto):
                continue
            if not non_verdi and stale:
                continue   # un task scaduto su una card ferma e' archivio, non urgenza
            perche = []
            if t["stato"] == "riaperto dal check":
                perche.append("spuntato ma il check e' ancora rosso: riaperto")
            for c in non_verdi:
                perche.append(f"{c} {(nostri_check.get(c) or {}).get('level', 'sconosciuto')}: "
                              f"{(nostri_check.get(c) or {}).get('headline', 'check assente dallo snapshot')}")
            if scaduto:
                perche.append(f"scaduto il {t['scad']}")
            inizi = [d for d in (_da_quando_check(c, stato) for c in non_verdi) if d]
            richiedono.append({
                "tipo": "task", "titolo": t["testo"], "perche": " · ".join(perche),
                "evidenza": [_ev_check(c, stato) for c in non_verdi],
                "da_quando": min(inizi) if inizi else (t["scad"] if scaduto else None),
                "owner": t["owner"],
                "azione": t["testo"] + (" — si chiude da solo quando il check torna verde"
                                        if t["checks"] else ""),
                "fonte": f"{fonte} riga {t['riga']}", "progetto": scheda["id"],
                "indice": t["indice"],
            })

        if (scheda.get("fase") == "BLOCCATO" and not stale
                and _ATTENDE_ANDREA.search(campi.get("prossima azione") or "")):
            richiedono.append({
                "tipo": "bloccato", "titolo": scheda["titolo"],
                "perche": "progetto BLOCCATO in attesa di Andrea",
                "evidenza": [{"prossima_azione": campi.get("prossima azione"),
                              "pending": campi.get("pending")}],
                "da_quando": scheda.get("stato_data"), "owner": "Andrea",
                "azione": campi.get("prossima azione"), "fonte": fonte,
                "progetto": scheda["id"],
            })

        collegati = sorted({c for t in lista for c in t["checks"]})
        sal = [_ev_check(c, stato) for c in collegati]
        peggiore = min((c["level"] for c in sal),
                       key=lambda lv: {"red": 0, "amber": 1, "unknown": 2, "sconosciuto": 2,
                                       "green": 3}.get(lv, 4), default=None)
        aperti = [t for t in lista if not _chiuso(t["stato"])]
        aperti.sort(key=lambda t: (t["scad"] or "9999", t["indice"]))
        verifica = _DATA.findall(campi.get("verifica") or "")
        voce = {
            "id": scheda["id"], "titolo": scheda["titolo"], "fase": scheda.get("fase"),
            "goal": campi.get("goal") or campi.get("done quando"),
            "task_chiusi": len(lista) - len(aperti), "task_totali": len(lista),
            "prossimo_task": aperti[0]["testo"] if aperti else None,
            "prossima_azione": campi.get("prossima azione"),
            "salute": {"livello": peggiore, "checks": sal},
            "ultimo_tocco": tocco, "giorni_fermo": eta,
            "ultima_verifica": max(verifica) if verifica else scheda.get("stato_data"),
            "tasks": lista,
        }
        if stale or scheda.get("fase") == "ARCHIVIATO":
            archivio.append({"id": voce["id"], "titolo": voce["titolo"], "fase": voce["fase"],
                             "ultimo_tocco": tocco, "giorni_fermo": eta,
                             "motivo": "archiviato" if scheda.get("fase") == "ARCHIVIATO"
                             else f"fermo da {eta} giorni (> {STALE_GIORNI})"})
        else:
            progetti_.append(voce)

    da_osservare = []
    for cid, c in nostri_check.items():
        lv = c.get("level")
        if lv not in ("red", "amber", "unknown") or cid in citati_da_andrea:
            continue
        if cid in citati_da_altri:
            continue   # gia' assegnato: vive in `in_carico` e nella salute del progetto
        if lv == "red":
            richiedono.append({
                "tipo": "check", "titolo": f"{cid}: {c.get('headline')}",
                "perche": "rosso misurato e nessun task lo prende in carico",
                "evidenza": [_ev_check(cid, stato)],
                "da_quando": _da_quando_check(cid, stato), "owner": "Andrea (triage)",
                "azione": f"assegnalo: un task con check:{cid} nella card del progetto",
                "fonte": f"check:{cid} · /api/state",
            })
        else:
            da_osservare.append({"check": cid, "level": lv, "headline": c.get("headline")})

    ordine_fase = {"BLOCCATO": 0, "ATTIVO": 1, "OPERATIVO": 2}
    progetti_.sort(key=lambda p: (ordine_fase.get(p["fase"] or "", 9), p["giorni_fermo"] or 0))
    archivio.sort(key=lambda p: p["giorni_fermo"] if p["giorni_fermo"] is not None else 10**6)
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
    return {
        "area": area, "oggi": oggi.isoformat(),
        "snapshot": stato.get("generated_at"),
        "numeri": numeri,
        "richiedono_te": richiedono,
        "progetti": progetti_,
        "in_carico": in_carico,
        "da_osservare": da_osservare,
        "archivio": {"conteggio": len(archivio), "elenco": archivio},
    }


def area_valida(area: str) -> bool:
    return bool(_AREA_OK.match(area or ""))


def cockpit(area: str, stato: dict, oggi: date | None = None) -> dict:
    """Dal disco: le card dei tre registri e lo snapshot passato dal server."""
    card = []
    for chiave, etichetta, f in progetti._percorsi():
        testo = progetti._testo_per_elenco(f)
        if testo is None:
            continue
        card.append((progetti._scheda(f, chiave, etichetta, testo), testo))
    return costruisci(area, stato, card, oggi)


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
    if t["testo"] != testo_atteso:
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
