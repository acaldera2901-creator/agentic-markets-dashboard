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


# ── accendi / spegni (#BR-JARVIS-0901) ────────────────────────────────────────
# Stessa whitelist di riavvia, di proposito: un perimetro solo. Spegnere un
# bridge del Council non si nota subito, quindi quei label restano fuori.


def test_accendi_e_spegni_rifiutano_cio_che_non_e_sorvegliato():
    for fn in (actions.start_daemon, actions.stop_daemon):
        esito = fn("db_latency")
        assert esito["ok"] is False
        assert "governabili" in esito["errore"]


def test_spegni_usa_bootout_sul_target(mocker):
    finto = mocker.Mock(returncode=0, stderr="")
    corsa = mocker.patch.object(actions.subprocess, "run", return_value=finto)

    esito = actions.stop_daemon("launchd_watchdog")

    assert esito["ok"] is True
    argv = corsa.call_args[0][0]
    assert argv[:2] == ["launchctl", "bootout"]
    assert argv[2].endswith("/com.agentic-markets.watchdog")


def test_accendi_usa_bootstrap_col_percorso_del_plist(mocker, tmp_path):
    # bootstrap vuole il FILE, non il target: e' la differenza che rompe tutto
    # se si copia la forma di bootout.
    mocker.patch.object(actions, "LAUNCH_AGENTS", tmp_path)
    (tmp_path / "com.agentic-markets.watchdog.plist").write_text("<plist/>")
    finto = mocker.Mock(returncode=0, stderr="")
    corsa = mocker.patch.object(actions.subprocess, "run", return_value=finto)

    esito = actions.start_daemon("launchd_watchdog")

    assert esito["ok"] is True
    argv = corsa.call_args[0][0]
    assert argv[:2] == ["launchctl", "bootstrap"]
    assert argv[-1].endswith("com.agentic-markets.watchdog.plist")


def test_accendi_lo_dice_se_il_plist_non_esiste_piu(mocker, tmp_path):
    # Meglio una frase leggibile che un errore criptico di launchctl.
    mocker.patch.object(actions, "LAUNCH_AGENTS", tmp_path)
    corsa = mocker.patch.object(actions.subprocess, "run")

    esito = actions.start_daemon("launchd_watchdog")

    assert esito["ok"] is False
    assert "plist non trovato" in esito["errore"]
    corsa.assert_not_called()


def test_un_launchctl_che_fallisce_non_viene_dichiarato_riuscito(mocker):
    finto = mocker.Mock(returncode=3, stderr="Boot-out failed: 5: Input/output error")
    mocker.patch.object(actions.subprocess, "run", return_value=finto)

    esito = actions.stop_daemon("launchd_watchdog")

    assert esito["ok"] is False
    assert esito["returncode"] == 3
    assert "Boot-out failed" in esito["stderr"]


# ── aprire un'ala in un terminale (#BR-APRI-0901) ────────────────────────────
# La pagina manda solo una CHIAVE. Se dal browser potesse arrivare un comando,
# un token rubato diventerebbe esecuzione arbitraria sul Mac.


def _tsv(tmp_path, righe):
    f = tmp_path / "ali.tsv"
    f.write_text("# commento\n\n" + "\n".join(righe) + "\n", encoding="utf-8")
    return f


def test_le_ali_si_leggono_dal_tsv(mocker, tmp_path):
    mocker.patch.object(actions, "ALI_TSV", _tsv(tmp_path, [
        "dev\tbr-dev\tprogrammatore-andrea\tsi\t-\t-\tIl codice",
        "monitor\tbr-monitor\t-\tno\tsonnet\tlow\tGuarda e avvisa",
    ]))
    a = {x["chiave"]: x for x in actions.ali_disponibili()}
    assert set(a) == {"dev", "monitor"}
    assert a["dev"]["worktree"] is True and a["dev"]["agente"] == "programmatore-andrea"
    assert a["monitor"]["worktree"] is False and a["monitor"]["agente"] is None
    assert a["monitor"]["modello"] == "sonnet"


def test_senza_il_tsv_nessuna_ala(mocker, tmp_path):
    # Meglio zero pulsanti che un pulsante che promette e non mantiene.
    mocker.patch.object(actions, "ALI_TSV", tmp_path / "manca.tsv")
    assert actions.ali_disponibili() == []


def test_apri_rifiuta_una_chiave_non_dichiarata(mocker, tmp_path):
    mocker.patch.object(actions, "ALI_TSV", _tsv(tmp_path, ["dev\tbr-dev\t-\tno\t-\t-\tx"]))
    corsa = mocker.patch.object(actions.subprocess, "run")
    esito = actions.apri_ala("marketing")
    assert esito["ok"] is False and "ali.tsv" in esito["errore"]
    corsa.assert_not_called()


def test_apri_rifiuta_cio_che_non_e_una_chiave(mocker, tmp_path):
    # Il filtro viene PRIMA della whitelist: niente virgolette, niente spazi,
    # niente che possa spezzare l'AppleScript.
    mocker.patch.object(actions, "ALI_TSV", _tsv(tmp_path, ["dev\tbr-dev\t-\tno\t-\t-\tx"]))
    corsa = mocker.patch.object(actions.subprocess, "run")
    for cattiva in ['dev"; rm -rf /', "dev e poi altro", "../../etc", "DEV", ""]:
        esito = actions.apri_ala(cattiva)
        assert esito["ok"] is False, cattiva
    corsa.assert_not_called()


def test_apri_lancia_osascript_con_la_chiave_giusta(mocker, tmp_path):
    mocker.patch.object(actions, "ALI_TSV", _tsv(tmp_path, ["mkt\tbr-mkt\t-\tno\t-\t-\tx"]))
    finto = mocker.Mock(returncode=0, stderr="")
    corsa = mocker.patch.object(actions.subprocess, "run", return_value=finto)

    esito = actions.apri_ala("mkt")

    assert esito["ok"] is True
    argv = corsa.call_args[0][0]
    assert argv[0] == "osascript"
    assert 'do script "lab mkt"' in " ".join(argv)
    assert "activate" in " ".join(argv)
