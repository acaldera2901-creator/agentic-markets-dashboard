"""#SETTLE-TIMBRO-0911 — il ciclo normale di settlement tennis deve TIMBRARE.

Il difetto che questi test coprono non produceva errori: la riga veniva chiusa
correttamente nel database, con il risultato giusto, e poi spariva dal track
record. `settle_unified_tennis` marca `verification_state='verified'` SOLO se
riceve `verification_source` — il suo docstring lo dichiara obbligatorio per
ogni esito reale — e `/api/v2/history` pubblica SOLO le righe verificate.

Misurato l'11/09 prima del fix: `Coco Gauff vs Elena Rybakina` (lost, con pick)
e `Aryna Sabalenka vs Jessica Pegula` (won, con pick) erano chiuse, corrette e
INVISIBILI. La riconciliazione-ponte timbrava, il ciclo normale no: si vedeva
la toppa e non il vestito.

Il test guarda COSA VIENE PASSATO alla funzione di settlement, non il risultato
finale: un test sull'esito sarebbe passato anche col bug, perche' l'esito era
gia' giusto.
"""
from __future__ import annotations

import pytest

from agents.tennis_settlement import TennisSettlementAgent


class _PredFinta:
    def __init__(self, mid="m1", p1="Alice", p2="Bob"):
        self.id = 1
        self.match_id = mid
        self.player1 = p1
        self.player2 = p2
        self.surface = "hard"


class _EloFinto:
    def update(self, *a, **k):
        pass

    async def save_to_db_async(self, *a, **k):
        pass


@pytest.fixture
def agente(monkeypatch):
    a = TennisSettlementAgent.__new__(TennisSettlementAgent)
    a._elo = _EloFinto()

    class _Log:
        def info(self, *x, **k):
            pass

        def warning(self, *x, **k):
            pass

    a.logger = _Log()

    async def _niente(*x, **k):
        return None

    a._update_prediction = _niente
    a._settle_bets = _niente
    return a


def _cattura(monkeypatch):
    """Registra gli argomenti con cui viene chiamato il settlement."""
    chiamate: list[dict] = []

    async def finto(match_id, winner, **kw):
        chiamate.append({"match_id": match_id, "winner": winner, **kw})
        return True

    monkeypatch.setattr("agents.tennis_settlement.settle_unified_tennis", finto)
    return chiamate


@pytest.mark.asyncio
async def test_una_riga_risolta_da_espn_porta_il_timbro_espn(agente, monkeypatch):
    chiamate = _cattura(monkeypatch)
    await agente._chiudi([(_PredFinta(), "P1", "6-4 6-3", "espn")])
    assert len(chiamate) == 1
    assert chiamate[0]["verification_source"] == "espn"
    assert chiamate[0]["final_score"] == "6-4 6-3"


@pytest.mark.asyncio
async def test_una_riga_risolta_da_matchbook_porta_il_timbro_matchbook(agente, monkeypatch):
    # Matchbook non manda il punteggio: la tupla ha comunque quattro posizioni,
    # cosi' la fonte non finisce mai dove il chiamante legge il punteggio.
    chiamate = _cattura(monkeypatch)
    await agente._chiudi([(_PredFinta(), "P2", None, "matchbook")])
    assert chiamate[0]["verification_source"] == "matchbook"
    assert chiamate[0]["final_score"] is None
    # e il vincitore e' il secondo giocatore, non il primo
    assert chiamate[0]["winner"] == "Bob"


@pytest.mark.asyncio
async def test_senza_fonte_NON_si_timbra(agente, monkeypatch):
    # Meglio un buco dichiarato che una riga marcata «verificata» senza sapere
    # da dove viene: la prima si vede e si ripara, la seconda e' una bugia.
    chiamate = _cattura(monkeypatch)
    await agente._chiudi([(_PredFinta(), "P1", None)])
    assert chiamate[0]["verification_source"] is None
    assert chiamate[0]["verification_note"] is None


@pytest.mark.asyncio
async def test_il_timbro_arriva_per_OGNI_riga_chiusa(agente, monkeypatch):
    # Il bug colpiva il ciclo normale, cioe' quello che chiude la maggior parte
    # delle righe: una sola riga timbrata non basta a dire che funziona.
    chiamate = _cattura(monkeypatch)
    await agente._chiudi([
        (_PredFinta("m1"), "P1", "6-0 6-0", "espn"),
        (_PredFinta("m2"), "P2", None, "matchbook"),
        (_PredFinta("m3"), "P1", "7-5 6-4", "espn"),
    ])
    assert len(chiamate) == 3
    assert [c["verification_source"] for c in chiamate] == ["espn", "matchbook", "espn"]
