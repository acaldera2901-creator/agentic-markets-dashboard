"""Le project card: l'elenco e la scheda singola. Solo lettura.

Questa e' una **vista**, non un registro. La fonte resta il file `.md` nei tre
posti dove le card vivono gia' (#UNIONE-0907: un solo registro, la card e'
l'unica fonte). Qui non si scrive niente, non c'e' nessun database e non
esiste un endpoint che modifichi una card: la pagina mostra il file su disco e
basta.

Due scelte che non si leggono dal codice:

1. **Si legge la fonte, non il cervello.** In `~/Desktop/00-SISTEMA/cervello/`
   c'e' gia' una copia di queste card, ma e' il riversamento del collector:
   fino a 5 minuti vecchia. Una scheda che mostra lo STATO di cinque minuti fa
   mentre Andrea l'ha appena scritta e' esattamente la vista che invecchia e
   comincia a mentire. Costa ~11 ms leggere l'intestazione di tutte le card.
2. **L'id non diventa mai un percorso.** L'indice si costruisce prima, e la
   scheda si serve solo se l'id compare nell'indice: nessuna concatenazione
   `cartella / id`, quindi nessun traversal possibile per costruzione — la
   stessa regola della whitelist dei font nel server.
"""

from __future__ import annotations

import re
from pathlib import Path

from .markdown_min import rendi

# (chiave, etichetta, cartella, prefisso richiesto del nome file)
REGISTRI = (
    ("azienda", "Azienda",
     Path.home() / ".claude" / "projects" / "-Users-calde" / "memory", "project_"),
    ("privato", "Privato",
     Path.home() / ".claude-personal" / "projects" / "-Users-calde" / "memory", "project_"),
    ("sistema", "Sistema",
     Path.home() / "Desktop" / "00-SISTEMA" / "sistema-andrea" / "docs" / "progetti", ""),
)

FASI = ("ATTIVO", "BLOCCATO", "OPERATIVO", "ARCHIVIATO")
# `\b` e non il backtick di chiusura: `project_instagram_betredge` dichiara
# `` `ARCHIVIATO LATO NOSTRO — HANDOFF COMPLETO…` `` e il backtick chiude
# venti parole dopo. Pretenderlo attaccato costava una card senza fase.
_FASE = re.compile(r"`(" + "|".join(FASI) + r")\b")
_DATA = re.compile(r"STATO\s+(\d{4}-\d{2}-\d{2})")
_CAMPO = re.compile(r"\*\*([^*:]+):?\*\*:?\s*(.*)")
_TITOLO_MD = re.compile(r"^#\s+(.*)$", re.M)
_INIZIO = "<!-- STATO:start -->"
_FINE = "<!-- STATO:end -->"
# Quanto basta per il blocco STATO di quasi tutte le card: l'elenco non legge
# le card intere. Quasi: `project_email_warmup_news_subdomain` e' lungo 189 KB
# e chiude il blocco al byte 118.514, quindi chi non ci sta dentro viene
# riletto per intero (vedi `_testo_per_elenco`). Leggere sempre tutto costava
# 2,1 MB a richiesta per far stare una card su 192.
_TESTA = 8192

# Le quattro card di `sistema-andrea/docs/progetti` nate prima dello schema
# STATO (holding, machina, my-hedge-fund, ea-goldenera) dichiarano la fase
# cosi'. `genera_stato.py` le legge gia': se non le leggessimo anche noi, le
# due viste direbbero cose diverse sullo stesso file.
_LEGACY = re.compile(r"\*\*Stato:\*\*\s*(.+)")
_LEGACY_FASE = ((re.compile(r"archivi", re.I), "ARCHIVIATO"),
                (re.compile(r"blocc", re.I), "BLOCCATO"),
                (re.compile(r"operativ", re.I), "OPERATIVO"),
                (re.compile(r"attiv|in corso", re.I), "ATTIVO"))


def _titolo(testo: str, stem: str) -> str:
    if testo.startswith("---"):
        fine = testo.find("\n---", 3)
        if fine > 0:
            for riga in testo[3:fine].splitlines():
                m = re.match(r'^description\s*:\s*"?(.+?)"?\s*$', riga)
                if m and m.group(1):
                    return m.group(1)
    m = _TITOLO_MD.search(testo)
    if m:
        return m.group(1).strip()
    return stem.removeprefix("project_").replace("_", " ").replace("-", " ")


