"""Lo stato su disco: uno snapshot corrente e uno storico append-only."""

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from .contract import Verdict

STATE_DIR = Path.home() / ".betredge-cc"
STATE_FILE = STATE_DIR / "state.json"
HISTORY_FILE = STATE_DIR / "history.jsonl"

# Un solo ordinamento di gravita' per tutto il sistema. Era duplicato nel
# collector e nella pagina, e la copia nel collector non conosceva "info":
# il dry-run e' morto con KeyError appena e' arrivato il primo KPI.
ORDER = {"red": 0, "amber": 1, "unknown": 2, "green": 3, "info": 4}
_ORDER = ORDER

# La torre e' ferma se il suo snapshot e' piu' vecchio di cosi' (#COLLECTOR-0201).
# Il collector gira ogni 5 minuti: 12 = due giri persi, 20 = quattro. Il 02/10
# la torre ha mostrato per 7 ore letture delle 01:21Z come attuali.
FERMA_AMBRA_MIN = 12
FERMA_ROSSO_MIN = 20


def freschezza(state: dict, now: datetime | None = None) -> dict:
    """Eta' in minuti dello snapshot e se e' da considerare fermo."""
    try:
        nato = datetime.strptime(state["generated_at"], "%Y-%m-%dT%H:%M:%SZ")
    except (KeyError, TypeError, ValueError):
        return {"eta_min": None, "stale": True}
    adesso = now or datetime.now(timezone.utc)
    eta = int((adesso - nato.replace(tzinfo=timezone.utc)).total_seconds() // 60)
    return {"eta_min": eta, "stale": eta > FERMA_ROSSO_MIN}


def read_state(path: Path | None = None) -> dict:
    """Lo stato precedente, o un dict vuoto. Non solleva mai.

    Un collector che muore perche' lo snapshot precedente e' illeggibile non
    riesce nemmeno a riscriverlo: il fallimento diventa permanente.
    """
    target = Path(path) if path else STATE_FILE
    try:
        return json.loads(target.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def write_state(state: dict, path: Path | None = None) -> None:
    """Scrive su temporaneo e rinomina: il server non legge mai un file a meta'."""
    target = Path(path) if path else STATE_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(target.parent), prefix=".state-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(state, fh, indent=1, ensure_ascii=False, default=str)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, target)  # atomico sullo stesso filesystem
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def append_history(
    verdicts: dict[str, Verdict], generated_at: str, path: Path | None = None
) -> None:
    """Una riga per run, coi soli campi che servono agli sparkline.

    Lo storico resta piccolo apposta: serve a rispondere "da quando e' rotto",
    non a essere un secondo database.
    """
    target = Path(path) if path else HISTORY_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "at": generated_at,
        "checks": {cid: {"level": v.level, "value": v.value} for cid, v in verdicts.items()},
    }
    with target.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")


def verdict_summary(verdicts: dict[str, Verdict]) -> dict:
    """Il contenuto della barra del verdetto: un livello e una frase sola."""
    counts = {level: 0 for level in ("green", "amber", "red", "unknown", "info")}
    for verdict in verdicts.values():
        counts[verdict.level] += 1

    if counts["red"]:
        level = "red"
    elif counts["amber"]:
        level = "amber"
    elif counts["unknown"] and not counts["green"]:
        level = "unknown"
    else:
        level = "green"

    pezzi = []
    if counts["red"]:
        pezzi.append(f"{counts['red']} {'rosso' if counts['red'] == 1 else 'rossi'}")
    if counts["amber"]:
        pezzi.append(f"{counts['amber']} ambra")
    if counts["unknown"]:
        pezzi.append(f"{counts['unknown']} non misurati")
    headline = ", ".join(pezzi) if pezzi else "tutto a posto"

    # Il dettaglio nomina il check: "ultimo exit 1" da solo non dice nulla, e
    # questa e' l'unica riga che si legge quando la barra e' rossa.
    gravi = sorted(
        ((cid, v) for cid, v in verdicts.items() if v.level in ("red", "amber")),
        key=lambda kv: _ORDER[kv[1].level],
    )
    detail = " - ".join(f"{cid}: {v.headline}" for cid, v in gravi[:3])

    return {"level": level, "counts": counts, "headline": headline, "detail": detail}


def build_state(
    verdicts: dict[str, Verdict],
    groups: dict[str, str],
    alert_state: dict,
    generated_at: str,
    riavviabili: set[str] | None = None,
) -> dict:
    """Lo snapshot che la pagina legge.

    `riavviabile` viaggia per check, non come regola: la pagina non deve
    dedurre dal prefisso dell'id quali azioni esistono. Indovinandolo offriva
    "Riavvia" su daemon-health, dove il riavvio non puo' funzionare.
    """
    puo_riavviare = riavviabili or set()
    return {
        "generated_at": generated_at,
        "summary": verdict_summary(verdicts),
        "checks": {
            cid: {
                **v.to_dict(),
                "group": groups.get(cid, "altro"),
                "riavviabile": cid in puo_riavviare,
            }
            for cid, v in verdicts.items()
        },
        "alerts": alert_state,
    }
