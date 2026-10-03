"""Dal problema alla mano giusta: riavviare, o parlare con l'agente corretto.

Ogni riga di «Da fare» e di «Salute» porta con se' il suo rimedio:

* **Riavvia**: solo se il problema e' un daemon di perimetro (la stessa
  whitelist di `actions.RESTARTABLE`, nessun elenco parallelo).
* **Parla con l'agente**: apre un terminale con l'agente adatto, gia' fornito
  di un prompt che dice cosa e' rotto, con quale evidenza, come si verifica che
  sia sistemato e quali regole valgono (worktree, gate PROPOSAL/APPROVE).

Due scelte che non si leggono dal codice:

1. **La pagina manda solo un `rid`.** Il prompt lo costruisce il server dai
   suoi stessi dati (`cockpit.cockpit`), mai da testo arrivato dal browser: dal
   browser non puo' entrare niente di eseguibile ne' di iniettabile nel prompt.
2. **Il prompt va in un file, non nella riga di comando.** Il terminale riceve
   un percorso che genera il server, senza apici ne' caratteri da escapare.

Il gate non si aggira: l'agente parte *dentro* una sessione con una persona
presente e il prompt gli impone PROPOSAL + APPROVE per tutto cio' che e'
prod/DB/credenziali/soldi/deploy. Non e' un pulsante che scrive in produzione.
"""

from __future__ import annotations

import hashlib
import re
import time
from pathlib import Path

from . import actions, certificazione, sala
from .snapshot import STATE_DIR

PROMPTS_DIR = STATE_DIR / "prompts"
AGENTE_DEFAULT = "programmatore-andrea"

# (regex su id del check + testo del problema, agente). Il primo che combacia.
# Un agente nuovo si aggiunge qui e in sala.AGENTI_AZIENDALI.
ROUTING = (
    (r"instagram|tiktok|\bx_|social|telegram|giornata", "social-media-manager"),
    (r"reddit", "reddit-betredge"),
    (r"claim|infortuni|legal|gambling|privacy|gdpr|consenso|terms", "legale-compliance"),
    (r"model|calibr|predict|\bedge\b|clv|brier|settle|void|history|pick|quote|odds|parita", "ml-engineer-agentic"),
    (r"email|crm|resend|funnel|seo|aeo|conversion|abbonat|roi|ricav|affiliat|referral|paygate", "marketing-betredge"),
    (r"\bui\b|css|visual|banner|responsive|card hud|restyl", "ui-andrea"),
)

NOMI = {
    "programmatore-andrea": "Programmatore", "qa-andrea": "QA", "ui-andrea": "UI",
    "art-director": "Art director", "marketing-betredge": "Marketing",
    "ml-engineer-agentic": "ML", "social-media-manager": "Social",
    "reddit-betredge": "Reddit", "legale-compliance": "Compliance",
}

PERSONE = ("Andrea", "Michele", "Tommy", "Claude", "Collaboratrice")


def agente_per(testo: str) -> str:
    t = (testo or "").lower()
    for rx, agente in ROUTING:
        if re.search(rx, t):
            return agente
    return AGENTE_DEFAULT


def owner_normalizzato(owner: str | None) -> str:
    o = (owner or "").lower()
    for p in PERSONE:
        if p.lower() in o or (p == "Collaboratrice" and "collab" in o):
            return p
    return "Andrea"


def _rid(*parti) -> str:
    return "t" + hashlib.sha1("|".join(str(p) for p in parti).encode()).hexdigest()[:10]


def _rimedio(agente: str, riavviabile: str | None) -> dict:
    return {"agente": agente, "agente_nome": NOMI.get(agente, agente),
            "riavvia": riavviabile}


