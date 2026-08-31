"""#LEDGER-MIRROR-0831 — una riga chiusa per abbandono deve entrare ANCHE nel
registro sigillato.

Il difetto. `_unified_settlement_cycle` ha due uscite: quella con un punteggio
vero, che scriveva la riga servita E il mirror in `pick_settlement`, e quella
per abbandono, che scriveva solo la riga servita. Il secondo ramo lasciava il
pick sigillato senza chiusura.

Misurato su produzione il 31/08: 88 pick sigillati con la partita iniziata da
piu' di sei ore e nessuna riga di chiusura, dal 27/06 al 29/08. Di quelli, 17
avevano `result='void'` sulla riga servita — questo ramo — e la firma dei
microsecondi (6 cifre, cioe' il lato Python) li attribuisce qui: 4 a luglio e
13 ad agosto.

Perche' conta. `pick_ledger` + `pick_settlement` sono la prova pubblica che
Telegram pubblica. Un pick sigillato senza chiusura non e' un pick neutro: e' un
buco, e un registro con buchi mente per omissione — nel verso comodo, perche'
una riga che non si chiude non entra nemmeno nelle statistiche di sconfitta.
"""
import logging
from datetime import datetime, timedelta, timezone

import pytest

import agents.result_settlement as rs


def _riga(ext="espn:401896770"):
    """Una riga servita, oltre il cutoff, senza punteggio."""
    return {
        "id": 4242,
        "external_event_id": ext,
        "sport": "football",
        "league": "SUP",
        "competition": "Super League",
        "home_team": "Levadiakos",
        "away_team": "Panathinaikos",
        "market": "1X2",
        "pick": "home",
        "starts_at": (datetime.now(timezone.utc) - timedelta(hours=9)).isoformat(),
        "world_cup_stage": None,
        "source_id": "999",
    }


@pytest.fixture
def agente():
    # Come tests/test_bet_void_abandoned.py: si evita BaseAgent /
    # SelfLearningEngine alla costruzione.
    a = rs.ResultSettlementAgent.__new__(rs.ResultSettlementAgent)
    a.logger = logging.getLogger("test_void_mirror")
    a._scores_cache = {}
    a.set_status_detail = lambda _d: None
    return a


def _monta(monkeypatch, agente, *, righe, abbandonata, punteggio=None):
    """Monta il ciclo con un solo esito possibile e raccoglie le due scritture."""
    chiusure_servite: list[tuple] = []
    chiusure_registro: list[dict] = []

    async def fake_fetch_unsettled(cutoff_minutes=115, limit=50):
        return righe

    async def fake_selezioni(ids):
        return {}

    async def fake_settle_unified(row_id, outcome, final_score=None):
        chiusure_servite.append((row_id, outcome, final_score))
        return True

    async def fake_record(**kw):
        chiusure_registro.append(kw)
        return True

    async def fake_fetch_result(row):
        return punteggio

    async def fake_should_void(row):
        return abbandonata

    monkeypatch.setattr(rs, "fetch_unsettled_unified_predictions", fake_fetch_unsettled)
    monkeypatch.setattr(rs, "fetch_football_selections", fake_selezioni)
    monkeypatch.setattr(rs, "settle_unified_prediction", fake_settle_unified)
    monkeypatch.setattr(rs, "record_pick_settlement", fake_record)
    monkeypatch.setattr(agente, "_fetch_unified_result", fake_fetch_result)
    monkeypatch.setattr(agente, "_should_void_abandoned", fake_should_void)
    return chiusure_servite, chiusure_registro


@pytest.mark.asyncio
async def test_la_chiusura_per_abbandono_entra_nel_registro(agente, monkeypatch):
    """E' IL test: senza la fix qui il registro non riceve niente."""
    servite, registro = _monta(
        monkeypatch, agente, righe=[_riga()], abbandonata=True, punteggio=None
    )
    await agente._unified_settlement_cycle()

    assert servite == [("4242", "void", None)], "la riga servita va chiusa come void"
    assert len(registro) == 1, "il pick sigillato deve avere la sua riga di chiusura"


@pytest.mark.asyncio
async def test_la_chiave_del_registro_e_quella_della_FK(agente, monkeypatch):
    """La FK e' su (source_table, source_id, model_version): una chiave diversa
    verrebbe rifiutata con un 23503 che il chiamante scarta come atteso, cioe'
    il difetto si nasconderebbe da solo."""
    _, registro = _monta(
        monkeypatch, agente, righe=[_riga("espn:401896770")], abbandonata=True
    )
    await agente._unified_settlement_cycle()

    k = registro[0]
    assert k["source_table"] == "match_predictions"
    assert k["source_id"] == "espn:401896770", "la chiave e' external_event_id, non l'id interno"
    assert k["model_version"] == "football-v4-xg-model"


@pytest.mark.asyncio
async def test_non_inventa_punteggio_ne_quota_di_chiusura(agente, monkeypatch):
    """Una partita abbandonata non ha un punteggio. `outcome` e `final_score`
    restano None: un "0-0" inventato finirebbe sulla prova pubblica. E il
    closing_odds non si passa affatto — al 31/08 non esiste una chiusura
    agganciabile ai nostri pick (8 partite coperte in 30 giorni, zero
    sovrapposizione con pick_ledger)."""
    _, registro = _monta(monkeypatch, agente, righe=[_riga()], abbandonata=True)
    await agente._unified_settlement_cycle()

    k = registro[0]
    assert k["result"] == "void"
    assert k["outcome"] is None
    assert k["final_score"] is None
    assert k.get("closing_odds") is None


@pytest.mark.asyncio
async def test_senza_external_event_id_non_si_scrive_una_chiave_finta(agente, monkeypatch):
    """Senza la chiave non si puo' agganciare il pick sigillato. Meglio non
    scrivere che scrivere una riga che punta a niente: la FK la rifiuterebbe e
    l'errore verrebbe assorbito, lasciando l'impressione di aver chiuso."""
    servite, registro = _monta(
        monkeypatch, agente, righe=[_riga(ext=None)], abbandonata=True
    )
    await agente._unified_settlement_cycle()

    assert servite == [("4242", "void", None)], "la riga servita si chiude comunque"
    assert registro == []


@pytest.mark.asyncio
async def test_se_non_e_abbandonata_non_si_chiude_niente(agente, monkeypatch):
    """Controprova: il ramo si apre solo per una partita che ESPN dichiara
    abbandonata. Senza questo, il test sopra passerebbe anche con un ramo che
    chiude tutto quello che non ha punteggio."""
    servite, registro = _monta(
        monkeypatch, agente, righe=[_riga()], abbandonata=False, punteggio=None
    )
    await agente._unified_settlement_cycle()

    assert servite == []
    assert registro == []


@pytest.mark.asyncio
async def test_con_un_punteggio_vero_la_chiusura_porta_esito_e_punteggio(agente, monkeypatch):
    """L'altro ramo non deve regredire: quando il punteggio c'e', la riga di
    chiusura porta l'esito realizzato e il punteggio finale."""
    _, registro = _monta(
        monkeypatch,
        agente,
        righe=[_riga()],
        abbandonata=False,
        punteggio={"home_goals": 2, "away_goals": 1},
    )
    await agente._unified_settlement_cycle()

    k = registro[0]
    assert k["result"] == "won", "pick 'home' con 2-1 e' vinta"
    assert k["outcome"] == "HOME"
    assert k["final_score"] == "2-1"
