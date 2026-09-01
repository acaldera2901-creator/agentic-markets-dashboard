"""Il watcher: prende i job in coda e chiede a Claude una diagnosi.

Vincolo centrale: Claude gira in `--permission-mode plan` con una lista di
strumenti ristretta. Puo' leggere, cercare e guardare i log; non puo' scrivere
file, non puo' toccare il DB, non puo' deployare. Il suo prodotto e' un
documento con una PROPOSAL, che resta in attesa del tuo APPROVE.

Questo non e' cerimonia: un tasto che riparasse da solo la produzione
aggirerebbe il gate di approvazione, e il gate esiste perche' un agente che
sbaglia su prod costa piu' di uno che aspetta.
"""

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from .actions import JOBS_DIR, REPORTS_DIR
from .contract import now_iso

CLAUDE = "/Users/calde/.local/bin/claude"
REPO = Path(__file__).resolve().parents[2]
TIMEOUT_S = 600

STRUMENTI = (
    "Read Grep Glob "
    "Bash(launchctl list*) Bash(tail*) Bash(head*) Bash(cat*) "
    "Bash(git log*) Bash(git show*) Bash(ls*) Bash(plutil*)"
)

PROMPT = """Un check della dashboard BetRedge Control Center e' rosso. Diagnostica la causa.

CHECK: {check_id}
LIVELLO: {level}
COSA DICE: {headline}
FONTE: {source}
MISURATO: {measured_at}
PROVE RACCOLTE: {evidence}

Contesto: la dashboard vive in tools/control_center/ di questo repo; la sua
spec e' in docs/superpowers/specs/2026-08-20-betredge-control-center-design.md.
I log dei daemon stanno in ~/Library/Logs/ e in ~/Library/Application Support/.

Il tuo compito e' SOLO diagnosticare e proporre. Non modificare niente.

Produci, in italiano e conciso:
1. CAUSA — cosa e' rotto davvero, con l'evidenza che lo dimostra (un log, un
   exit code, una riga di codice). Se non riesci a stabilirla, dillo invece di
   indovinare.
2. COSA NON E' — le ipotesi che hai escluso e perche'. Serve a non rifare due
   volte lo stesso giro.
3. PROPOSAL — cosa cambierebbe esattamente: file o tabelle toccate, prima e
   dopo, comandi, reversibilita', raggio d'azione, come si verifica che ha
   funzionato.
4. RISCHIO — basso / medio / alto, e se serve un APPROVE umano.
"""


def _run_claude(prompt: str) -> tuple[bool, str]:
    try:
        esito = subprocess.run(
            [
                CLAUDE, "-p", prompt,
                "--permission-mode", "plan",
                "--allowedTools", *STRUMENTI.split(),
            ],
            cwd=str(REPO), capture_output=True, text=True, timeout=TIMEOUT_S, check=False,
        )
    except subprocess.TimeoutExpired:
        return False, f"Claude non ha risposto entro {TIMEOUT_S}s."
    except Exception as exc:  # noqa: BLE001
        return False, f"Impossibile avviare Claude: {exc}"
    if esito.returncode != 0:
        return False, f"Claude e' uscito con {esito.returncode}.\n\n{(esito.stderr or '')[:2000]}"
    return True, esito.stdout.strip()


def lavora_job(percorso: Path) -> str:
    d = json.loads(percorso.read_text())
    if d.get("stato") != "in_coda":
        return d.get("stato", "?")

    d["stato"] = "in_corso"
    d["avviato"] = now_iso()
    percorso.write_text(json.dumps(d, ensure_ascii=False, indent=1))

    check = d.get("check", {})
    prompt = PROMPT.format(
        check_id=d.get("check_id"),
        level=check.get("level"),
        headline=check.get("headline"),
        source=check.get("source"),
        measured_at=check.get("measured_at"),
        evidence=json.dumps(check.get("evidence"), ensure_ascii=False),
    )
    ok, testo = _run_claude(prompt)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    intestazione = (
        f"# Diagnosi · {d.get('check_id')}\n\n"
        f"- Job: `{d.get('job_id')}`\n"
        f"- Accodato: {d.get('creato')}\n"
        f"- Concluso: {now_iso()}\n"
        f"- Check: {check.get('headline')}\n\n"
        "> Diagnosi in sola lettura. Nessuna modifica e' stata applicata: la\n"
        "> PROPOSAL qui sotto attende un APPROVE umano.\n\n---\n\n"
    )
    (REPORTS_DIR / f"{d['job_id']}.md").write_text(intestazione + testo + "\n")

    d["stato"] = "pronto" if ok else "fallito"
    d["concluso"] = now_iso()
    d["report"] = d["job_id"]
    percorso.write_text(json.dumps(d, ensure_ascii=False, indent=1))
    return d["stato"]


def main(argv=None) -> int:
    if not JOBS_DIR.exists():
        return 0
    fatti = 0
    for percorso in sorted(JOBS_DIR.glob("*.json")):
        try:
            d = json.loads(percorso.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        if d.get("stato") != "in_coda":
            continue
        stato = lavora_job(percorso)
        print(f"{percorso.name}: {stato}")
        fatti += 1
    if not fatti:
        print("nessun job in coda")
    return 0


if __name__ == "__main__":
    sys.exit(main())