def _blocco_stato(testo: str) -> str:
    a = testo.find(_INIZIO)
    if a < 0:
        return ""
    b = testo.find(_FINE, a)
    return testo[a + len(_INIZIO): b if b > 0 else len(testo)]


def _campi(blocco: str) -> dict:
    """I campi dello schema STATO, per quello che il file dichiara davvero."""
    fuori: dict[str, str] = {}
    for riga in blocco.splitlines():
        riga = re.sub(r"^\s*>\s?", "", riga).strip()
        m = _CAMPO.match(riga)
        if not m:
            continue
        chiave = m.group(1).strip().lower().split("(")[0].strip()
        valore = m.group(2).strip()
        if valore and chiave not in fuori:
            fuori[chiave] = valore
    return fuori


def _fase_legacy(testo: str) -> str | None:
    m = _LEGACY.search(testo)
    if not m:
        return None
    for schema, fase in _LEGACY_FASE:
        if schema.search(m.group(1)):
            return fase
    return None


def _scheda(percorso: Path, registro: str, etichetta: str, testo: str) -> dict:
    blocco = _blocco_stato(testo)
    fase = _FASE.search(blocco)
    data = _DATA.search(blocco)
    campi = _campi(blocco)
    try:
        modificato = percorso.stat().st_mtime
    except OSError:
        modificato = 0.0
    return {
        "id": f"{registro}/{percorso.stem}",
        "titolo": _titolo(testo, percorso.stem),
        "registro": registro,
        "registro_nome": etichetta,
        "file": percorso.name,
        "fase": fase.group(1) if fase else _fase_legacy(testo),
        "stato_data": data.group(1) if data else None,
        "done_quando": campi.get("done quando"),
        "prossima_azione": campi.get("prossima azione"),
        "pending": campi.get("pending"),
        "verifica": campi.get("verifica"),
        "modificato": round(modificato, 3),
        "ha_stato": bool(blocco.strip()),
    }


def _percorsi() -> list[tuple[str, str, Path]]:
    fuori: list[tuple[str, str, Path]] = []
    for chiave, etichetta, cartella, prefisso in REGISTRI:
        if not cartella.is_dir():
            continue
        for f in sorted(cartella.glob("*.md")):
            if prefisso and not f.name.startswith(prefisso):
                continue
            fuori.append((chiave, etichetta, f))
    return fuori


def _testo_per_elenco(f: Path) -> str | None:
    """L'intestazione, o la card intera se il blocco STATO non ci sta dentro.

    Troncare e basta faceva dire all'elenco «senza STATO» e alla scheda dello
    stesso progetto «BLOCCATO»: due viste della stessa card che non
    concordano, che e' esattamente il difetto che il registro unico esiste per
    non avere.
    """
    try:
        testa = f.read_text(encoding="utf-8", errors="replace")[:_TESTA]
        if _INIZIO in testa and _FINE not in testa:
            return f.read_text(encoding="utf-8", errors="replace")
        return testa
    except OSError:
        return None


def elenco() -> dict:
    """Tutte le card dei tre registri, con l'intestazione del blocco STATO."""
    schede = []
    for chiave, etichetta, f in _percorsi():
        testa = _testo_per_elenco(f)
        if testa is None:
            continue
        schede.append(_scheda(f, chiave, etichetta, testa))
    ordine = {f: i for i, f in enumerate(FASI)}
    schede.sort(key=lambda s: (ordine.get(s["fase"] or "", 9), -s["modificato"]))
    conteggi: dict[str, int] = {}
    for s in schede:
        conteggi[s["fase"] or "SENZA STATO"] = conteggi.get(s["fase"] or "SENZA STATO", 0) + 1
    return {
        "schede": schede,
        "conteggi": conteggi,
        "registri": [{"chiave": k, "nome": n, "cartella": str(c)}
                     for k, n, c, _ in REGISTRI],
    }


