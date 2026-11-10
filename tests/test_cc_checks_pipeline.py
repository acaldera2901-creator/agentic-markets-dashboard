import pytest

from tools.control_center.checks import pipeline
from tools.control_center.db import DbUnavailable


def _spec(via_pkey=False, red_after=3600):
    return pipeline.FreshSpec("f", "F", "tabella", "captured_at", red_after, via_pkey)


def test_freschezza_verde_e_rossa(mocker):
    mocker.patch.object(pipeline, "fetch_all", return_value=[(600,)])
    assert pipeline.check_freshness(_spec()).level == "green"
    mocker.patch.object(pipeline, "fetch_all", return_value=[(9000,)])
    v = pipeline.check_freshness(_spec())
    assert v.level == "red"
    assert "limite" in v.headline


def test_tabella_vuota_e_rossa(mocker):
    mocker.patch.object(pipeline, "fetch_all", return_value=[(None,)])
    assert pipeline.check_freshness(_spec()).level == "red"


def test_le_tabelle_enormi_usano_la_chiave_primaria_non_max(mocker):
    # max(captured_at) su odds_snapshots e' una scansione di 20,9 milioni di
    # righe: misurata 33,4s, ogni 5 minuti, su produzione. L'ultima riga per
    # chiave primaria da' la stessa risposta in 0,65s.
    finto = mocker.patch.object(pipeline, "fetch_all", return_value=[(60,)])
    pipeline.check_freshness(_spec(via_pkey=True))
    sql = finto.call_args[0][0]
    assert "order by id desc limit 1" in sql
    assert "max(" not in sql

    finto = mocker.patch.object(pipeline, "fetch_all", return_value=[(60,)])
    pipeline.check_freshness(_spec(via_pkey=False))
    assert "max(" in finto.call_args[0][0]


def test_odds_snapshots_e_configurata_via_pkey():
    per_id = {s.id: s for s in pipeline.FRESHNESS}
    assert per_id["odds_freshness"].via_pkey is True
    assert per_id["predictions_freshness"].via_pkey is False


def test_quota_soglie(mocker):
    mocker.patch.object(pipeline, "fetch_all", return_value=[(50, 100)])
    assert pipeline.check_quota("x").level == "green"
    mocker.patch.object(pipeline, "fetch_all", return_value=[(75, 100)])
    assert pipeline.check_quota("x").level == "amber"
    mocker.patch.object(pipeline, "fetch_all", return_value=[(95, 100)])
    assert pipeline.check_quota("x").level == "red"


def test_quota_senza_riga_o_senza_limite_e_unknown(mocker):
    mocker.patch.object(pipeline, "fetch_all", return_value=[])
    assert pipeline.check_quota("x").level == "unknown"
    mocker.patch.object(pipeline, "fetch_all", return_value=[(10, 0)])
    assert pipeline.check_quota("x").level == "unknown"


def test_il_contatore_di_residuo_non_viene_letto_come_consumo():
    # odds_api_remaining scrive il CREDITO RESIDUO nella colonna
    # requests_made: trattarlo come uso invertirebbe il significato del tile.
    assert "odds_api_remaining" in pipeline.QUOTA_ESCLUSI


def test_void_rate(mocker):
    mocker.patch.object(pipeline, "fetch_all", return_value=[(270, 254)])
    v = pipeline.check_void_rate()
    assert v.level == "red"
    assert "non si produce" in v.headline
    mocker.patch.object(pipeline, "fetch_all", return_value=[(100, 5)])
    assert pipeline.check_void_rate().level == "green"
    mocker.patch.object(pipeline, "fetch_all", return_value=[(0, 0)])
    assert pipeline.check_void_rate().level == "unknown"


def test_db_giu_e_unknown_su_tutti(mocker):
    mocker.patch.object(pipeline, "fetch_all", side_effect=DbUnavailable("giu'"))
    assert pipeline.check_freshness(_spec()).level == "unknown"
    assert pipeline.check_quota("x").level == "unknown"
    assert pipeline.check_void_rate().level == "unknown"


# #HISTORY-FRESHNESS-1026 — lo storico delle 26 leghe e' rimasto fermo al
# 21/09 per cinque settimane senza che nessuno se ne accorgesse: la PR
# settimanale si aggiornava ma non veniva mergiata, e il giro del 19/10 e'
# fallito. Il check misura il file che il prodotto serve davvero.
from datetime import date as _date

from tools.control_center.checks.pipeline import judge_history_snapshot


def _doc(generated_at, status="ok", failed=(), last=None):
    last = last or {"SB": "2026-10-18", "ELI": "2026-10-18"}
    return {
        "generated_at": generated_at,
        "refresh_status": status,
        "failed_leagues": list(failed),
        "leagues": {c: {"last_match_at": d} for c, d in last.items()},
    }


def test_storico_fresco_e_verde():
    v = judge_history_snapshot(_doc("2026-10-26"), _date(2026, 10, 26))
    assert v.level == "green"
    assert v.value == 0


def test_storico_di_una_settimana_saltata_e_ambra():
    v = judge_history_snapshot(_doc("2026-10-15"), _date(2026, 10, 26))
    assert v.level == "amber"
    assert v.value == 11


def test_storico_fermo_al_21_09_e_rosso():
    # Il caso vero del 26/10: 35 giorni.
    v = judge_history_snapshot(_doc("2026-09-21"), _date(2026, 10, 26))
    assert v.level == "red"
    assert v.value == 35
    assert "2026-09-21" in v.headline


def test_refresh_parziale_non_e_mai_verde():
    v = judge_history_snapshot(_doc("2026-10-26", status="partial", failed=["VEI"]), _date(2026, 10, 26))
    assert v.level == "amber"
    assert "VEI" in v.headline


def test_leghe_ferme_finiscono_nell_evidenza_senza_cambiare_il_livello():
    # Una lega ferma da settimane puo' essere fuori stagione: si mostra, non si
    # giudica (il giudizio sta sulla data dello snapshot).
    doc = _doc("2026-10-26", last={"SB": "2026-10-18", "CSL": "2026-09-12"})
    v = judge_history_snapshot(doc, _date(2026, 10, 26))
    assert v.level == "green"
    assert v.evidence["leghe_ferme"] == {"CSL": "2026-09-12"}


def test_data_illeggibile_e_unknown():
    v = judge_history_snapshot({"leagues": {}}, _date(2026, 10, 26))
    assert v.level == "unknown"
