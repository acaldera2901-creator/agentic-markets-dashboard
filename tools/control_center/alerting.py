"""Chi merita una notifica. Funzione pura: nessuna rete, nessun orologio interno."""

from datetime import datetime, timezone

from .contract import Verdict

CONFIRM_RUNS = 2
REPEAT_AFTER_SECONDS = 6 * 3600


def _parse(stamp: str | None) -> datetime | None:
    if not stamp:
        return None
    try:
        return datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def decide_alerts(
    prev: dict, verdicts: dict[str, Verdict], now: datetime
) -> tuple[list[dict], dict]:
    """Decide le notifiche confrontando i livelli col run precedente.

    Le regole, dalla spec sezione 7:
      - verso rosso: notifica solo dopo CONFIRM_RUNS run consecutivi;
      - da rosso notificato a non-rosso: una notifica di rientro;
      - ambra e unknown: mai notificati, vivono sulla pagina;
      - un rosso gia' notificato tace per REPEAT_AFTER_SECONDS.

    Lo stato ritornato va salvato nello snapshot: e' cio' che fa sopravvivere
    l'isteresi a un riavvio, evitando la raffica di allarmi gia' noti al primo
    run dopo un reboot.
    """
    notifiche: list[dict] = []
    nuovo: dict = {}

    for check_id, verdict in verdicts.items():
        before = prev.get(check_id, {})
        red_runs = int(before.get("red_runs", 0))
        notified_at = before.get("notified_at")

        if verdict.level == "red":
            red_runs += 1
            last = _parse(notified_at)
            scaduto = last is None or (now - last).total_seconds() >= REPEAT_AFTER_SECONDS
            if red_runs >= CONFIRM_RUNS and scaduto:
                notifiche.append(
                    {
                        "check_id": check_id,
                        "kind": "down",
                        "title": f"BetRedge - {check_id} e' rosso",
                        "body": verdict.headline,
                    }
                )
                notified_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            if notified_at:
                notifiche.append(
                    {
                        "check_id": check_id,
                        "kind": "up",
                        "title": f"BetRedge - {check_id} e' rientrato",
                        "body": verdict.headline,
                    }
                )
            red_runs = 0
            notified_at = None

        nuovo[check_id] = {
            "level": verdict.level,
            "red_runs": red_runs,
            "notified_at": notified_at,
        }

    # I check scomparsi non restano nello stato: altrimenti un check rinominato
    # trascinerebbe per sempre il suo vecchio rosso.
    return notifiche, nuovo