def scheda(ident: str) -> dict | None:
    """Una card intera, resa in HTML. `None` se l'id non e' nell'indice."""
    for chiave, etichetta, f in _percorsi():
        if f"{chiave}/{f.stem}" != ident:
            continue
        try:
            testo = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return None
        fuori = _scheda(f, chiave, etichetta, testo)
        fuori["percorso"] = str(f)
        fuori["html"] = rendi(testo)
        fuori["agenti"] = agenti_sul_progetto(f.stem)
        return fuori
    return None


# --------------------------------------------------------------------------
# chi ci sta lavorando adesso

# Parole che compaiono in mezzo progetto: agganciarci una sessione vuol dire
# agganciarla a caso.
GENERICHE = {
    "project", "sistema", "system", "app", "web", "sito", "site", "page", "pagina",
    "api", "data", "dati", "test", "fix", "new", "nuovo", "demo", "tool", "tools",
    "card", "cards", "prod", "main", "home", "audit", "gate", "log", "file", "bot",
    "lead", "engine", "hustle", "side", "brain", "mobile", "agente", "agent",
}
_PAROLE = re.compile(r"[a-z0-9]+")


def _aghi(stem: str) -> list[str]:
    """Cosa si cerca nel testo della Sala per dire «questa sessione è su questo
    progetto». La frase intera per prima: se combacia quella, l'aggancio è
    sicuro e il `perche` lo dice in modo leggibile."""
    chiave = re.sub(r"[^a-z0-9]+", "_", stem.lower().removeprefix("project_")).strip("_")
    frase = chiave.replace("_", " ")
    token = [t for t in chiave.split("_") if len(t) >= 4 and t not in GENERICHE]
    return ([frase] if " " in frase else []) + token


def agenti_sul_progetto(stem: str, stato_sala: dict | None = None) -> list[dict]:
    """Le sessioni vive che stanno nominando questo progetto, e perché.

    Non è un campo della card e non deve diventarlo: si legge la Sala al volo
    (la stessa che alimenta `/api/sala`, ~43 ms) e si incrocia. Se la Sala non
    risponde la scheda esce lo stesso senza agenti — una roadmap illeggibile
    perché è esploso un elenco accessorio sarebbe un guasto peggiore.
    """
    aghi = _aghi(stem)
    if not aghi:
        return []
    try:
        if stato_sala is None:
            from . import sala
            stato_sala = sala.stato()
    except Exception:  # noqa: BLE001 - la scheda vale anche senza la Sala
        return []

    fuori: list[dict] = []
    for a in (stato_sala.get("agenti") or []):
        deleghe = [d.get("task") or "" for d in (a.get("deleghe") or []) if d.get("aperta")]
        campi = {
            "task": a.get("task") or "",
            "passo": a.get("passo") or "",
            "cartella": a.get("cwd") or "",
            "delega": " · ".join(deleghe),
        }
        testo = " ".join(_PAROLE.findall(" ".join(campi.values()).lower()))
        perche = next((ago for ago in aghi if ago in testo), None)
        if not perche:
            continue
        dove = next((k for k, v in campi.items()
                     if perche in " ".join(_PAROLE.findall(v.lower()))), "?")
        fuori.append({
            "nome": a.get("nome"), "agente": a.get("agente"), "stato": a.get("stato"),
            "sessione": a.get("sessione"), "task": campi["task"][:200],
            "perche": perche, "dove": dove,
        })
    return fuori


def indice_cervello() -> dict:
    """`nodo del grafo -> id di scheda`, per aprire la card da un nodo.

    Il cervello indicizza la **copia** delle card: `2-semantic/progetti/<stem>`
    per le due memorie, `2-semantic/progetti-sistema/<stem>` per sistema-andrea.
    La mappa vive qui perche' la fonte di verita' dei nomi e' l'elenco, non il
    grafo: se una card sparisce, sparisce anche la voce.
    """
    prefissi = {"azienda": "2-semantic/progetti",
                "privato": "2-semantic/progetti",
                "sistema": "2-semantic/progetti-sistema"}
    mappa: dict[str, str] = {}
    for chiave, _etichetta, f in _percorsi():
        nodo = f"{prefissi[chiave]}/{f.stem}"
        mappa.setdefault(nodo, f"{chiave}/{f.stem}")
    return mappa
