"""I daemon locali e i cron su Vercel.

Principio guida: si giudica l'artefatto, non l'invocazione. Un processo puo'
uscire con codice zero e non produrre niente; un cron puo' rispondere 200 e non
scrivere una riga. Il 2026-08-20 tre daemon di questo elenco erano morti in
silenzio, incluso il controllore di salute.
"""

import subprocess
from collections import namedtuple

from ..contract import Check, Verdict, amber, green, red, unknown
from ..db import DbUnavailable, fetch_all

SCOPE = (
    "com.agentic-markets.agents",
    "com.agentic-markets.watchdog",
    "com.agentic-markets.live-monitor",
    "com.agentic-markets.daemon-health",
    "com.agentic-markets.goalscorer-odds",
    "com.agentic-markets.weeklypick-morning",
    "io.maven.softmarkets.collect",
    "io.maven.softmarkets.predict",
)

# Due modi di giudicare un cron, e la scelta fra i due non e' cosmetica.
#
# FRESHNESS vale solo per i cron il cui artefatto e' INCONDIZIONATO: scrivono
# ogni volta che girano. Li' il silenzio e' un guasto.
#
# BACKLOG vale per i cron CONDIZIONALI, che scrivono solo se c'e' lavoro. Li'
# il silenzio e' ambiguo, e misurare la freschezza produce falsi rossi: il
# 2026-08-20 paygate-reconcile risultava rosso da 22 giorni solo perche'
# nessuno comprava, mentre il suo arretrato era zero. Per questi si misura il
# lavoro in attesa che il cron avrebbe dovuto smaltire.
CronSpec = namedtuple("CronSpec", "id label table column interval_seconds hard")
BacklogSpec = namedtuple("BacklogSpec", "id label sql unita nota")

CRONS = (
    CronSpec("cron_predictions", "Cron predictions/refresh", "match_predictions", "computed_at", 7200, True),
    # Il CRM scrive solo quando qualcuno entra in un trigger: il silenzio puo'
    # voler dire "fermo" o "nessuno da contattare". Non si puo' distinguere
    # senza replicare la logica dei segmenti, quindi ambra e frase onesta,
    # mai una notifica su un dato ambiguo.
    CronSpec("cron_crm", "Cron CRM", "crm_trigger_sends", "sent_at", 86400, False),
)

BACKLOGS = (
    BacklogSpec(
        "cron_settle",
        "Cron settle",
        """
        select count(*) from pick_ledger l
        left join pick_settlement s
          on s.source_table = l.source_table and s.source_id = l.source_id
        where l.commence_time < now() - interval '4 hours'
          and s.id is null and l.is_backfill = false
        """,
        "pick",
        "partite finite da oltre 4h senza settlement",
    ),
    BacklogSpec(
        "cron_paygate",
        "Cron paygate-reconcile",
        """
        select count(*) from paygate_orders
        where paid_at is not null and granted_at is null
          and paid_at < now() - interval '15 minutes'
        """,
        "ordini",
        "pagati da oltre 15 min e non ancora abilitati",
    ),
)

# Tabelle e colonne provengono da una lista chiusa scritta qui sopra, mai
# dall'esterno: e' cio' che rende sicura l'interpolazione nella query.
_AGE_SQL = "select extract(epoch from now() - max({col})) from {tbl}"


def _launchctl_table() -> dict[str, dict]:
    out = subprocess.run(
        ["launchctl", "list"], capture_output=True, text=True, timeout=10, check=True
    ).stdout
    return parse_launchctl(out)


def parse_launchctl(output: str) -> dict[str, dict]:
    """Tre colonne separate da tab: PID, ultimo stato, label."""
    tabella: dict[str, dict] = {}
    for line in output.splitlines():
        parti = line.split("\t")
        if len(parti) < 3:
            continue
        pid_raw, status_raw, label = parti[0].strip(), parti[1].strip(), parti[2].strip()
        if label == "Label" or not label:
            continue
        try:
            status = int(status_raw)
        except ValueError:
            continue
        tabella[label] = {
            "pid": int(pid_raw) if pid_raw.isdigit() else None,
            "status": status,
        }
    return tabella


