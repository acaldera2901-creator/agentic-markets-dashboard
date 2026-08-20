import pytest

from tools.control_center.checks import daemons
from tools.control_center.db import DbUnavailable

OUTPUT = """PID\tStatus\tLabel
-\t0\tcom.agentic-markets.live-monitor
73946\t-15\tcom.agentic-markets.agents
-\t1\tcom.agentic-markets.weeklypick-morning
-\t126\tio.maven.softmarkets.collect
"""


def test_parse_estrae_pid_e_stato():
    tabella = daemons.parse_launchctl(OUTPUT)
    assert tabella["com.agentic-markets.agents"]["pid"] == 73946
    assert tabella["com.agentic-markets.agents"]["status"] == -15
    assert tabella["com.agentic-markets.live-monitor"]["pid"] is None
    assert tabella["io.maven.softmarkets.collect"]["status"] == 126
    assert "Label" not in tabella


def test_exit_zero_senza_pid_e_verde(mocker):
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(OUTPUT))
    v = daemons.check_launchd("com.agentic-markets.live-monitor")
    assert v.level == "green"


def test_processo_vivo_e_verde(mocker):
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(OUTPUT))
    v = daemons.check_launchd("com.agentic-markets.agents")
    assert v.level == "green"
    assert "73946" in str(v.evidence)


def test_exit_diverso_da_zero_e_rosso(mocker):
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(OUTPUT))
    v = daemons.check_launchd("io.maven.softmarkets.collect")
    assert v.level == "red"
    assert "126" in v.headline
    # Il numero grosso del tile: "126" da solo si legge come un conteggio,
    # "exit 126" dice cosa e'.
    assert v.value == "exit 126"


def test_label_non_caricata_e_rossa(mocker):
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(OUTPUT))
    v = daemons.check_launchd("com.betredge.non-esiste")
    assert v.level == "red"
    assert "non caricato" in v.headline


def test_launchctl_non_disponibile_e_unknown(mocker):
    mocker.patch.object(daemons, "_launchctl_table", side_effect=OSError("no launchctl"))
    assert daemons.check_launchd("qualsiasi").level == "unknown"


def _fresh(hard=True):
    return daemons.CronSpec("cron_x", "X", "match_predictions", "computed_at", 1800, hard)


def test_cron_verde_se_l_artefatto_e_recente(mocker):
    mocker.patch.object(daemons, "fetch_all", return_value=[(600,)])
    assert daemons.check_cron(_fresh()).level == "green"


def test_cron_incondizionato_rosso_oltre_il_doppio_dell_intervallo(mocker):
    # Un cron che scrive a ogni run: il silenzio e' un guasto, anche se
    # Vercel risponde 200. Un processo puo' uscire con codice zero e non
    # produrre niente.
    mocker.patch.object(daemons, "fetch_all", return_value=[(43440,)])
    v = daemons.check_cron(_fresh(hard=True))
    assert v.level == "red"
    assert "12h" in v.headline


def test_cron_condizionale_e_ambra_non_rosso(mocker):
    # Un cron che scrive solo quando c'e' lavoro: il silenzio e' ambiguo.
    # Chiamarlo rosso genera falsi allarmi e insegna a ignorarli.
    mocker.patch.object(daemons, "fetch_all", return_value=[(43440,)])
    v = daemons.check_cron(_fresh(hard=False))
    assert v.level == "amber"
    assert "o non c'era nulla da fare" in v.headline


def test_cron_su_tabella_vuota_e_rosso_non_unknown(mocker):
    # None significa "nessuna riga": il cron non ha mai prodotto nulla.
    # E' un'assenza di artefatto, quindi rosso, non "non misurato".
    mocker.patch.object(daemons, "fetch_all", return_value=[(None,)])
    v = daemons.check_cron(_fresh())
    assert v.level == "red"
    assert "mai" in v.headline


def test_cron_con_db_giu_e_unknown(mocker):
    mocker.patch.object(daemons, "fetch_all", side_effect=DbUnavailable("timeout"))
    assert daemons.check_cron(_fresh()).level == "unknown"


def _backlog():
    return daemons.BacklogSpec("cron_y", "Y", "select 1", "ordini", "pagati e non abilitati")


