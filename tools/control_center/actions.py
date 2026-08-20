"""Le azioni che la pagina puo' chiedere. Due livelli, e la differenza conta.

MECCANICHE: una lista chiusa di cose sicure e reversibili, eseguite senza
coinvolgere nessun agente — riavviare un LaunchAgent di perimetro. Se e' morto
con exit 126, il rimedio e' deterministico e non richiede giudizio.

DIAGNOSI: tutto il resto. Non viene riparato: viene messo in coda per un
watcher che raccoglie le prove e scrive una PROPOSAL. Un tasto che facesse
scrivere a un agente sul DB di produzione o su un deploy aggirerebbe il gate
di approvazione, che esiste proprio per quello.
"""

import json
import os
import secrets
import subprocess
import time
from pathlib import Path

from .checks.daemons import REPORTER, SCOPE
from .contract import now_iso
from .snapshot import STATE_DIR

TOKEN_FILE = STATE_DIR / "token"
JOBS_DIR = STATE_DIR / "jobs"
REPORTS_DIR = STATE_DIR / "reports"

# check_id -> label launchd. Costruita dalla stessa SCOPE dei check, cosi' non
# possono divergere: non si puo' riavviare qualcosa che non e' sorvegliato.
# I reporter sono esclusi: il loro exit diverso da zero non e' un guasto del
# processo ma il risultato del suo giudizio. Un kickstart lo rieseguirebbe,
# ritroverebbe gli stessi problemi e riuscirebbe con lo stesso codice — un
# tasto che per costruzione non puo' funzionare.
RESTARTABLE = {
    f"launchd_{label.rsplit('.', 1)[-1]}": label
    for label in SCOPE
    if label not in REPORTER
}


def ensure_token() -> str:
    """Token anti-CSRF. Il server ascolta su loopback, ma qualsiasi pagina web
    aperta nel browser potrebbe fare una POST verso 127.0.0.1: il token, che
    vive solo nel file e nella pagina servita, e' cio' che lo impedisce."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if TOKEN_FILE.exists():
        valore = TOKEN_FILE.read_text().strip()
        if valore:
            return valore
    valore = secrets.token_urlsafe(24)
    TOKEN_FILE.write_text(valore)
    TOKEN_FILE.chmod(0o600)
    return valore


def restart_daemon(check_id: str) -> dict:
    """Riavvia un LaunchAgent di perimetro. Reversibile, nessun dato in gioco."""
    label = RESTARTABLE.get(check_id)
    if label is None:
        return {"ok": False, "errore": f"{check_id} non e' fra i daemon riavviabili"}
    target = f"gui/{os.getuid()}/{label}"
    try:
        esito = subprocess.run(
            ["launchctl", "kickstart", "-k", target],
            capture_output=True, text=True, timeout=30, check=False,
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "errore": str(exc)}
    return {
        "ok": esito.returncode == 0,
        "azione": f"launchctl kickstart -k {target}",
        "returncode": esito.returncode,
        "stderr": (esito.stderr or "").strip()[:400],
    }


def request_diagnosis(check_id: str, check: dict) -> dict:
    """Accoda una diagnosi. Non ripara: raccoglie le prove e chiede una PROPOSAL."""
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    job_id = f"{int(time.time())}-{check_id}"
    payload = {
        "job_id": job_id,
        "check_id": check_id,
        "creato": now_iso(),
        "stato": "in_coda",
        "check": {
            "level": check.get("level"),
            "headline": check.get("headline"),
            "source": check.get("source"),
            "measured_at": check.get("measured_at"),
            "evidence": check.get("evidence"),
        },
    }
    percorso = JOBS_DIR / f"{job_id}.json"
    percorso.write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    return {"ok": True, "job_id": job_id}


def jobs_stato() -> dict:
    """Stato dei job per check_id, il piu' recente vince."""
    out: dict[str, dict] = {}
    if not JOBS_DIR.exists():
        return out
    for percorso in sorted(JOBS_DIR.glob("*.json")):
        try:
            d = json.loads(percorso.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        out[d.get("check_id", "?")] = {
            "job_id": d.get("job_id"),
            "stato": d.get("stato"),
            "creato": d.get("creato"),
            "concluso": d.get("concluso"),
            "report": d.get("report"),
        }
    return out


def leggi_report(job_id: str) -> str | None:
    """Legge un report per job_id. Il nome viene sanificato: solo il basename e
    solo caratteri attesi, cosi' nessun percorso arbitrario e' raggiungibile."""
    pulito = Path(job_id).name
    if not pulito or not all(c.isalnum() or c in "-_" for c in pulito):
        return None
    percorso = REPORTS_DIR / f"{pulito}.md"
    try:
        return percorso.read_text()
    except (FileNotFoundError, OSError):
        return None
