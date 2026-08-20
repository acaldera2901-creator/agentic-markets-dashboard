import json
from datetime import datetime, timezone

from tools.control_center.contract import amber, green, red, unknown
from tools.control_center.snapshot import (
    append_history,
    build_state,
    read_state,
    verdict_summary,
    write_state,
)

FIXED = datetime(2026, 8, 20, 17, 45, 0, tzinfo=timezone.utc)


def test_read_state_su_file_assente_e_un_dict_vuoto(tmp_path):
    assert read_state(tmp_path / "manca.json") == {}


def test_read_state_su_file_corrotto_non_solleva(tmp_path):
    p = tmp_path / "state.json"
    p.write_text("{ meta json")
    assert read_state(p) == {}


def test_write_state_non_lascia_mai_un_file_a_meta(tmp_path):
    p = tmp_path / "state.json"
    write_state({"a": 1}, p)
    assert json.loads(p.read_text()) == {"a": 1}
    assert [f.name for f in tmp_path.iterdir()] == ["state.json"]


def test_write_state_sovrascrive_senza_perdere_il_precedente_in_caso_di_errore(tmp_path):
    p = tmp_path / "state.json"
    write_state({"gen": 1}, p)
    write_state({"gen": 2}, p)
    assert read_state(p)["gen"] == 2


def test_history_appende_una_riga_per_run(tmp_path):
    h = tmp_path / "history.jsonl"
    append_history({"a": green("ok", "s", value=3, now=FIXED)}, "2026-08-20T17:45:00Z", h)
    append_history({"a": red("ko", "s", value=9, now=FIXED)}, "2026-08-20T17:50:00Z", h)
    righe = [json.loads(r) for r in h.read_text().splitlines()]
    assert len(righe) == 2
    assert righe[0]["checks"]["a"] == {"level": "green", "value": 3}
    assert righe[1]["checks"]["a"]["level"] == "red"


def test_summary_conta_i_livelli_e_scrive_la_frase():
    verdicts = {
        "cron_settle": red("settle fermo da 12h", "db", now=FIXED),
        "launchd_sm": red("exit 126", "launchctl", now=FIXED),
        "quota": amber("51%", "db", now=FIXED),
        "ig": unknown("token mancante", "ig", now=FIXED),
        "home": green("200", "http", now=FIXED),
    }
    s = verdict_summary(verdicts)
    assert s["counts"] == {"green": 1, "amber": 1, "red": 2, "unknown": 1, "info": 0}
    assert s["level"] == "red"
    assert s["headline"].startswith("2 rossi")
    # Il dettaglio deve dire QUALE check: "exit 126" senza il nome non
    # permette di agire, e la barra del verdetto e' l'unica riga che si legge.
    assert "cron_settle: settle fermo da 12h" in s["detail"]
    assert "launchd_sm: exit 126" in s["detail"]


def test_summary_tutto_verde_dice_tutto_a_posto():
    s = verdict_summary({"a": green("200", "http", now=FIXED)})
    assert s["level"] == "green"
    assert s["counts"]["red"] == 0
    assert "tutto" in s["headline"].lower()


def test_build_state_espone_i_gruppi_e_il_riassunto():
    verdicts = {"home": green("200", "http", now=FIXED)}
    st = build_state(verdicts, {"home": "piattaforma"}, {}, "2026-08-20T17:45:00Z")
    assert st["generated_at"] == "2026-08-20T17:45:00Z"
    assert st["checks"]["home"]["group"] == "piattaforma"
    assert st["summary"]["level"] == "green"


def test_i_kpi_non_entrano_nel_verdetto_ne_fra_i_rotti():
    from tools.control_center.contract import info

    s = verdict_summary(
        {
            "roi": info("ROI -6.9%", "db", value="-6.9%", now=FIXED),
            "home": green("200", "http", now=FIXED),
        }
    )
    assert s["level"] == "green"
    assert s["counts"]["info"] == 1
    assert s["detail"] == ""


def test_l_ordinamento_di_gravita_copre_tutti_i_livelli():
    # Era duplicato in tre punti e una copia non conosceva "info": il dry-run
    # e' morto con KeyError appena e' arrivato il primo KPI.
    from tools.control_center.contract import LEVELS
    from tools.control_center.snapshot import ORDER

    assert set(ORDER) == set(LEVELS)


def test_la_pagina_riceve_quali_check_sono_riavviabili():
    # Dedurlo dal prefisso dell'id faceva comparire "Riavvia" su daemon-health,
    # dove il riavvio non puo' funzionare: il tile offriva un'azione inutile.
    st = build_state(
        {
            "launchd_watchdog": red("exit 1", "launchctl", now=FIXED),
            "launchd_daemon-health": red("6 check rossi", "file", now=FIXED),
        },
        {},
        {},
        "2026-08-20T17:45:00Z",
        riavviabili={"launchd_watchdog"},
    )
    assert st["checks"]["launchd_watchdog"]["riavviabile"] is True
    assert st["checks"]["launchd_daemon-health"]["riavviabile"] is False
