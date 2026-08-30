"""
I due resolver del settlement tennis devono essere COMPLEMENTARI.

Prima erano incatenati con `if not resolved:`: bastava che Matchbook chiudesse
UNA riga perche' ESPN non venisse mai interrogato per tutte le altre. Impronta
digitale nel log del daemon: 67 cicli su 75 hanno chiuso esattamente 1 riga, e
il settlement del tennis e' passato dal 55-78% allo 0-7%.
"""
import asyncio
import pytest

from agents.tennis_settlement import TennisSettlementAgent


class FakePred:
    def __init__(self, pid):
        self.id = pid

    def __repr__(self):
        return f"P{self.id}"


def _agent(matchbook, espn):
    """Un'istanza nuda: niente __init__, niente DB, niente rete."""
    a = object.__new__(TennisSettlementAgent)
    chiamate = {"matchbook": None, "espn": None}

    async def _mb(pending):
        chiamate["matchbook"] = list(pending)
        return matchbook(pending)

    async def _espn(pending):
        chiamate["espn"] = list(pending)
        return espn(pending)

    a._resolve_via_matchbook = _mb
    a._resolve_via_espn = _espn
    return a, chiamate


def test_espn_viene_interrogato_sul_RESTO_anche_se_matchbook_ha_risolto():
    """Il difetto: una riga risolta da Matchbook spegneva ESPN per tutte le altre."""
    pending = [FakePred(1), FakePred(2), FakePred(3)]
    a, chiamate = _agent(
        matchbook=lambda p: [(p[0], "P1")],
        espn=lambda p: [(x, "P2") for x in p],
    )
    resolved = asyncio.run(a._resolve_all(pending))

    assert chiamate["espn"] is not None, "ESPN non e' stato chiamato: e' il bug"
    assert [x.id for x in chiamate["espn"]] == [2, 3], "ESPN deve ricevere solo il RESTO"
    assert len(resolved) == 3, "tutte e tre le righe devono risultare risolte"


def test_matchbook_riceve_tutto_il_pending():
    pending = [FakePred(1), FakePred(2)]
    a, chiamate = _agent(matchbook=lambda p: [], espn=lambda p: [])
    asyncio.run(a._resolve_all(pending))
    assert [x.id for x in chiamate["matchbook"]] == [1, 2]


def test_se_matchbook_risolve_tutto_espn_non_serve():
    """Nessuna chiamata di rete inutile: se non resta niente, ESPN non parte."""
    pending = [FakePred(1)]
    a, chiamate = _agent(matchbook=lambda p: [(p[0], "P1")], espn=lambda p: [])
    resolved = asyncio.run(a._resolve_all(pending))
    assert chiamate["espn"] is None
    assert len(resolved) == 1


def test_nessuna_fonte_risolve_nulla():
    pending = [FakePred(1), FakePred(2)]
    a, _ = _agent(matchbook=lambda p: [], espn=lambda p: [])
    assert asyncio.run(a._resolve_all(pending)) == []


def test_le_tuple_a_tre_elementi_col_punteggio_contano_come_risolte():
    """ESPN restituisce (pred, posizione, score): non deve sfuggire al dedup."""
    pending = [FakePred(1), FakePred(2)]
    resolte = [(pending[0], "P1", "6-4 6-3")]
    assert [x.id for x in TennisSettlementAgent._unresolved(pending, resolte)] == [2]


def test_unresolved_su_lista_vuota_restituisce_tutto():
    pending = [FakePred(1), FakePred(2)]
    assert TennisSettlementAgent._unresolved(pending, []) == pending