def arricchisci(corpo: dict, stato: dict | None = None) -> dict:
    """Aggiunge a ogni riga `rid`, `owner_n`, `priorita`, `rimedio`, e al
    progetto il `sigillo`. Funzione pura: non tocca il disco."""
    if corpo.get("assente"):
        return corpo
    checks = (stato or {}).get("checks") or {}
    for x in corpo.get("richiedono_te", []):
        x["rid"] = _rid("r", x.get("fonte"), x.get("titolo"))
        x["owner_n"] = owner_normalizzato(x.get("owner"))
        x["priorita"] = "P0"
        cid = (x.get("evidenza") or [{}])[0].get("check") if x.get("tipo") == "check" else None
        x["rimedio"] = _rimedio(agente_per(f"{cid or ''} {x.get('titolo')}"),
                                actions.RESTARTABLE.get(cid) and cid)
    for x in corpo.get("in_coda_per_te", []):
        x["rid"] = _rid("c", x.get("fonte"), x.get("titolo"))
        x["owner_n"] = "Andrea"
        x["priorita"] = "P1"
        x["rimedio"] = _rimedio(agente_per(f"{x.get('nome_card')} {x.get('titolo')}"), None)
    for x in corpo.get("in_carico", []):
        x["rid"] = _rid("i", x.get("fonte"), x.get("titolo"))
        x["owner_n"] = owner_normalizzato(x.get("owner"))
        x["priorita"] = "P0" if (x.get("giorni_fermo") or 0) > 14 else "P1"
        cid = (x.get("checks") or [None])[0]
        x["rimedio"] = _rimedio(agente_per(f"{cid or ''} {x.get('nome_card')} {x.get('titolo')}"),
                                cid if cid in actions.RESTARTABLE else None)
    for x in corpo.get("da_osservare", []):
        cid = x.get("check", "")
        x["rid"] = "check:" + cid
        x["priorita"] = {"red": "P0", "amber": "P1"}.get(x.get("level"), "P2")
        x["rimedio"] = _rimedio(agente_per(f"{cid} {x.get('headline')}"),
                                cid if cid in actions.RESTARTABLE else None)
    # I check collegati ai goal e ai task (pannello Salute): stesso rimedio, stesso `rid`.
    for c in ((corpo.get("progetto") or {}).get("salute") or {}).get("checks", []):
        cid = c.get("check", "")
        c["rid"] = "check:" + cid
        c["headline"] = c.get("headline")
        c["rimedio"] = _rimedio(agente_per(f"{cid} {c.get('headline')}"),
                                cid if cid in actions.RESTARTABLE else None)
    corpo["sigillo"] = sigillo(corpo, checks)
    return corpo


def sigillo(corpo: dict, checks: dict) -> dict:
    """Il sigillo di certificazione: quattro criteri, certificato solo con 4/4.

    Un criterio senza dati e' *non misurato* e non conta come verde.
    """
    p = corpo.get("progetto") or {}
    dq = (p.get("done_quando") or "").strip().lower()
    scritto = bool(dq) and not dq.startswith("da decidere")

    # Un solo voto: lo stesso calcolo di `lab certifica prodotto` (certificazione.py),
    # che espande il registro dei claim in una voce per claim.
    righe = [{"id": cid, "nome": c.get("label"), "group": c.get("group"), "level": c.get("level"),
              "value": c.get("value"), "headline": c.get("headline"), "evidence": c.get("evidence")}
             for cid, c in checks.items()]
    voci, _info = certificazione.voci_da_dizionari(righe)
    voto = None
    if voci:
        k = certificazione.conteggi(voci)
        voto = k["voto"]
        controlli = {"ok": k["ko"] == 0 and k["non_misurati"] == 0,
                     "dettaglio": f"voto {voto}/100 · {k['ko']} da sistemare · {k['non_misurati']} non misurati su {k['totale']}"}
    else:
        controlli = {"ok": False, "dettaglio": "non misurato"}

    perc = [c for cid, c in checks.items() if cid.startswith("percorso_")]
    if perc:
        verdi_p = sum(1 for c in perc if c.get("level") == "green")
        percorsi = {"ok": verdi_p == len(perc),
                    "dettaglio": f"{verdi_p}/{len(perc)} verdi: board, scheda, piani, signup, track record, mobile"
                                 if verdi_p == len(perc) else
                                 f"{verdi_p}/{len(perc)} verdi · {len(perc) - verdi_p} da sistemare o non misurati"}
    else:
        percorsi = {"ok": False, "dettaglio": "non misurato"}

    senza_scad = sum(1 for x in corpo.get("in_coda_per_te", []) if not x.get("scad"))
    senza_owner = sum(1 for x in corpo.get("in_carico", []) if not x.get("owner"))
    pend = senza_scad + senza_owner

    fresca = not corpo.get("stale") and (corpo.get("eta_min") or 0) < 7 * 24 * 60
    criteri = [
        {"id": "done_quando", "titolo": "Done quando scritto", "ok": scritto,
         "dettaglio": "scritto" if scritto else "oggi: «da decidere»"},
        {"id": "controlli", "titolo": "Controlli del prodotto tutti verdi", **controlli},
        {"id": "percorsi", "titolo": "Percorsi dell'utente funzionano", **percorsi},
        {"id": "pending", "titolo": "Pending con owner e scadenza", "ok": pend == 0,
         "dettaglio": "tutti assegnati" if pend == 0 else f"{pend} senza scadenza o owner"},
        {"id": "fresca", "titolo": "Misurato da meno di 7 giorni", "ok": bool(fresca),
         "dettaglio": f"ultima misura {corpo.get('eta_min', '?')} min fa"},
    ]
    return {"certificato": all(c["ok"] for c in criteri), "voto": voto,
            "criteri": criteri, "ok": sum(c["ok"] for c in criteri), "totale": len(criteri)}


