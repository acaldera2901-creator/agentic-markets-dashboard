"""La sala di lavoro: chi sta lavorando adesso, e su cosa.

La fonte non l'abbiamo inventata noi: **la scrive Claude Code**. Ogni sessione
viva tiene aggiornato `~/.claude/sessions/<pid>.json` con nome, agente, cwd e
`status` (`busy`/`idle`) — e' lo stesso registro dietro `ListAgents`. Il task
corrente si legge in coda al transcript della sessione.

Due conseguenze di progetto:

1. **Non si legge lo snapshot.** Il collector gira ogni 5 minuti: una sala
   "dal vivo" vecchia di 5 minuti sarebbe una bugia. Si legge la fonte al
   momento della richiesta, come gia' fa `/api/council`. Costa tre file
   piccoli piu' una `seek` in coda al transcript, non una scansione.
2. **Il processo vivo comanda sul file.** Un file di sessione resta su disco
   quando la shell muore male: se il pid non e' piu' un processo `claude`,
   la sessione e' chiusa, non "idle". Un elenco che mostra fantasmi come
   agenti al lavoro e' peggio di un elenco vuoto.
"""

from __future__ import annotations

import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

SESSIONI = Path.home() / ".claude" / "sessions"
PROGETTI = Path.home() / ".claude" / "projects"

# Quanta coda di transcript si legge. I transcript arrivano a 30 MB: leggerli
# interi ad ogni richiesta sarebbe una scansione. Si parte piccoli e si allarga
# **solo se** il prompt corrente non e' ancora comparso: misurato il 03/09, con
# 256 KB fissi il task restava vuoto su 2 sessioni su 3 — e un task vuoto si
# legge come "non sta facendo niente", che e' il contrario del vero.
FINESTRE = (256 * 1024, 1024 * 1024, 4 * 1024 * 1024)

# Oltre questo silenzio un `busy` merita di essere segnalato — non accusato.
# A 10 minuti la soglia gridava al lupo: misurato il 03/09, `me-ceo` risultava
# "appesa" mentre stava semplicemente aspettando il sottoagente che scriveva
# questa pagina. Una sessione che delega resta ferma per tutta la durata della
# delega, e mezz'ora e' normale. Un allarme che sbaglia brucia la fiducia
# nella pagina piu' di quanto la salvi un allarme in anticipo.
SILENZIO_SOSPETTO_S = 1800


# ---------------------------------------------------------------- processi

