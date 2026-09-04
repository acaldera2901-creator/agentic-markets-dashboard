"""Entrypoint del collector: misura, salva, confronta, avvisa."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import cervello
from .actions import RESTARTABLE
from .alerting import decide_alerts
from .checks import all_checks
from .contract import now_iso
from .notify import send
from .runner import run_checks
from .snapshot import ORDER, append_history, build_state, read_state, write_state


def collect(
    checks_list=None,
    now: datetime | None = None,
    state_path: Path | None = None,
    history_path: Path | None = None,
    notifier=None,
) -> dict:
    moment = now or datetime.now(timezone.utc)
    lista = checks_list if checks_list is not None else all_checks()
    consegna = notifier if notifier is not None else send

    precedente = read_state(state_path)
    verdicts = run_checks(lista, previous=precedente.get("checks"), now=moment)
    notifiche, alert_state = decide_alerts(precedente.get("alerts", {}), verdicts, moment)

    gruppi = {c.id: c.group for c in lista}
    stato = build_state(
        verdicts, gruppi, alert_state, now_iso(moment), riavviabili=set(RESTARTABLE)
    )

    # La consegna avviene prima della scrittura, cosi' il suo esito finisce
    # nello snapshot: un notificatore morto in silenzio sarebbe invisibile
    # esattamente quando serve, ed e' il guasto che ha ucciso daemon-health.
    if notifiche:
        canali = consegna(notifiche)
        stato["notify"] = {
            "at": now_iso(moment),
            "notifiche": len(notifiche),
            "canali": canali or [],
            "consegnato": bool(canali),
        }

    write_state(stato, state_path)
    append_history(verdicts, now_iso(moment), history_path)
    return stato


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="BetRedge Control Center - collector")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="misura e stampa senza scrivere lo stato ne' notificare",
    )
    args = parser.parse_args(argv)

    if args.dry_run:
        verdicts = run_checks(all_checks())
        for cid, verdict in sorted(verdicts.items(), key=lambda kv: ORDER[kv[1].level]):
            print(f"{verdict.level:8} {cid:28} {verdict.headline}")
        return 0

    stato = collect()
    print(json.dumps(stato["summary"], ensure_ascii=False))

    # Il grafo del cervello viaggia col collector invece che con un settimo
    # LaunchAgent: stessa cadenza, stesso venv, stessa working directory, e un
    # daemon in meno da sorvegliare. Sta in `main()` e non in `collect()`
    # perche' non e' un check: non ha un verdetto, non entra nello snapshot e
    # non deve comparire nel `--dry-run`, che per contratto non scrive nulla.
    # Se il parser muore, il collector non muore con lui: i check sono gia'
    # salvati, e un grafo vecchio vale piu' di uno stato mancante.
    try:
        grafo = cervello.aggiorna()
        print(json.dumps(grafo["conteggi"], ensure_ascii=False))
    except Exception as errore:  # noqa: BLE001 - nessun guasto qui merita il collector
        print(f"cervello: non aggiornato ({errore})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
