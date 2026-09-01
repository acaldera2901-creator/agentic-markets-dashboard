"""Il Council visto dalla sala controllo: cosa aspetta una risposta, e l'APPROVE.

Due cose che vanno dette, perche' cambiano come si legge tutto il resto.

**Il Council non ha un'identita' umana.** Su 999 messaggi, zero hanno
`authorType: human`: scrivono solo agenti. I 79 APPROVE gia' presenti nel
deploy-gate sono agenti che *riferiscono* una decisione di Andrea. Quindi un
APPROVE mandato da qui sara' firmato `Claude Calde — Aziendale` come tutti gli
altri: la garanzia non e' la firma, e' che questo server ascolta **solo su
loopback e dietro un token**, cioe' puo' premerlo solo chi e' al Mac di Andrea.
Il messaggio lo dice esplicitamente, cosi' chi legge sa da dove arriva.

**Non esiste un campo 'risolto'.** Una richiesta la consideriamo aperta se
chiede risposta, ci nomina, e dopo non abbiamo piu' scritto noi in quel canale.
E' una stima: senza l'ultimo pezzo il conto sale da 25 a 210, cioe' diventa
rumore — e il rumore e' esattamente cio' che si smette di guardare.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://agentic-council.vercel.app/api/agent"
ENV = Path.home() / "Desktop/Maven-Brain/.env.council-chat"
NOI = "claude-calde-aziendale"
CI_NOMINA = ("claude-calde-aziendale", "calde-aziendale", "@claude", "@andrea")

# ch_deploy_gate e' human-only: ci si puo' scrivere un APPROVE (lo preme Andrea)
# ma nessun automatismo deve poterci agire da solo.
GATE = "ch_deploy_gate"

# Il Council non ha un campo «risolto», e postare una chiusura nel canale
# marcherebbe risolte TUTTE le richieste di quel canale insieme — l'euristica
# ragiona per canale, non per messaggio. Quindi l'archivio e' NOSTRO e locale:
# non tocca il Council, non parla per Andrea, e ogni voce porta il perche'.
ARCHIVIO = Path.home() / ".betredge-cc/council-archiviate.json"

_SLUG = re.compile(r"^ch_(.+)$")
_MSGID = re.compile(r"^msg_[A-Za-z0-9_]{4,64}$")


class CouncilNonRaggiungibile(RuntimeError):
    pass


def chiave() -> str:
    if not ENV.exists():
        raise CouncilNonRaggiungibile(f"manca {ENV}")
    for riga in ENV.read_text(encoding="utf-8").splitlines():
        m = re.match(r'\s*CALDE_AZIENDALE_AGENT_KEY\s*=\s*["\']?([^"\'\s]+)', riga)
        if m:
            return m.group(1)
    raise CouncilNonRaggiungibile("CALDE_AZIENDALE_AGENT_KEY non valorizzata")


def _slug(channel_id: str) -> str:
    """Il POST instrada per channelSlug: passando channelId il messaggio finisce
    in council-main **in silenzio**. E' una trappola gia' pagata una volta."""
    m = _SLUG.match(channel_id or "")
    return m.group(1).replace("_", "-") if m else "council-main"


def _get(path: str, timeout: int = 15):
    req = urllib.request.Request(f"{BASE}{path}", headers={"x-agent-key": chiave()})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.URLError as exc:
        raise CouncilNonRaggiungibile(str(exc)) from exc


def _post(path: str, corpo: dict, timeout: int = 20):
    dati = json.dumps(corpo).encode()
    req = urllib.request.Request(
        f"{BASE}{path}", data=dati, method="POST",
        headers={"x-agent-key": chiave(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.URLError as exc:
        raise CouncilNonRaggiungibile(str(exc)) from exc


def messaggi() -> list[dict]:
    return _get("/inbox").get("messages", [])


def archiviate() -> dict:
    """id → {motivo, quando, prova}. Vuoto se il file non c'e'."""
    if not ARCHIVIO.exists():
        return {}
    try:
        return json.loads(ARCHIVIO.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return {}


def archivia(msg_id: str, motivo: str, prova: str = "") -> dict:
    if not _MSGID.match(msg_id or ""):
        return {"ok": False, "errore": "id messaggio non valido"}
    if not motivo.strip():
        return {"ok": False, "errore": "senza un motivo non si archivia niente"}
    import datetime
    d = archiviate()
    d[msg_id] = {"motivo": motivo.strip()[:300], "prova": prova.strip()[:300],
                 "quando": datetime.datetime.now().isoformat(timespec="seconds")}
    ARCHIVIO.parent.mkdir(parents=True, exist_ok=True)
    ARCHIVIO.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"ok": True, "azione": f"archiviata {msg_id}", "totale": len(d)}


def riapri(msg_id: str) -> dict:
    d = archiviate()
    if msg_id not in d:
        return {"ok": False, "errore": "non era archiviata"}
    del d[msg_id]
    ARCHIVIO.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"ok": True, "azione": f"riaperta {msg_id}"}


def aperte(msgs: list[dict], solo_nostre: bool = True,
           includi_archiviate: bool = False) -> list[dict]:
    arch = archiviate()
    fuori = []
    for i, m in enumerate(msgs):
        if not m.get("requiresResponse"):
            continue
        testo = str(m.get("content", ""))
        if solo_nostre and not any(k in testo.lower() for k in CI_NOMINA):
            continue
        if any(x.get("channelId") == m.get("channelId") and x.get("authorAgentId") == NOI
               for x in msgs[i + 1:]):
            continue
        if not includi_archiviate and m.get("id") in arch:
            continue
        fuori.append({
            "id": m.get("id"),
            "canale": m.get("channelId"),
            "slug": _slug(m.get("channelId")),
            "da": m.get("authorName") or m.get("authorAgentId") or "?",
            "quando": m.get("createdAt"),
            "testo": re.sub(r"\s+", " ", testo)[:400],
            "rischio": m.get("riskLevel"),
            "gate": m.get("channelId") == GATE,
        })
    fuori.sort(key=lambda x: x["quando"] or "", reverse=True)
    return fuori


_cache: dict = {"quando": 0.0, "dati": None}
CACHE_S = 45


def stato(forza: bool = False) -> dict:
    """Con una cache breve: la chiamata al Council costa ~2,7 s misurati, e la
    pagina si aggiorna ogni minuto. Senza cache ogni refresh aspetterebbe.
    45 s e' sotto il minuto del refresh, quindi il dato resta fresco."""
    import time
    if not forza and _cache["dati"] is not None and time.time() - _cache["quando"] < CACHE_S:
        return dict(_cache["dati"], da_cache=True)
    d = _calcola_stato()
    if d.get("raggiungibile"):
        _cache["dati"], _cache["quando"] = d, time.time()
    return d


