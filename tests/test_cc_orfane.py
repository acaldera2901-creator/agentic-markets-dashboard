"""#CERTIFICATORE-0201 — «Pick mostrate senza esito»: rosso solo OLTRE la finestra di
recupero (7 giorni + 1 di margine); dentro la finestra e' lavoro in corso (ambra)."""
from tools.control_center.checks import results


def _con(monkeypatch, riga):
    monkeypatch.setattr(results, "fetch_all", lambda sql: [riga])


def test_nessuna_orfana_e_verde(monkeypatch):
    _con(monkeypatch, (0, None, 0, 0, 0))
    assert results.check_history_orfane().level == "green"


def test_orfane_dentro_la_finestra_sono_ambra_non_rosso(monkeypatch):
    _con(monkeypatch, (84, "2026-09-26", 84, 0, 0))
    v = results.check_history_orfane()
    assert v.level == "amber"
    assert v.evidence["oltre_finestra"] == 0


def test_orfane_oltre_la_finestra_sono_rosse(monkeypatch):
    _con(monkeypatch, (90, "2026-09-20", 90, 0, 6))
    v = results.check_history_orfane()
    assert v.level == "red"
    assert v.evidence["oltre_finestra"] == 6
