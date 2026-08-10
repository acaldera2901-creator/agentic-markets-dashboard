"""#TG-FREE-0810 — il canale FREE non deve poter rompere il canale PRO.

Il client Telegram aveva UNA destinazione e cinque call site che chiamano
`send(text)` senza argomenti. Questi test inchiodano le due proprieta' che
rendono l'aggiunta del tier free sicura:

  1. la firma vecchia continua a scrivere sul canale PRO (nessuna regressione
     sui cinque chiamanti esistenti);
  2. senza TELEGRAM_CHAT_ID_FREE un invio free e' un no-op, NON un invio
     accidentale sul canale a pagamento.

La (2) e' quella che conta davvero: un fallback silenzioso al PRO manderebbe i
contenuti free ai paganti, cioe' esattamente il contrario della scala premi.
"""

import asyncio

import pytest

from config.settings import settings
from core import telegram_client


class _FakeResponse:
    status_code = 200
    text = "ok"


class _FakeClient:
    """Registra i chat_id usati, senza toccare la rete."""

    calls: list[dict] = []

    def __init__(self, *_, **__):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def post(self, _url, json=None, **__):
        _FakeClient.calls.append(json or {})
        return _FakeResponse()


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    _FakeClient.calls = []
    monkeypatch.setattr(telegram_client.httpx, "AsyncClient", _FakeClient)
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "tok", raising=False)
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID", "-100PRO", raising=False)
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID_FREE", "", raising=False)
    yield


def test_firma_vecchia_scrive_sul_pro():
    """I cinque call site esistenti chiamano send(text): devono restare sul PRO."""
    assert asyncio.run(telegram_client.send("ciao")) is True
    assert _FakeClient.calls[0]["chat_id"] == "-100PRO"


def test_tier_pro_esplicito_scrive_sul_pro():
    assert asyncio.run(telegram_client.send("ciao", tier="pro")) is True
    assert _FakeClient.calls[0]["chat_id"] == "-100PRO"


def test_free_senza_canale_configurato_e_un_no_op(monkeypatch):
    """Il caso che protegge i paganti: nessun fallback silenzioso sul PRO."""
    assert asyncio.run(telegram_client.send("ciao", tier="free")) is False
    assert _FakeClient.calls == []  # nessuna richiesta partita


def test_free_con_canale_configurato_scrive_sul_free(monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID_FREE", "-100FREE", raising=False)
    assert asyncio.run(telegram_client.send("ciao", tier="free")) is True
    assert _FakeClient.calls[0]["chat_id"] == "-100FREE"


def test_i_due_canali_non_si_incrociano(monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID_FREE", "-100FREE", raising=False)
    asyncio.run(telegram_client.send("pro", tier="pro"))
    asyncio.run(telegram_client.send("free", tier="free"))
    destinazioni = [c["chat_id"] for c in _FakeClient.calls]
    assert destinazioni == ["-100PRO", "-100FREE"]


def test_senza_token_nessun_invio_su_nessun_tier(monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "", raising=False)
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID_FREE", "-100FREE", raising=False)
    assert asyncio.run(telegram_client.send("x", tier="pro")) is False
    assert asyncio.run(telegram_client.send("x", tier="free")) is False
    assert _FakeClient.calls == []


def test_tier_sconosciuto_cade_sul_pro_non_sul_free(monkeypatch):
    """Fail-closed sul lato costoso: un tier scritto male non deve regalare
    contenuti pro al canale free (l'errore opposto e' recuperabile)."""
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID_FREE", "-100FREE", raising=False)
    asyncio.run(telegram_client.send("x", tier="typo"))
    assert _FakeClient.calls[0]["chat_id"] == "-100PRO"