def trova(corpo: dict, rid: str) -> tuple[str, dict] | None:
    for lista in ("richiedono_te", "in_coda_per_te", "in_carico", "da_osservare"):
        for x in corpo.get(lista, []):
            if x.get("rid") == rid:
                return lista, x
    for x in ((corpo.get("progetto") or {}).get("salute") or {}).get("checks", []):
        if x.get("rid") == rid:
            return "salute", x
    return None


def prompt_per(corpo: dict, lista: str, x: dict) -> str:
    """Il prompt con cui parte l'agente. Solo dati del server."""
    prog = (corpo.get("progetto") or {}).get("nome") or corpo.get("area", "")
    rim = x.get("rimedio") or {}
    titolo = x.get("titolo") or f"{x.get('check')}: {x.get('headline')}"
    cid = x.get("check") or ((x.get("evidenza") or [{}])[0].get("check"))
    righe = [f"# Intervento dalla torre di controllo — {prog}", "",
             f"Sei {rim.get('agente', AGENTE_DEFAULT)}. Una persona ti ha aperto dalla torre "
             "per sistemare UN problema preciso. Parti da qui, non da altro.", "",
             "## Il problema", titolo.strip()]
    for k, et in (("perche", "Perche' e' qui"), ("headline", "Misura"), ("testo", "Dettaglio"),
                  ("fonte", "Fonte"), ("card", "Card"), ("da", "Da quando"),
                  ("giorni_fermo", "Giorni fermo"), ("owner", "Owner")):
        v = x.get(k)
        if v:
            righe.append(f"- {et}: {v}")
    for ev in x.get("evidenza") or []:
        righe.append(f"- Evidenza: {ev.get('check')} = {ev.get('level')} · {ev.get('headline') or ''}")
    righe += ["", "## Cosa devi ottenere"]
    if cid:
        righe.append(f"Il controllo `{cid}` torna verde. Si rimisura ogni 5 minuti: "
                     f"`curl -s localhost:8790/api/state` e guarda `checks.{cid}.level`.")
    else:
        righe.append("Il task e' chiuso con una prova che si puo' rieseguire, e la card lo registra.")
    righe += ["", "## Come lavorare",
              "1. Prima capisci: leggi la card e i dati citati, riproduci o misura il problema. Non indovinare.",
              "2. Non toccare `~/Desktop/agentic-markets` (vetrina, detached su origin/main): "
              "lavora in un worktree dedicato, un commit con i file per nome, mai `git add -A`.",
              "3. Se il rimedio tocca prod, DB, credenziali, soldi, deploy o e' irreversibile: NON eseguirlo. "
              "Scrivi una PROPOSAL con change-spec esatta (cosa cambia, rollback, blast radius, verifica) "
              "e aspetta `APPROVE` di Andrea o Michele. Il resto e' low-risk: procedi.",
              "4. Costruito non e' verificato non e' operativo: dichiara risolto solo dopo averlo misurato.",
              "5. A fine lavoro aggiorna il blocco STATO della card e dimmi in 3 righe cosa e' cambiato "
              "davvero e come l'hai verificato.", "", "Parti dal punto 1."]
    return "\n".join(righe) + "\n"


def apri(area: str, rid: str, stato: dict, cockpit_fn) -> dict:
    """Apre un terminale con l'agente giusto e il prompt pronto."""
    corpo = arricchisci(cockpit_fn(area, stato), stato)
    if corpo.get("assente"):
        return {"ok": False, "errore": "area sconosciuta"}
    trovato = trova(corpo, rid)
    if trovato is None:
        return {"ok": False, "errore": "riga non trovata (e' cambiata nel frattempo?)"}
    lista, x = trovato
    agente = x["rimedio"]["agente"]
    if agente not in sala.AGENTI_AZIENDALI:
        return {"ok": False, "errore": f"{agente} non e' un agente aziendale"}
    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
    nome = f"{int(time.time())}-{re.sub(r'[^a-z0-9]+', '-', rid.lower())[:30]}"
    f = PROMPTS_DIR / f"{nome}.md"
    f.write_text(prompt_per(corpo, lista, x), encoding="utf-8")
    cmd = (f"cd '{Path.home()}/Desktop/agentic-markets' && "
           f"claude -n torre-{nome[-12:]} --agent {agente} \"$(cat '{f}')\"")
    esito = actions._esegui(
        ["osascript", "-e", f'tell application "Terminal" to do script "{cmd.replace(chr(34), chr(92) + chr(34))}"',
         "-e", 'tell application "Terminal" to activate'],
        f"apre {agente} con il prompt {f.name}")
    esito["prompt"] = str(f)
    esito["agente"] = agente
    return esito
