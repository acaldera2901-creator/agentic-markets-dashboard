import pytest

from tools.control_center.checks import platform
from tools.control_center.db import DbUnavailable


class FakeResp:
    def __init__(self, code):
        self.status_code = code


def test_tutte_le_pagine_ok_e_verde(mocker):
    mocker.patch.object(platform.requests, "get", return_value=FakeResp(200))
    v = platform.check_web_pages()
    assert v.level == "green"
    assert v.source.startswith("http")


def test_una_pagina_rotta_e_rossa_e_dice_quale(mocker):
    def fake_get(url, **kw):
        return FakeResp(500 if url.endswith("/plans") else 200)

    mocker.patch.object(platform.requests, "get", side_effect=fake_get)
    v = platform.check_web_pages()
    assert v.level == "red"
    assert "/plans" in v.headline
    assert v.evidence["/plans"] == 500


def test_un_308_non_e_una_rottura(mocker):
    mocker.patch.object(platform.requests, "get", return_value=FakeResp(308))
    assert platform.check_web_pages().level == "green"


def test_le_rotte_dietro_feature_flag_non_sono_sorvegliate():
    # Regola #BRCC-0820: /risultati e /oggi fanno notFound() quando
    # NEXT_PUBLIC_UX_NEW != "1". Sorvegliarle significa nascere con un rosso
    # falso e permanente, cioe' insegnare a ignorare i rossi.
    assert "/risultati" not in platform.WATCHED_PAGES
    assert "/oggi" not in platform.WATCHED_PAGES
    assert platform.FLAG_GATED_PAGES["/risultati"] == "NEXT_PUBLIC_UX_NEW"


def test_rete_giu_e_unknown_non_red(mocker):
    mocker.patch.object(platform.requests, "get", side_effect=OSError("dns"))
    v = platform.check_web_pages()
    assert v.level == "unknown"
    assert "dns" in v.headline


def test_latenza_db_soglie_sulla_query_non_sulla_connessione(mocker):
    # Un handshake da 700 ms verso eu-west-1 e' normale e non dice niente
    # sulla salute del DB: con la soglia sulla somma il tile lampeggerebbe
    # per sempre. Misurato il 2026-08-20: query 65-132 ms, connessione ~650.
    mocker.patch.object(platform, "measure_latency", return_value=(0.7, 0.07))
    v = platform.check_db_latency()
    assert v.level == "green"
    assert v.evidence == {"query_ms": 70, "connessione_ms": 700}

    mocker.patch.object(platform, "measure_latency", return_value=(0.7, 0.9))
    assert platform.check_db_latency().level == "amber"

    mocker.patch.object(platform, "measure_latency", return_value=(0.7, 3.0))
    assert platform.check_db_latency().level == "red"


def test_db_giu_e_unknown(mocker):
    mocker.patch.object(platform, "measure_latency", side_effect=DbUnavailable("timeout"))
    v = platform.check_db_latency()
    assert v.level == "unknown"
    assert "timeout" in v.headline


def test_errori_24h(mocker):
    mocker.patch.object(platform, "fetch_all", return_value=[(0,)])
    assert platform.check_errors_24h().level == "green"
    mocker.patch.object(platform, "fetch_all", return_value=[(7,)])
    v = platform.check_errors_24h()
    assert v.level == "amber"
    assert v.value == 7


def test_il_registro_espone_id_stabili():
    ids = [c.id for c in platform.checks()]
    assert ids == ["web_pages", "api_version", "db_latency", "errors_24h"]
    assert all(c.group == "piattaforma" for c in platform.checks())