def _processi_claude() -> dict[int, str]:
    """pid -> riga di comando, solo per i processi `claude` veri.

    Serve a due cose insieme: scartare le sessioni fantasma e riconoscere il
    riuso di pid (un pid libero e riassegnato a `vim` non e' un agente).
    """
    try:
        out = subprocess.run(["ps", "-Ao", "pid=,command="],
                             capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return {}
    vivi: dict[int, str] = {}
    for riga in out.splitlines():
        riga = riga.strip()
        if not riga:
            continue
        pid, _, cmd = riga.partition(" ")
        if not pid.isdigit():
            continue
        # Il binario si presenta come `claude ...` o come `.../versions/2.1.259 ...`
        if re.search(r"(^|/)claude(\s|$)|/versions/[\d.]+(\s|$)", cmd):
            vivi[int(pid)] = cmd.strip()
    return vivi


# ---------------------------------------------------------------- transcript

def _transcript(session_id: str) -> Path | None:
    """Il transcript sta sotto una cartella per cwd, con un nome slugghificato.

    Si cerca per glob invece di ricostruire lo slug: la regola di slug e' di
    Claude Code, non nostra, e un carattere trattato diversamente darebbe un
    "nessuna attivita'" silenzioso invece di un errore.
    """
    if not re.fullmatch(r"[0-9a-fA-F-]{8,64}", session_id or ""):
        return None
    trovati = sorted(PROGETTI.glob(f"*/{session_id}.jsonl"),
                     key=lambda p: p.stat().st_mtime, reverse=True)
    return trovati[0] if trovati else None


def _righe_in_coda(path: Path, byte: int) -> list[dict]:
    try:
        size = path.stat().st_size
        with path.open("rb") as fh:
            if size > byte:
                fh.seek(size - byte)
                fh.readline()  # la prima riga letta e' quasi certamente tronca
            grezzo = fh.read().decode("utf-8", "replace")
    except (OSError, ValueError):
        return []
    righe = []
    for riga in grezzo.splitlines():
        riga = riga.strip()
        if not riga.startswith("{"):
            continue
        try:
            righe.append(json.loads(riga))
        except json.JSONDecodeError:
            continue
    return righe


def _testo(blocchi) -> str:
    if isinstance(blocchi, str):
        return blocchi
    if not isinstance(blocchi, list):
        return ""
    pezzi = [b.get("text", "") for b in blocchi
             if isinstance(b, dict) and b.get("type") == "text"]
    return "\n".join(p for p in pezzi if p)


def _passo_assistente(blocchi) -> str:
    """Cosa ha appena fatto: una frase, o lo strumento che sta usando."""
    if not isinstance(blocchi, list):
        return _testo(blocchi)
    for b in reversed(blocchi):
        if not isinstance(b, dict):
            continue
        if b.get("type") == "tool_use":
            nome = b.get("name") or "strumento"
            inp = b.get("input") or {}
            det = ""
            if isinstance(inp, dict):
                for chiave in ("description", "command", "file_path", "pattern",
                               "query", "prompt", "url"):
                    if inp.get(chiave):
                        det = str(inp[chiave]).strip().splitlines()[0]
                        break
            return f"{nome}: {det[:160]}" if det else nome
        if b.get("type") == "text" and b.get("text", "").strip():
            return b["text"].strip()
    return ""


def _pulisci(t: str, limite: int = 260) -> str:
    t = re.sub(r"<[^>]{1,80}>", " ", t or "")   # tag di sistema, non contenuto
    t = re.sub(r"\s+", " ", t).strip()
    return t[:limite] + ("…" if len(t) > limite else "")


# Roba che compare fra i messaggi "user" ma non e' una richiesta di Andrea:
# l'eco di uno slash command, l'output di un comando bash, i promemoria di
# sistema, le notifiche dei job in background. Un elenco di tag non regge:
# il 03/09 `<task-notification>` e `<bash-stdout>` non c'erano nell'elenco e
# il task di `me-ceo` diventava "a0517de8ef1e44393 toolu_01K5h3UBbMpN7eB3",
# cioe' gli id rimasti dopo che `_pulisci` aveva tolto i tag.
# La regola che li copre tutti, anche quelli che non esistono ancora:
# **una richiesta scritta da una persona non comincia con un tag**.
_RUMORE_UTENTE = re.compile(r"^\s*<[a-z][a-z0-9-]*[ >]", re.I)


def _scorri(righe: list[dict]) -> dict:
    task = passo = ""
    ultimo_ts = None
    deleghe: list[dict] = []

    for d in righe:
        if not isinstance(d, dict):
            continue
        if d.get("timestamp"):
            ultimo_ts = d["timestamp"]
        msg = d.get("message") or {}
        cont = msg.get("content")

        if d.get("type") == "user" and not d.get("isSidechain"):
            # Un `tool_result` e' traffico interno, non una richiesta di Andrea.
            testo = _testo(cont)
            e_tool_result = (isinstance(cont, list) and cont
                             and isinstance(cont[0], dict)
                             and cont[0].get("type") == "tool_result")
            if testo and not e_tool_result and not _RUMORE_UTENTE.match(testo):
                task = testo
        elif d.get("type") == "assistant":
            p = _passo_assistente(cont)
            if p:
                passo = p

        # Le deleghe: chi ha passato lavoro a chi. NON si dice "in corso":
        # misurato il 03/09, il `tool_result` di un `Agent` in background torna
        # dopo 1,5 s (18:01:52 -> 18:01:54) mentre il sottoagente lavorava
        # ancora. La coppia tool_use/tool_result non misura la vita del
        # sottoagente, e spacciarla per tale darebbe "attivo" a lavori finiti.
        if isinstance(cont, list):
            for b in cont:
                if (isinstance(b, dict) and b.get("type") == "tool_use"
                        and b.get("name") in ("Agent", "Task")):
                    inp = b.get("input") or {}
                    deleghe.append({
                        "agente": inp.get("subagent_type") or "general-purpose",
                        "task": _pulisci(inp.get("description") or "", 90),
                        "quando": _iso(d.get("timestamp")),
                    })

    return {
        "task": _pulisci(task),
        "passo": _pulisci(passo, 200),
        "ultimo_evento": _iso(ultimo_ts),
        "eta_evento_s": _eta_s(ultimo_ts),
        "deleghe": deleghe[-3:],
    }


def attivita(session_id: str) -> dict:
    """L'ultimo scambio della sessione, letto in coda al suo transcript."""
    path = _transcript(session_id)
    if path is None:
        return {"disponibile": False,
                "perche": "nessun transcript per questa sessione"}

    letto = esito = None
    for finestra in FINESTRE:
        righe = _righe_in_coda(path, finestra)
        if not righe:
            break
        letto, esito = finestra, _scorri(righe)
        # Il passo c'e' quasi sempre; e' il prompt che puo' stare piu' indietro.
        if esito["task"]:
            break
        if finestra >= path.stat().st_size:
            break

    if esito is None:
        return {"disponibile": False,
                "perche": f"transcript illeggibile o vuoto ({path.name})"}

    esito["disponibile"] = True
    esito["transcript"] = path.name
    esito["finestra_kb"] = letto // 1024
    if not esito["task"]:
        # Meglio dirlo che mostrare un vuoto: un task vuoto si legge come
        # "non sta facendo niente", e non e' la stessa cosa.
        esito["task_perche"] = (f"nessun prompt negli ultimi {letto // 1024} KB "
                                f"di transcript")
    return esito


# ---------------------------------------------------------------- tempo

def _iso(ts) -> str | None:
    """Sempre con il fuso. Un orario nudo su una pagina locale si legge come
    ora locale anche quando e' UTC, e sono due ore di differenza inventate."""
    if ts is None:
        return None
    try:
        if isinstance(ts, (int, float)):
            dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        else:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
    except (ValueError, OSError, OverflowError):
        return None
    return dt.astimezone().isoformat(timespec="seconds")


def _eta_s(ts) -> int | None:
    iso = _iso(ts)
    if iso is None:
        return None
    return max(0, int(time.time() - datetime.fromisoformat(iso).timestamp()))


# ---------------------------------------------------------------- la sala

def stato() -> dict:
    """Chi e' al lavoro adesso. Si legge sempre dal vivo."""
    vivi = _processi_claude()
    agenti, fantasmi = [], []

    file_sessione = sorted(SESSIONI.glob("*.json")) if SESSIONI.is_dir() else []
    for f in file_sessione:
        try:
            sess = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        pid = sess.get("pid")
        if not isinstance(pid, int):
            continue
        if pid not in vivi:
            fantasmi.append({"nome": sess.get("name") or "-", "pid": pid,
                             "visto": _iso(sess.get("updatedAt"))})
            continue

        att = attivita(sess.get("sessionId", ""))
        # Una sessione appena nata non ha ancora scritto `status`: il campo
        # manca proprio (verificato il 03/09 su una run `-p`). Fuori si manda
        # "?" e la pagina lo dice — "in ascolto" sarebbe un dato inventato,
        # e qui vale la regola della sala controllo: `unknown` non e' un colore.
        stato_dich = sess.get("status") or "?"
        eta_stato = _eta_s(sess.get("statusUpdatedAt"))
        eta_evt = att.get("eta_evento_s")
        sospetto = (stato_dich == "busy" and eta_evt is not None
                    and eta_evt > SILENZIO_SOSPETTO_S)

        agenti.append({
            "nome": sess.get("name") or "-",
            "agente": sess.get("agent") or "—",
            "stato": stato_dich,
            "stato_da": _iso(sess.get("statusUpdatedAt")),
            "eta_stato_s": eta_stato,
            "silenzio_sospetto": sospetto,
            "pid": pid,
            "cwd": sess.get("cwd") or "?",
            "kind": sess.get("kind") or "?",
            # `cli` = un'ala aperta da Andrea; `sdk-cli` = un lavoro headless
            # (un daemon, un job). Sono tutti e due "al lavoro", ma non sono
            # la stessa cosa e la pagina non deve confonderli.
            "avvio": sess.get("entrypoint") or "?",
            "acceso_da": _iso(sess.get("startedAt")),
            "sessione": (sess.get("sessionId") or "")[:8],
            "versione": sess.get("version") or "?",
            "task": att.get("task", ""),
            "passo": att.get("passo", ""),
            "ultimo_evento": att.get("ultimo_evento"),
            "eta_evento_s": eta_evt,
            "attivita_disponibile": att.get("disponibile", False),
            "attivita_perche": att.get("perche", "") or att.get("task_perche", ""),
            "deleghe": att.get("deleghe", []),
        })

    # Prima chi lavora, poi chi ha parlato piu' di recente.
    agenti.sort(key=lambda a: (a["stato"] != "busy",
                               a.get("eta_evento_s") if a.get("eta_evento_s") is not None else 10**9))

    return {
        "generato": _iso(time.time() * 1000),
        "agenti": agenti,
        "fantasmi": fantasmi,
        "registro_presente": bool(file_sessione),
        "registro": str(SESSIONI),
    }
