"""Lo stato su disco: uno snapshot corrente e uno storico append-only."""

import json
import os
import tempfile
from pathlib import Path

from .contract import Verdict

STATE_DIR = Path.home() / ".betredge-cc"
STATE_FILE = STATE_DIR / "state.json"
HISTORY_FILE = STATE_DIR / "history.jsonl"

_ORDER = {"red": 0, "amber": 1, "unknown": 2, "green": 3}


def read_state(path: Path | None = None) -> dict:
    """Lo stato precedente, o un dict vuoto. Non solleva mai.

    Un collector che muore perche' lo snapshot precedente e' illeggibile non
    riesce nemmeno a riscriverlo: il fallimento diventa permanente.
    """
    target = Path(path) if path else STATE_FILE
    try:
        return json.loads(target.read_text())
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def write_state(state: dict, path: Path | None = None) -> None:
    """Scrive su temporaneo e rinomina: il server non legge mai un file a meta'."""
    target = Path(path) if path else STATE_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(target.parent), prefix=".state-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
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
    with target.open("a") as fh:
        fh.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")


def verdict_summary(verdicts: dict[str, Verdict]) -> dict:
    """Il contenuto della barra del verdetto: un livello e una frase sola."""
    counts = {level: 0 for level in ("green", "amber", "red", "unknown")}
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

    gravi = sorted(
        (v for v in verdicts.values() if v.level in ("red", "amber")),
        key=lambda v: _ORDER[v.level],
    )
    detail = " - ".join(v.headline for v in gravi[:3])

    return {"level": level, "counts": counts, "headline": headline, "detail": detail}


def build_state(
    verdicts: dict[str, Verdict],
    groups: dict[str, str],
    alert_state: dict,
    generated_at: str,
) -> dict:
    return {
        "generated_at": generated_at,
        "summary": verdict_summary(verdicts),
        "checks": {
            cid: {**v.to_dict(), "group": groups.get(cid, "altro")}
            for cid, v in verdicts.items()
        },
        "alerts": alert_state,
    }
