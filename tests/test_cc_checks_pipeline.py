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
