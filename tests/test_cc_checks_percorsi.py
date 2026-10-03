"""Percorsi utente: i verdetti si calcolano su osservazioni finte, mai sulla rete."""

import sys

import pytest

from tools.control_center.checks import percorsi


def _pagina(path, scroll=390, client=390, status=200, title="BetRedge"):
    return {"status": status, "title": title, "scroll_w": scroll, "client_w": client,
            "bloccata": percorsi._bloccata(status, title)}


def _lettura(why="Congo DR are a strong pick at 76% because of the expected goals."):
    return {"variant": "settled", "model": "76", "pick": True, "why": why}


def _bloccata():
    return {"variant": "premiumLocked", "model": "57", "pick": False, "why": ""}


def _form(**diff):
    f = {"modal": True, "create": True, "checkbox": 3, "checked": 0,
         "terms_link": True, "submit_disabled": True}
    f.update(diff)
    return f


def oss_sana():
    """L'osservazione del 03/10, ridotta: tutto verde."""
    return {
        "pagine": {p: _pagina(p) for p in percorsi.MOBILE_PAGES},
        "errori": {},
        "api": {"calcio": 198, "tennis": 80, "letture": 2,
                "history": {"n": 5261, "won": 3311, "win_rate": "62.9%"}},
        "board": [_bloccata() for _ in range(32)] + [_lettura(), _lettura()],
        "gate": True,
        "signup": _form(),
        "piani": [{"nome": "BetRedge Free", "prezzo": "$0"},
                  {"nome": "BetRedge Base", "prezzo": "$14.99/month"},
                  {"nome": "BetRedge Pro", "prezzo": "$29.99/month"}],
        "piani_cta": _form(),
        "history": {"kpi": ["5261", "82.8%", "62.9%"], "won": "3311"},
    }


@pytest.fixture(autouse=True)
def cache_vuota():
    percorsi._CACHE.clear()
    yield
    percorsi._CACHE.clear()


@pytest.fixture
def osservazione(mocker):
    oss = oss_sana()
    mocker.patch.object(percorsi, "_giro", return_value=oss)
    return oss


def test_giro_sano_tutto_verde(osservazione):
    for chk in percorsi.checks():
        v = chk.fn()
        assert v.level == "green", (chk.id, v.headline)
        assert v.source.startswith("browser:")


def test_un_solo_browser_per_i_sei_check(mocker):
    giro = mocker.patch.object(percorsi, "_giro", return_value=oss_sana())
    for chk in percorsi.checks():
        chk.fn()
    assert giro.call_count == 1


def test_senza_playwright_tutto_unknown_mai_verde(mocker):
    # Il venv senza playwright: «non misurato» e' un '?', non un verde finto.
    mocker.patch.dict(sys.modules, {"playwright.sync_api": None})
    for chk in percorsi.checks():
        v = chk.fn()
        assert v.level == "unknown", chk.id
        assert "playwright" in v.headline


def test_checkpoint_vercel_e_unknown_non_red(osservazione):
    osservazione["pagine"]["/"] = _pagina("/", status=429, title="Vercel Security Checkpoint")
    for fn in (percorsi.check_percorso_board, percorsi.check_percorso_signup,
               percorsi.check_percorso_scheda_partita):
        v = fn()
        assert v.level == "unknown"
        assert "Checkpoint" in v.headline


def test_passo_rotto_e_unknown_col_motivo(osservazione):
    osservazione["errori"]["storico"] = "TimeoutError: .am-statbar"
    v = percorsi.check_percorso_track_record()
    assert v.level == "unknown"
    assert "am-statbar" in v.headline


# ── board ──
def test_board_vuota_con_api_piene_e_rossa(osservazione):
    osservazione["board"] = []
    v = percorsi.check_percorso_board()
    assert v.level == "red"
    assert "278" in v.headline


def test_board_semivuota_e_ambra(osservazione):
    osservazione["board"] = [_bloccata() for _ in range(percorsi.BOARD_MIN - 1)]
    assert percorsi.check_percorso_board().level == "amber"


def test_board_vuota_con_api_vuote_e_unknown(osservazione):
    osservazione["board"] = []
    osservazione["api"].update(calcio=0, tennis=0)
    assert percorsi.check_percorso_board().level == "unknown"


def test_card_senza_probabilita_non_conta(osservazione):
    osservazione["board"] = [{"variant": "premiumLocked", "model": "", "pick": False, "why": ""}] * 10
    assert percorsi.check_percorso_board().level == "red"


# ── scheda / lettura ──
def test_lettura_senza_perche_e_rossa(osservazione):
    osservazione["board"][-1] = _lettura(why="Why.")
    v = percorsi.check_percorso_scheda_partita()
    assert v.level == "red"
    assert v.value == "1/2"


