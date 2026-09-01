import pytest

from tools.control_center.checks import channels


class _R:
    def __init__(self, corpo):
        self._c = corpo

    def json(self):
        return self._c

    def raise_for_status(self):
        return None


def test_telegram_usa_il_canale_pubblico_non_la_chat_personale(mocker):
    # TELEGRAM_CHAT_ID e' la chat di Andrea: riporterebbe 1 iscritto, un numero
    # vero che risponde alla domanda sbagliata.
    mocker.patch.object(
        channels, "load_all_env",
        return_value={"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID": "42"},
    )
    v = channels.check_telegram()
    assert v.level == "unknown"
    assert "TELEGRAM_CHAT_ID_FREE" in v.headline


def test_telegram_legge_iscritti_e_titolo(mocker):
    mocker.patch.object(
        channels, "load_all_env",
        return_value={"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID_FREE": "-100"},
    )
    mocker.patch.object(
        channels.requests, "get",
        side_effect=[
            _R({"ok": True, "result": 4}),
            _R({"ok": True, "result": {"title": "BetRedge", "username": None}}),
        ],
    )
    v = channels.check_telegram()
    assert v.level == "info"
    assert v.value == 4
    assert "nessun username pubblico" in v.headline


def test_un_token_instagram_scaduto_non_e_un_token_mancante(mocker):
    # "Scaduto" e "mancante" portano ad azioni diverse: rigenerare contro
    # procurarsi. Il tile deve dire quale dei due.
    mocker.patch.object(
        channels, "load_all_env",
        return_value={"IG_ACCESS_TOKEN_EN": "vecchio", "IG_USER_ID_EN": "1"},
    )
    mocker.patch.object(
        channels.requests, "get",
        return_value=_R({"error": {"code": 190, "message": "Invalid OAuth access token"}}),
    )
    v = channels._instagram("EN", "@betr.edge")
    assert v.level == "unknown"
    assert "SCADUTO" in v.headline
    assert "non manca" in v.headline
    assert v.evidence["codice"] == 190


def test_instagram_senza_credenziali_dice_quali_mancano(mocker):
    mocker.patch.object(channels, "load_all_env", return_value={})
    v = channels._instagram("IT", "@betr.edge_ita")
    assert v.level == "unknown"
    assert "IG_ACCESS_TOKEN_IT" in v.headline
    assert "IG_USER_ID_IT" in v.headline


def test_instagram_funzionante_riporta_i_follower(mocker):
    mocker.patch.object(
        channels, "load_all_env",
        return_value={"IG_ACCESS_TOKEN_EN": "buono", "IG_USER_ID_EN": "1"},
    )
    mocker.patch.object(
        channels.requests, "get",
        return_value=_R({"username": "betr.edge", "followers_count": 312, "media_count": 48}),
    )
    v = channels._instagram("EN", "@betr.edge")
    assert v.level == "info"
    assert v.value == 312


def test_i_due_profili_instagram_sono_entrambi_sorvegliati():
    ids = [c.id for c in channels.checks()]
    assert "instagram_en" in ids
    assert "instagram_it" in ids
    assert len(set(ids)) == len(ids)


def test_tiktok_spiega_perche_non_c_e_api(mocker):
    mocker.patch.object(channels, "load_all_env", return_value={})
    v = channels.check_tiktok()
    assert v.level == "unknown"
    assert "Business" in v.headline


def test_reddit_chiede_oauth(mocker):
    mocker.patch.object(channels, "load_all_env", return_value={})
    v = channels.check_reddit()
    assert v.level == "unknown"
    assert "REDDIT_CLIENT_ID" in v.headline