def _calcola_stato() -> dict:
    """Quello che la pagina disegna. Se il Council non risponde lo dice, invece
    di restituire un oggetto vuoto che sembra 'tutto a posto'."""
    try:
        msgs = messaggi()
    except CouncilNonRaggiungibile as exc:
        return {"raggiungibile": False, "errore": str(exc)[:200]}
    ap = aperte(msgs, solo_nostre=True)
    arch = archiviate()
    return {
        "raggiungibile": True,
        "totale": len(msgs),
        "aperte": len(ap),
        "archiviate": len(arch),
        "nel_gate": len([x for x in ap if x["gate"]]),
        "richieste": ap[:20],
    }


def approva(msg_id: str, nota: str = "") -> dict:
    """Posta un APPROVE riferito a un messaggio preciso.

    Non inventa il canale: lo prende dal messaggio che si sta approvando, cosi'
    la risposta non puo' finire nel posto sbagliato. E dice **da dove arriva**:
    senza quella riga, chi legge non ha modo di distinguerlo da un agente che
    si auto-approva, che e' esattamente cio' che il gate esiste per impedire.
    """
    if not _MSGID.match(msg_id or ""):
        return {"ok": False, "errore": "id messaggio non valido"}
    if len(nota) > 500:
        return {"ok": False, "errore": "nota troppo lunga (max 500)"}
    try:
        msgs = messaggi()
    except CouncilNonRaggiungibile as exc:
        return {"ok": False, "errore": f"Council non raggiungibile: {exc}"}

    orig = next((m for m in msgs if m.get("id") == msg_id), None)
    if orig is None:
        return {"ok": False, "errore": "messaggio non trovato nell'inbox"}

    testa = str(orig.get("content", ""))
    rif = re.search(r"#[A-Za-z0-9][A-Za-z0-9._-]{3,48}", testa)
    etichetta = rif.group(0) if rif else msg_id

    contenuto = (
        f"✅ APPROVE {etichetta}\n\n"
        f"Dato da **Andrea**, premendo il tasto nella Sala Controllo "
        f"(`127.0.0.1:8790`, loopback + token: puo' premerlo solo chi e' al suo Mac).\n"
        f"Riferimento: `{msg_id}` di {orig.get('authorName', '?')}.\n"
    )
    if nota:
        contenuto += f"\nNota di Andrea: {nota}\n"
    contenuto += (
        "\n_Il Council non ha un'identita' umana: questo messaggio risulta firmato "
        "dall'agente come tutti gli altri. La provenienza e' questa riga._"
    )

    try:
        _post("/messages", {
            "channelSlug": _slug(orig.get("channelId")),
            "messageType": "chat",
            "content": contenuto,
            "requiresResponse": False,
            "riskLevel": "low",
        })
    except CouncilNonRaggiungibile as exc:
        return {"ok": False, "errore": str(exc)}
    return {"ok": True, "azione": f"APPROVE {etichetta} postato in "
                                  f"{_slug(orig.get('channelId'))}"}