def _human(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h {(seconds % 3600) // 60:02d}m"
    return f"{seconds // 86400}g {(seconds % 86400) // 3600}h"


def check_launchd(label: str) -> Verdict:
    try:
        tabella = _launchctl_table()
    except Exception as exc:
        return unknown(f"launchctl non interrogabile: {exc}", "launchctl list")

    riga = tabella.get(label)
    if riga is None:
        return red("non caricato in launchd", f"launchctl:{label}")

    if riga["status"] not in (0, -15):
        # -15 e' SIGTERM: un'uscita ordinata su richiesta, non un guasto.
        return red(
            f"ultimo exit {riga['status']}",
            f"launchctl:{label}",
            value=riga["status"],
            evidence=riga,
        )

    if riga["pid"] is not None:
        return green(f"in esecuzione, pid {riga['pid']}", f"launchctl:{label}", evidence=riga)
    return green("caricato, ultimo run pulito", f"launchctl:{label}", evidence=riga)


def check_cron(spec: CronSpec) -> Verdict:
    sql = _AGE_SQL.format(col=spec.column, tbl=spec.table)
    try:
        righe = fetch_all(sql)
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", f"db:{spec.table}")

    eta = righe[0][0] if righe else None
    if eta is None:
        return red(
            f"nessuna riga in {spec.table}: mai prodotto nulla",
            f"db:{spec.table}",
            evidence={"atteso_ogni_s": spec.interval_seconds},
        )

    eta = float(eta)
    limite = spec.interval_seconds * 2
    testo = _human(eta)
    if eta > limite:
        atteso = _human(spec.interval_seconds)
        if not spec.hard:
            return amber(
                f"nessuna scrittura da {testo}: o e' fermo o non c'era nulla da fare"
                f" (atteso ogni {atteso})",
                f"db:{spec.table}",
                value=testo,
                evidence={"age_s": int(eta), "limite_s": limite, "condizionale": True},
            )
        return red(
            f"nessuna scrittura da {testo} (atteso ogni {atteso})",
            f"db:{spec.table}",
            value=testo,
            evidence={"age_s": int(eta), "limite_s": limite},
        )
    return green(
        f"ultima scrittura {testo} fa",
        f"db:{spec.table}",
        value=testo,
        evidence={"age_s": int(eta)},
    )


def check_backlog(spec: BacklogSpec) -> Verdict:
    """Misura il lavoro in attesa, non la data dell'ultima scrittura.

    Zero arretrato e' verde anche dopo settimane di silenzio: significa che il
    cron non aveva niente da fare, non che e' morto. Arretrato maggiore di zero
    e' rosso anche se ha scritto un minuto fa: c'e' lavoro fermo.
    """
    try:
        righe = fetch_all(spec.sql)
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", f"db:{spec.id}")

    arretrato = int(righe[0][0]) if righe and righe[0][0] is not None else 0
    if arretrato:
        return red(
            f"{arretrato} {spec.unita} in attesa: {spec.nota}",
            f"db:{spec.id}",
            value=arretrato,
            evidence={"arretrato": arretrato, "criterio": spec.nota},
        )
    return green(
        f"nessun arretrato ({spec.nota})",
        f"db:{spec.id}",
        value=0,
        evidence={"criterio": spec.nota},
    )


def checks() -> list[Check]:
    fatti = [
        Check(
            f"launchd_{label.rsplit('.', 1)[-1]}",
            "daemon",
            label,
            lambda lbl=label: check_launchd(lbl),
            timeout_seconds=15,
        )
        for label in SCOPE
    ]
    fatti += [
        Check(spec.id, "cron", spec.label, lambda s=spec: check_cron(s), timeout_seconds=20)
        for spec in CRONS
    ]
    fatti += [
        Check(spec.id, "cron", spec.label, lambda s=spec: check_backlog(s), timeout_seconds=25)
        for spec in BACKLOGS
    ]
    return fatti
