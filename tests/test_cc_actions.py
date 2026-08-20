import json

import pytest

from tools.control_center import actions


@pytest.fixture(autouse=True)
def stato_isolato(tmp_path, mocker):
    mocker.patch.object(actions, "STATE_DIR", tmp_path)
    mocker.patch.object(actions, "TOKEN_FILE", tmp_path / "token")
    mocker.patch.object(actions, "JOBS_DIR", tmp_path / "jobs")
    mocker.patch.object(actions, "REPORTS_DIR", tmp_path / "reports")
    return tmp_path


def test_il_token_e_stabile_e_privato(stato_isolato):
    a = actions.ensure_token()
    b = actions.ensure_token()
    assert a == b and len(a) >= 24
    assert oct((stato_isolato / "token").stat().st_mode)[-3:] == "600"


def test_solo_i_daemon_sorvegliati_sono_riavviabili():
    # La mappa nasce dalla stessa SCOPE dei check: non si puo' riavviare
    # qualcosa che la dashboard non sta guardando.
    assert "launchd_watchdog" in actions.RESTARTABLE
    assert actions.RESTARTABLE["launchd_watchdog"] == "com.agentic-markets.watchdog"
    assert "cron_settle" not in actions.RESTARTABLE
    assert "db_latency" not in actions.RESTARTABLE


def test_riavvio_di_un_check_non_riavviabile_e_rifiutato():
    esito = actions.restart_daemon("cron_settle")
    assert esito["ok"] is False
    assert "riavviabili" in esito["errore"]


def test_riavvio_invoca_launchctl_kickstart(mocker):
    finto = mocker.patch.object(actions.subprocess, "run")
    finto.return_value = mocker.Mock(returncode=0, stderr="")
    esito = actions.restart_daemon("launchd_watchdog")
    assert esito["ok"] is True
    argv = finto.call_args[0][0]
    assert argv[:3] == ["launchctl", "kickstart", "-k"]
    assert argv[3].endswith("com.agentic-markets.watchdog")


def test_la_diagnosi_accoda_un_job_e_non_ripara_niente(stato_isolato):
    esito = actions.request_diagnosis(
        "cron_settle",
        {"level": "red", "headline": "66 pick in attesa", "source": "db:cron_settle",
         "measured_at": "2026-08-20T18:00:00Z", "evidence": {"arretrato": 66}},
    )
    assert esito["ok"] is True
    files = list((stato_isolato / "jobs").glob("*.json"))
    assert len(files) == 1
    d = json.loads(files[0].read_text())
    assert d["stato"] == "in_coda"
    assert d["check"]["evidence"] == {"arretrato": 66}


def test_lo_stato_dei_job_e_leggibile(stato_isolato):
    actions.request_diagnosis("cron_settle", {"level": "red", "headline": "x"})
    stato = actions.jobs_stato()
    assert stato["cron_settle"]["stato"] == "in_coda"


def test_il_report_non_e_raggiungibile_con_un_percorso_arbitrario(stato_isolato):
    (stato_isolato / "reports").mkdir()
    (stato_isolato / "reports" / "buono.md").write_text("diagnosi")
    assert actions.leggi_report("buono") == "diagnosi"
    for cattivo in ("../token", "/etc/passwd", "..%2Ftoken", "a/b"):
        assert actions.leggi_report(cattivo) is None


def test_un_reporter_non_e_riavviabile():
    # kickstart rieseguirebbe il reporter, che ritroverebbe gli stessi problemi
    # e riuscirebbe con lo stesso codice: un tasto che per costruzione non puo'
    # funzionare e' peggio di nessun tasto.
    assert "launchd_daemon-health" not in actions.RESTARTABLE
    assert "launchd_watchdog" in actions.RESTARTABLE