def test_letture_in_api_ma_non_in_pagina_e_rosso(osservazione):
    osservazione["board"] = [_bloccata() for _ in range(10)]
    assert percorsi.check_percorso_scheda_partita().level == "red"


def test_nessuna_lettura_pubblica_e_unknown(osservazione):
    osservazione["board"] = [_bloccata() for _ in range(10)]
    osservazione["api"]["letture"] = 0
    assert percorsi.check_percorso_scheda_partita().level == "unknown"


def test_gate_rotto_non_nasconde_le_letture_ma_finisce_nella_prova(osservazione):
    osservazione["errori"]["gate"] = "TimeoutError: .auth-modal"
    osservazione.pop("gate")
    v = percorsi.check_percorso_scheda_partita()
    assert v.level == "green"
    assert "gate" not in v.headline
    assert "auth-modal" in v.evidence["gate_su_card_bloccata"]
    # ...mentre il signup, che dipende dal gate, non e' misurato.
    assert percorsi.check_percorso_signup().level == "unknown"


# ── piani ──
def test_piano_mancante_e_rosso(osservazione):
    osservazione["piani"] = osservazione["piani"][:2]
    v = percorsi.check_percorso_piani()
    assert v.level == "red"
    assert "Pro" in v.headline


def test_il_nome_del_piano_e_l_h4_non_l_eyebrow(osservazione):
    # 03/10: l'eyebrow del Pro e' «Everything»; il nome vero sta nell'h4.
    osservazione["piani"][2] = {"nome": "Everything", "prezzo": "$29.99/month"}
    assert percorsi.check_percorso_piani().level == "red"


def test_cta_morta_e_rossa(osservazione):
    osservazione["piani_cta"] = {}
    assert percorsi.check_percorso_piani().level == "red"


def test_piani_dichiara_che_il_checkout_non_e_misurato(osservazione):
    v = percorsi.check_percorso_piani()
    assert "non misurato" in v.headline
    assert "checkout" in v.evidence["non_misura"]


# ── signup ──
@pytest.mark.parametrize("difetto,atteso", [
    ({"checkbox": 1}, "caselle di consenso"),
    ({"checked": 2}, "gia' spuntate"),
    ({"terms_link": False}, "Terms"),
    ({"submit_disabled": False}, "invio non bloccato"),
])
def test_gate_signup_incompleto_e_rosso(osservazione, difetto, atteso):
    osservazione["signup"] = _form(**difetto)
    v = percorsi.check_percorso_signup()
    assert v.level == "red"
    assert atteso in v.headline


def test_signup_che_non_si_apre_e_rosso(osservazione):
    osservazione["signup"] = {"modal": False}
    assert percorsi.check_percorso_signup().level == "red"


# ── track record ──
def test_track_record_diverso_dall_api_e_rosso(osservazione):
    osservazione["history"]["won"] = "3310"
    v = percorsi.check_percorso_track_record()
    assert v.level == "red"
    assert "won" in v.value


def test_track_record_virgola_decimale_e_uguale(osservazione):
    osservazione["history"]["kpi"][2] = "62,9 %"
    osservazione["history"]["kpi"][0] = "5.261"
    assert percorsi.check_percorso_track_record().level == "green"


def test_track_record_senza_risposta_api_e_unknown(osservazione):
    osservazione["api"].pop("history")
    assert percorsi.check_percorso_track_record().level == "unknown"


# ── mobile ──
def test_overflow_orizzontale_e_rosso_e_dice_dove(osservazione):
    osservazione["pagine"]["/plans"] = _pagina("/plans", scroll=412)
    v = percorsi.check_percorso_mobile()
    assert v.level == "red"
    assert "/plans" in v.headline
    assert v.value == "3/4"


def test_un_pixel_di_scarto_non_e_overflow(osservazione):
    osservazione["pagine"]["/"] = _pagina("/", scroll=391)
    assert percorsi.check_percorso_mobile().level == "green"


def test_pagina_non_misurata_rende_ambra_non_verde(osservazione):
    osservazione["pagine"].pop("/history")
    assert percorsi.check_percorso_mobile().level == "amber"


def test_il_registro_espone_id_stabili_e_ttl():
    chk = percorsi.checks()
    assert [c.id for c in chk] == [
        "percorso_board", "percorso_scheda_partita", "percorso_piani",
        "percorso_signup", "percorso_track_record", "percorso_mobile",
    ]
    assert all(c.group == "percorsi" for c in chk)
    # Un browser ogni 5 minuti farebbe scattare il Vercel Security Checkpoint.
    assert all(c.ttl_seconds >= 3600 for c in chk)


def test_registrati_nella_torre():
    # Dal sorgente e non chiamando all_checks(): pipeline.checks() interroga il
    # DB per costruire la lista, e questi test non toccano rete ne' database.
    import inspect

    from tools.control_center import checks as registro
    assert "*percorsi.checks()" in inspect.getsource(registro.all_checks)
