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


def test_latenza_db_soglie(mocker):
    tempi = iter([0.0, 0.2])
    mocker.patch.object(platform.time, "monotonic", side_effect=lambda: next(tempi))
    mocker.patch.object(platform, "fetch_all", return_value=[(1,)])
    assert platform.check_db_latency().level == "green"

    tempi = iter([0.0, 1.5])
    mocker.patch.object(platform.time, "monotonic", side_effect=lambda: next(tempi))
    assert platform.check_db_latency().level == "amber"

    tempi = iter([0.0, 4.0])
    mocker.patch.object(platform.time, "monotonic", side_effect=lambda: next(tempi))
    assert platform.check_db_latency().level == "red"


def test_db_giu_e_unknown(mocker):
    mocker.patch.object(platform, "fetch_all", side_effect=DbUnavailable("timeout"))
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