def test_arretrato_zero_e_verde_anche_dopo_settimane_di_silenzio(mocker):
    # Il falso rosso misurato il 2026-08-20: paygate-reconcile sembrava fermo
    # da 22 giorni perche' nessuno comprava, mentre il suo arretrato era zero.
    # Nessun ordine da smaltire non e' un guasto: e' un fatto di business.
    mocker.patch.object(daemons, "fetch_all", return_value=[(0,)])
    v = daemons.check_backlog(_backlog())
    assert v.level == "green"
    assert v.value == 0


def test_arretrato_maggiore_di_zero_e_rosso(mocker):
    mocker.patch.object(daemons, "fetch_all", return_value=[(66,)])
    v = daemons.check_backlog(_backlog())
    assert v.level == "red"
    assert "66 ordini" in v.headline
    assert v.value == 66


def test_arretrato_con_db_giu_e_unknown(mocker):
    mocker.patch.object(daemons, "fetch_all", side_effect=DbUnavailable("timeout"))
    assert daemons.check_backlog(_backlog()).level == "unknown"


def test_i_cron_condizionali_usano_l_arretrato_non_la_freschezza():
    fresh_ids = {s.id for s in daemons.CRONS}
    backlog_ids = {s.id for s in daemons.BACKLOGS}
    assert "cron_settle" in backlog_ids
    assert "cron_paygate" in backlog_ids
    assert not fresh_ids & backlog_ids


def test_lo_scope_esclude_i_progetti_non_betredge():
    testo = " ".join(daemons.SCOPE)
    assert "lumio" not in testo
    assert "maketelier" not in testo
    assert "mia-valentina" not in testo
    assert any("agentic-markets" in label for label in daemons.SCOPE)


def test_il_registro_copre_scope_e_cron():
    ids = [c.id for c in daemons.checks()]
    assert len(ids) == len(daemons.SCOPE) + len(daemons.CRONS) + len(daemons.BACKLOGS)
    assert len(set(ids)) == len(ids)
    assert "cron_settle" in ids


def test_sigterm_143_non_e_un_guasto(mocker):
    # launchctl riporta SIGTERM come -15 o come 143 (128+15) a seconda di come
    # il processo e' finito. Confrontare solo con -15 faceva leggere
    # telegram-watch (status 143) come rosso.
    out = "PID\tStatus\tLabel\n56729\t143\tcom.esempio.tal\n"
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(out))
    assert daemons.check_launchd("com.esempio.tal").level == "green"
    assert 143 in daemons.USCITE_ORDINATE


def test_un_reporter_punta_al_messaggio_non_al_messaggero(mocker, tmp_path):
    # daemon-health esce 1 PER PROGETTO: significa "almeno un check e' rosso".
    # Leggerlo come un guasto del processo e' un falso rosso che nasconde i
    # problemi veri invece di mostrarli.
    report = tmp_path / "last-report.txt"
    report.write_text(
        "# daemon-health\n"
        "✅ learning-loop     ok\n"
        "❌ ig-refresh-news   news-of-day.json · 3g fa\n"
        "❌ ig-build-queue    build-queue.out.log · 3g fa\n"
    )
    mocker.patch.dict(daemons.REPORTER, {"com.tal.reporter": report}, clear=False)
    out = "PID\tStatus\tLabel\n-\t1\tcom.tal.reporter\n"
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(out))
    v = daemons.check_launchd("com.tal.reporter")
    assert v.level == "red"
    assert v.value == 2
    assert "ig-refresh-news" in v.headline
    assert "exit 1" not in v.headline
    assert len(v.evidence["problemi"]) == 2


def test_un_reporter_senza_report_leggibile_e_unknown(mocker, tmp_path):
    mocker.patch.dict(
        daemons.REPORTER, {"com.tal.reporter": tmp_path / "manca.txt"}, clear=False
    )
    out = "PID\tStatus\tLabel\n-\t1\tcom.tal.reporter\n"
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(out))
    assert daemons.check_launchd("com.tal.reporter").level == "unknown"


def test_un_rosso_porta_la_coda_del_log_di_errore(mocker, tmp_path):
    # Senza questo, evidence conteneva solo {pid, status}: per capire un exit 1
    # bisognava andare a caccia del log a mano.
    log = tmp_path / "tal.err.log"
    log.write_text("riga vecchia\nModuleNotFoundError: no module named x\n")
    mocker.patch.object(daemons, "_coda_log_errori", return_value=log.read_text().strip())
    out = "PID\tStatus\tLabel\n-\t1\tcom.tal.normale\n"
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(out))
    v = daemons.check_launchd("com.tal.normale")
    assert v.level == "red"
    assert "ModuleNotFoundError" in v.evidence["err_log"]
