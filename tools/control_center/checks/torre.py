"""La torre stessa: lo snapshot che mostra e' fresco? (#COLLECTOR-0201)

Il 02/10 il collector e' rimasto appeso 7 ore e la torre ha mostrato le
letture delle 01:21Z come attuali. Questo check gira dentro il collector,
quindi legge lo snapshot del giro PRIMA: il primo giro dopo un'appesa la
denuncia. Mentre e' appeso lo dice il server (`stale` in /api/hub e
/api/state), che non dipende dal collector.
"""

from pathlib import Path

from ..contract import Check, Verdict, amber, green, red, unknown
from ..snapshot import FERMA_AMBRA_MIN, FERMA_ROSSO_MIN, STATE_FILE, freschezza, read_state

RIPARO = "launchctl kickstart -k gui/$UID/com.betredge.control-center.collector"


def check_torre_fresca(path: Path | None = None) -> Verdict:
    fonte = f"file:{path or STATE_FILE}"
    eta = freschezza(read_state(path))["eta_min"]
    if eta is None:
        return unknown("nessuno snapshot precedente leggibile", fonte)
    testo = f"snapshot precedente di {eta} min fa"
    prova = {"soglie_min": {"ambra": FERMA_AMBRA_MIN, "rosso": FERMA_ROSSO_MIN}, "riparo": RIPARO}
    if eta > FERMA_ROSSO_MIN:
        return red(f"{testo}: la torre e' rimasta ferma, i dati mostrati erano vecchi",
                   fonte, value=eta, evidence=prova)
    if eta > FERMA_AMBRA_MIN:
        return amber(f"{testo}: giri persi", fonte, value=eta, evidence=prova)
    return green(testo, fonte, value=eta, evidence=prova)


def checks() -> list[Check]:
    return [Check("torre_fresca", "daemon", "Torre aggiornata", check_torre_fresca)]
