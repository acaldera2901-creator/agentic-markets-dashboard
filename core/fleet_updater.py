"""Aggiorna la cartella che la flotta ESEGUE davvero, prima di riavviarla.

#FLOTTA-FERMA-0912 — il difetto misurato che ha reso necessario questo modulo.

Fra il 12/09 e il 22/09/2026 la flotta e' stata riavviata quattro volte (12, 14, 21, 22)
e ha continuato a eseguire il codice dell'11/09: 17 agenti su 17 con `code_sha=685926e6`
e un `boot_at` nuovo a ogni giro. Nessun riavvio era fallito. Il riavvio e'
`launchctl kickstart -k`, che riesegue la cartella COSI' COM'E': aggiornarla era un passo
manuale separato, che nessuno script faceva (cercato il 22/09 in `scripts/`, `ops/`,
`tools/` e nel crontab della macchina: zero riferimenti).

Due trappole che questo modulo evita per costruzione, ed entrambe si sono gia' presentate:

1. **La cartella della flotta non e' quella di chi la aggiorna.** Il watchdog ricava la
   propria radice da `__file__`; il plist CARICATO indicava un'altra cartella
   (`agentic-markets-worker`) rispetto alla copia nel repo (`agentic-markets`). Un
   aggiornamento fatto sulla propria radice avrebbe toccato un checkout che non esegue
   niente, e il riavvio successivo sarebbe riuscito lo stesso: «fatto» senza codice nuovo.
   Qui la cartella si legge SEMPRE dal plist caricato (o dal servizio vivo), mai da
   `__file__`, e se non si riesce a leggerla non si aggiorna niente.

2. **Un `merge --ff-only origin/main` senza `fetch` riesce e non aggiorna.** Il 22/09 il
   clone della flotta riportava `behind [26]` ma il suo riferimento remoto era fermo al
   15/09: un ff senza fetch si sarebbe fermato a un commit vecchio, con esito 0 e uno sha
   nuovo negli heartbeat che non e' quello del sito. Qui il fetch precede sempre il
   confronto, e il confronto e' con `origin/main` appena riletto.

Il modulo non riavvia niente: dice se la cartella e' stata portata avanti e fino a dove.
Chi lo chiama (il watchdog) decide il riavvio, perche' e' lui ad avere il cooldown.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

AGENT_LABEL = "com.agentic-markets.agents"
LOADED_PLIST = Path.home() / "Library/LaunchAgents" / f"{AGENT_LABEL}.plist"
BRANCH = "main"
REMOTE = "origin"

# Esiti possibili. Sono tre e non due di proposito: "saltato" non e' un errore — e' la
# risposta corretta quando una delle guardie non e' soddisfatta, e va distinta da
# "gia_allineato", perche' in un log le due cose si leggono in modo opposto.
AGGIORNATO = "aggiornato"
GIA_ALLINEATO = "gia_allineato"
SALTATO = "saltato"

Runner = Callable[..., subprocess.CompletedProcess]


@dataclass
class UpdateResult:
    esito: str
    motivo: str | None = None
    workdir: str | None = None
    sha_prima: str | None = None
    sha_dopo: str | None = None
    dettagli: dict = field(default_factory=dict)

    def as_log(self) -> dict:
        d: dict = {"esito": self.esito}
        for k in ("motivo", "workdir", "sha_prima", "sha_dopo"):
            v = getattr(self, k)
            if v:
                d[k] = v
        d.update(self.dettagli)
        return d


def _default_runner(args: list[str], cwd: str | None = None, timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False)


def fleet_workdir(runner: Runner = _default_runner, plist: Path | None = None) -> str | None:
    """La cartella che il servizio degli agenti esegue davvero.

    Ordine: il plist CARICATO (`~/Library/LaunchAgents/...`), poi il servizio vivo.
    Mai `__file__`: vedi la trappola 1 nel docstring del modulo. `None` significa
    «non lo so», e chi chiama deve fermarsi — non tirare a indovinare.
    """
    path = plist or LOADED_PLIST
    res = runner(["plutil", "-extract", "WorkingDirectory", "raw", "-o", "-", str(path)], timeout=10)
    if res.returncode == 0 and res.stdout.strip():
        return res.stdout.strip()

    res = runner(["launchctl", "print", f"gui/{_uid(runner)}/{AGENT_LABEL}"], timeout=15)
    if res.returncode == 0:
        for line in res.stdout.splitlines():
            if "working directory" in line.lower() and "=" in line:
                return line.split("=", 1)[1].strip()
    return None


def _uid(runner: Runner) -> str:
    res = runner(["id", "-u"], timeout=5)
    return res.stdout.strip() if res.returncode == 0 else ""


def _git(runner: Runner, workdir: str, *args: str, timeout: int = 30) -> subprocess.CompletedProcess:
    return runner(["git", *args], cwd=workdir, timeout=timeout)


def update_fleet_checkout(runner: Runner = _default_runner, workdir: str | None = None) -> UpdateResult:
    """Porta la cartella della flotta a `origin/main`, solo se e' sicuro farlo.

    Le guardie sono deliberatamente pessimiste: in ogni caso dubbio si SALTA. Il costo di
    saltare e' un giro di watchdog (60s); il costo di forzare e' una flotta ferma o un
    checkout con modifiche locali perse.
    """
    wd = workdir or fleet_workdir(runner)
    if not wd:
        return UpdateResult(SALTATO, "cartella della flotta non determinabile dal plist caricato")

    res = _git(runner, wd, "rev-parse", "--is-inside-work-tree")
    if res.returncode != 0 or res.stdout.strip() != "true":
        return UpdateResult(SALTATO, "la cartella non e' un checkout git", workdir=wd)

    res = _git(runner, wd, "rev-parse", "--abbrev-ref", "HEAD")
    branch = res.stdout.strip()
    if res.returncode != 0 or branch != BRANCH:
        return UpdateResult(SALTATO, f"branch '{branch or '?'}' diverso da {BRANCH}", workdir=wd)

    # Un ff-only su un albero sporco fallisce comunque, ma il messaggio di git non dice a
    # chi legge il log che c'erano modifiche locali: meglio dirlo qui, e non toccare nulla.
    res = _git(runner, wd, "status", "--porcelain")
    if res.returncode != 0:
        return UpdateResult(SALTATO, "git status non eseguibile", workdir=wd)
    if res.stdout.strip():
        return UpdateResult(SALTATO, "modifiche locali non committate nella cartella della flotta",
                            workdir=wd, dettagli={"file_sporchi": len(res.stdout.strip().splitlines())})

    # Il fetch PRIMA del confronto: vedi la trappola 2 nel docstring.
    res = _git(runner, wd, "fetch", REMOTE, "--quiet", timeout=120)
    if res.returncode != 0:
        return UpdateResult(SALTATO, "git fetch fallito", workdir=wd,
                            dettagli={"stderr": res.stderr[-300:]})

    locale = _git(runner, wd, "rev-parse", "HEAD").stdout.strip()
    remoto = _git(runner, wd, "rev-parse", f"{REMOTE}/{BRANCH}").stdout.strip()
    if not locale or not remoto:
        return UpdateResult(SALTATO, "sha locale o remoto illeggibile", workdir=wd)
    if locale == remoto:
        return UpdateResult(GIA_ALLINEATO, workdir=wd, sha_prima=locale[:8], sha_dopo=locale[:8])

    # `merge-base --is-ancestor` e' la domanda giusta: «il locale sta DENTRO la storia del
    # remoto?». Se non lo e', il checkout ha commit suoi e un ff-only fallirebbe: meglio
    # fermarsi e dirlo, perche' quel caso vuole un umano, non un altro tentativo.
    res = _git(runner, wd, "merge-base", "--is-ancestor", locale, remoto)
    if res.returncode != 0:
        return UpdateResult(SALTATO, "il checkout della flotta e' divergente da origin/main",
                            workdir=wd, sha_prima=locale[:8], dettagli={"sha_remoto": remoto[:8]})

    res = _git(runner, wd, "merge", "--ff-only", f"{REMOTE}/{BRANCH}", timeout=60)
    if res.returncode != 0:
        return UpdateResult(SALTATO, "merge --ff-only fallito", workdir=wd, sha_prima=locale[:8],
                            dettagli={"stderr": res.stderr[-300:]})

    dopo = _git(runner, wd, "rev-parse", "HEAD").stdout.strip()
    if dopo != remoto:
        # Non e' paranoia: e' esattamente il caso «il comando riesce e non aggiorna».
        return UpdateResult(SALTATO, "dopo il ff lo sha non e' quello di origin/main",
                            workdir=wd, sha_prima=locale[:8], sha_dopo=dopo[:8],
                            dettagli={"sha_remoto": remoto[:8]})

    return UpdateResult(AGGIORNATO, workdir=wd, sha_prima=locale[:8], sha_dopo=dopo[:8])
