import pytest

from tools.control_center.checks import business, results
from tools.control_center.db import DbUnavailable


# ── risultati ────────────────────────────────────────────────────────────────

def test_il_roi_non_si_mostra_sotto_il_campione_minimo(mocker):
    # Misurato il 2026-08-20: su 3 pick chiusi il ROI grezzo era -100%, su 16
    # era -53%. Numeri veri e privi di significato: rumore con l'aria di una
    # misura.
    mocker.patch.object(results, "fetch_all", return_value=[(3, 0, -3.0)])
    v = results.check_roi_7g()
    assert v.level == "info"
    assert "campione insufficiente" in v.headline
    assert v.value == "n=3"
    assert "%" not in str(v.value)


def test_il_roi_si_mostra_sopra_il_campione_minimo(mocker):
    mocker.patch.object(results, "fetch_all", return_value=[(91, 31, -6.31)])
    v = results.check_roi_totale()
    assert v.level == "info"
    assert v.value == "-6.9%"
    assert v.evidence["hit_rate_pct"] == 34.1
    assert v.evidence["pick_chiusi"] == 91


def test_la_query_del_track_record_usa_i_valori_veri_di_result():
    # result vale 'won'/'lost'/'void'/'unresolved', NON 'win': una query
    # scritta su 'win' restituisce zero vittorie e un ROI di -100%.
    sql = results._TRACK_SQL
    assert "'won'" in sql
    assert "in ('won', 'lost')" in sql
    assert "'win'" not in sql
    # void e unresolved non entrano nel calcolo
    assert "is_backfill = false" in sql
    assert "closing_odds_is_fuzzy" in sql


def test_il_bankroll_vuoto_e_unknown_non_zero(mocker):
    mocker.patch.object(results, "fetch_all", return_value=[(0, None)])
    v = results.check_bankroll()
    assert v.level == "unknown"
    assert "vuota" in v.headline


def test_risultati_con_db_giu_sono_unknown(mocker):
    mocker.patch.object(results, "fetch_all", side_effect=DbUnavailable("giu'"))
    assert results.check_roi_totale().level == "unknown"
    assert results.check_picks_oggi().level == "unknown"


# ── business ─────────────────────────────────────────────────────────────────

def test_abbonati_separa_paganti_e_free(mocker):
    mocker.patch.object(
        business, "fetch_all",
        return_value=[("free", 10), ("premium", 8), ("base", 1), ("admin_full", 1)],
    )
    v = business.check_abbonati()
    assert v.value == 9
    assert "9 paganti, 10 free" in v.headline


def test_le_iscrizioni_portano_il_confronto_col_periodo_precedente(mocker):
    mocker.patch.object(business, "fetch_all", return_value=[(0, 3)])
    v = business.check_iscrizioni()
    assert "-3 sui 7 precedenti" in v.headline


def test_il_traffico_dice_se_il_tracking_non_registra(mocker):
    # site_visits ha UNA riga in tutto, del 14 giugno: dire "0 visite" farebbe
    # credere che il tracking funzioni e che nessuno sia passato.
    mocker.patch.object(business, "fetch_all", side_effect=[[(800, 600)], [(0, 1)]])
    v = business.check_traffico()
    assert "tracking visite non attivo" in v.headline
    assert "non registra" in v.evidence["site_visits"]

    mocker.patch.object(business, "fetch_all", side_effect=[[(800, 600)], [(120, 4000)]])
    v = business.check_traffico()
    assert "120 visite" in v.headline


def test_l_incassato_dichiara_cosa_resta_fuori_dalla_somma(mocker):
    mocker.patch.object(business, "fetch_all", side_effect=[[(3, 24.99)], [(0, 0)], [(0,)]])
    v = business.check_incassato()
    assert v.value == "$24.99"
    assert "non registrano un importo" in v.evidence["fuori_somma"]

# I check dei canali hanno un file dedicato: tests/test_cc_checks_channels.py
# (sono stati riscritti quando le credenziali sono state trovate nei progetti
# accelerator/studio-instagram e accelerator/studio).
