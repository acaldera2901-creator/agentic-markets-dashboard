import pytest

from tools.control_center.checks import email
from tools.control_center.db import DbUnavailable


def test_gli_invii_del_crm_vengono_dal_database(mocker):
    # Il motore degli invii e' il CRM in codice, non l'automation di Resend
    # (disabilitata dal 27/07): crm_trigger_sends e' il registro di cio' che
    # e' partito davvero.
    mocker.patch.object(
        email, "fetch_all",
        side_effect=[[(3, 22, 28, 8)], [("acq_day2_tested", 5), ("onb_activate", 1)]],
    )
    v = email.check_invii_crm()
    assert v.level == "info"
    assert v.value == 3
    assert "28 in tutto verso 8 indirizzi" in v.headline
    assert v.evidence["per_trigger_30g"]["acq_day2_tested"] == 5


def test_i_trigger_a_zero_invii_sono_ambra(mocker):
    # Un trigger che non manda niente significa che un pezzo del ciclo di vita
    # non raggiunge nessuno: onb_activate ha mandato UNA mail in tutto.
    mocker.patch.object(
        email, "fetch_all",
        return_value=[("onb_activate", 1, None), ("acq_day2", 5, None)],
    )
    v = email.check_copertura_trigger()
    assert v.level == "amber"
    assert "onb_activate (1)" in v.headline


def test_tutti_i_trigger_attivi_e_verde(mocker):
    mocker.patch.object(email, "fetch_all", return_value=[("a", 5, None), ("b", 9, None)])
    assert email.check_copertura_trigger().level == "green"


def test_nessun_invio_mai_e_rosso(mocker):
    mocker.patch.object(email, "fetch_all", return_value=[])
    assert email.check_copertura_trigger().level == "red"


def test_senza_chiave_resend_il_tile_dice_dove_metterla(mocker):
    # Vercel marca RESEND_API_KEY sensitive e non la restituisce: verificato,
    # 28 valori su 106 nel pull. Il tile deve dire cosa fare, non "errore".
    mocker.patch.object(email, "load_all_env", return_value={})
    v = email.check_resend_domini()
    assert v.level == "unknown"
    assert "credentials.env" in v.headline
    v2 = email.check_resend_consegne()
    assert v2.level == "unknown"
    assert "ARRIVATE" in v2.headline


def test_una_chiave_vuota_conta_come_assente(mocker):
    mocker.patch.object(email, "load_all_env", return_value={"RESEND_API_KEY": "   "})
    assert email.check_resend_domini().level == "unknown"


class _Resp:
    def __init__(self, code, corpo):
        self.status_code = code
        self._corpo = corpo

    def json(self):
        return self._corpo


def test_un_dominio_non_verificato_e_rosso(mocker):
    mocker.patch.object(email, "load_all_env", return_value={"RESEND_API_KEY": "re_x"})
    mocker.patch.object(
        email.requests, "get",
        return_value=_Resp(200, {"data": [
            {"name": "betredge.com", "status": "verified"},
            {"name": "news.betredge.com", "status": "pending"},
        ]}),
    )
    v = email.check_resend_domini()
    assert v.level == "red"
    assert "news.betredge.com" in v.headline
    assert v.value == "1/2"


def test_domini_tutti_verificati_e_verde(mocker):
    mocker.patch.object(email, "load_all_env", return_value={"RESEND_API_KEY": "re_x"})
    mocker.patch.object(
        email.requests, "get",
        return_value=_Resp(200, {"data": [{"name": "betredge.com", "status": "verified"}]}),
    )
    assert email.check_resend_domini().level == "green"


def test_una_chiave_rifiutata_e_unknown_non_red(mocker):
    mocker.patch.object(email, "load_all_env", return_value={"RESEND_API_KEY": "re_x"})
    mocker.patch.object(
        email.requests, "get",
        return_value=_Resp(400, {"message": "API key is invalid"}),
    )
    v = email.check_resend_domini()
    assert v.level == "unknown"
    assert "invalid" in v.headline


def test_i_bounce_sono_ambra(mocker):
    mocker.patch.object(email, "load_all_env", return_value={"RESEND_API_KEY": "re_x"})
    mocker.patch.object(
        email.requests, "get",
        return_value=_Resp(200, {"data": [
            {"last_event": "delivered"}, {"last_event": "bounced"}, {"last_event": "delivered"},
        ]}),
    )
    v = email.check_resend_consegne()
    assert v.level == "amber"
    assert v.value == 1
    assert v.evidence["delivered"] == 2


def test_db_giu_e_unknown(mocker):
    mocker.patch.object(email, "fetch_all", side_effect=DbUnavailable("giu'"))
    assert email.check_invii_crm().level == "unknown"
    assert email.check_copertura_trigger().level == "unknown"
