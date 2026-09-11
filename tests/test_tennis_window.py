"""#TENNIS-WINDOW-0911 — `days_ahead` deve essere USATO, non solo accettato.

Il difetto che questi test coprono e' subdolo perche' non produce un errore:
`get_upcoming_fixtures(days_ahead=7)` accettava il parametro, lo ignorava e
chiedeva solo `date=today`. Firma e chiamante dichiaravano sette giorni, il
corpo ne faceva uno, e nessun test se ne accorgeva — il risultato era una
finestra tennis di UN giorno contro i dieci del calcio (misurato l'11/09:
9 fixtures future, 1 sola oltre domani, board a 7 righe contro 198).

Il test centrale e' quindi sul NUMERO DI RICHIESTE e sulle DATE chieste, non
sul risultato: un test che guardasse solo le fixtures tornate sarebbe passato
anche col bug.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from core.tennis_api_client import TennisAPIClient


class _Risposta:
    def __init__(self, payload, status=200):
        self.status_code = status
        self._payload = payload
        self.text = ""

    def json(self):
        return self._payload


class _ClientFinto:
    """Registra le date chieste e restituisce una partita per giorno."""

    def __init__(self, per_giorno=None, status_per_giorno=None):
        self.date_chieste: list[str] = []
        self._per_giorno = per_giorno or {}
        self._status = status_per_giorno or {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, params=None, headers=None):
        giorno = (params or {}).get("date", "")
        self.date_chieste.append(giorno)
        status = self._status.get(giorno, 200)
        if status != 200:
            return _Risposta({}, status)
        return _Risposta({"response": self._per_giorno.get(giorno, [])})


def _partita(idx: str, quando: str):
    """Forma LETTA da `_parse_fixture`, non indovinata: la chiave e' `players`
    (non `teams`) e `round` e' un dizionario. Al primo tentativo avevo scritto
    `teams` e tre test fallivano restituendo zero fixtures — il parser scartava
    tutto in silenzio, che e' esattamente come si scrive un test che non prova
    niente."""
    return {
        "id": idx,
        "date": quando,
        "players": {
            "home": {"name": f"Giocatore {idx}", "ranking": 10, "points": 2000},
            "away": {"name": f"Avversario {idx}", "ranking": 20, "points": 1500},
        },
        "tournament": {"name": "Test Open", "surface": "Hardcourt outdoor"},
        "round": {"name": "R16"},
        "status": {"short": "NS"},
    }


@pytest.fixture
def client(monkeypatch):
    c = TennisAPIClient(rapidapi_key="chiave-di-test")
    return c


def _installa(monkeypatch, finto):
    monkeypatch.setattr(
        "core.tennis_api_client.httpx.AsyncClient", lambda *a, **k: finto
    )


@pytest.mark.asyncio
async def test_chiede_un_giorno_per_ogni_giorno_richiesto(client, monkeypatch):
    """IL test: 7 giorni = 7 richieste, non 1. Col bug ne partiva una sola."""
    finto = _ClientFinto()
    _installa(monkeypatch, finto)
    await client.get_upcoming_fixtures(days_ahead=7)
    assert len(finto.date_chieste) == 7, finto.date_chieste

    oggi = datetime.now(timezone.utc)
    attese = [(oggi + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    assert finto.date_chieste == attese


@pytest.mark.asyncio
async def test_il_giorno_corrente_e_sempre_il_primo(client, monkeypatch):
    """Se la quota finisce a meta', le partite di OGGI devono essere gia' salve."""
    finto = _ClientFinto()
    _installa(monkeypatch, finto)
    await client.get_upcoming_fixtures(days_ahead=5)
    assert finto.date_chieste[0] == datetime.now(timezone.utc).strftime("%Y-%m-%d")


@pytest.mark.asyncio
async def test_days_ahead_1_resta_una_sola_richiesta(client, monkeypatch):
    """Il chiamante deve poter spendere poco: e' cosi' che si regge la quota."""
    finto = _ClientFinto()
    _installa(monkeypatch, finto)
    await client.get_upcoming_fixtures(days_ahead=1)
    assert len(finto.date_chieste) == 1


@pytest.mark.asyncio
async def test_un_429_ferma_il_ciclo_e_tiene_quel_che_ha(client, monkeypatch):
    """Quota esaurita: ci si ferma, senza buttare via i giorni gia' raccolti."""
    oggi = datetime.now(timezone.utc)
    g0 = oggi.strftime("%Y-%m-%d")
    g1 = (oggi + timedelta(days=1)).strftime("%Y-%m-%d")
    finto = _ClientFinto(
        per_giorno={g0: [_partita("1", f"{g0}T10:00:00+00:00")]},
        status_per_giorno={g1: 429},
    )
    _installa(monkeypatch, finto)
    fixtures = await client.get_upcoming_fixtures(days_ahead=7)
    # si e' fermato al 429: niente richieste per i giorni successivi
    assert len(finto.date_chieste) == 2
    # ma cio' che aveva gia' raccolto resta
    assert len(fixtures) == 1


@pytest.mark.asyncio
async def test_un_giorno_rotto_non_annulla_gli_altri(client, monkeypatch):
    """Un 500 su un giorno non deve far perdere gli altri sei."""
    oggi = datetime.now(timezone.utc)
    g0 = oggi.strftime("%Y-%m-%d")
    g1 = (oggi + timedelta(days=1)).strftime("%Y-%m-%d")
    g2 = (oggi + timedelta(days=2)).strftime("%Y-%m-%d")
    finto = _ClientFinto(
        per_giorno={
            g0: [_partita("1", f"{g0}T10:00:00+00:00")],
            g2: [_partita("3", f"{g2}T10:00:00+00:00")],
        },
        status_per_giorno={g1: 500},
    )
    _installa(monkeypatch, finto)
    fixtures = await client.get_upcoming_fixtures(days_ahead=3)
    assert len(finto.date_chieste) == 3
    assert len(fixtures) == 2


@pytest.mark.asyncio
async def test_la_stessa_partita_su_due_giorni_non_si_duplica(client, monkeypatch):
    """Fusi orari e match a cavallo della mezzanotte UTC: una sola riga."""
    oggi = datetime.now(timezone.utc)
    g0 = oggi.strftime("%Y-%m-%d")
    g1 = (oggi + timedelta(days=1)).strftime("%Y-%m-%d")
    stessa = _partita("99", f"{g1}T00:30:00+00:00")
    finto = _ClientFinto(per_giorno={g0: [stessa], g1: [stessa]})
    _installa(monkeypatch, finto)
    fixtures = await client.get_upcoming_fixtures(days_ahead=2)
    assert len(fixtures) == 1


@pytest.mark.asyncio
async def test_senza_chiave_non_si_chiama_nessuno(monkeypatch):
    c = TennisAPIClient(rapidapi_key="")
    finto = _ClientFinto()
    _installa(monkeypatch, finto)
    assert await c.get_upcoming_fixtures(days_ahead=7) == []
    assert finto.date_chieste == []
