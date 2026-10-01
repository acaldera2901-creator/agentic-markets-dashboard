"""#SETTLE-1001 a1 — l'archivio ESPN `?dates=` restituisce l'INTERO torneo
della settimana a ogni data (misurato l'01/10: 28, 29 e 30/09 restituiscono le
stesse competizioni, stessi id, data 22/09). Concatenando i giorni ogni partita
compariva N volte e il cancello B3 la scartava come «ambigua»: dal 13/09
~118-283 righe al giorno rifiutate, poi scadute in `unresolved`.

Il dedup si fa sull'id della COMPETIZIONE (la partita), non sull'evento (che e'
il torneo): due partite vere fra gli stessi giocatori hanno id diversi e devono
restare ambigue.
"""
from datetime import date, datetime, timezone

import pytest

import core.espn_tennis_client as espn
from agents.tennis_settlement import TennisSettlementAgent


def _comp(cid, p1="Alfa Uno", p2="Beta Due", when="2026-09-22T05:00Z"):
    def lato(nome, vince, ls):
        return {"athlete": {"displayName": nome}, "winner": vince,
                "linescores": [{"value": v} for v in ls]}
    return {"id": cid, "date": when,
            "status": {"type": {"completed": True, "name": "STATUS_FINAL"}},
            "competitors": [lato(p1, True, [6, 6]), lato(p2, False, [4, 3])]}


def _payload(comps):
    return {"events": [{"id": "441-2026", "name": "Hangzhou",
                        "groupings": [{"grouping": {"displayName": "Men's Singles"},
                                       "competitions": comps}]}]}


class _Resp:
    status_code = 200

    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


def _fake_client(payload_atp):
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, headers=None):
            # Ogni data restituisce lo stesso torneo, come l'archivio reale.
            return _Resp(payload_atp if "/atp/" in url else {"events": []})
    return _Client


@pytest.fixture(autouse=True)
def _cache_pulita(monkeypatch):
    monkeypatch.setattr(espn, "_archive_cache", {})


GIORNI = {date(2026, 9, 22), date(2026, 9, 23), date(2026, 9, 24)}


async def test_stessa_partita_su_tre_giorni_e_un_solo_candidato(monkeypatch):
    monkeypatch.setattr(espn.httpx, "AsyncClient", _fake_client(_payload([_comp("186127")])))
    out = await espn.get_completed_results_for_days(GIORNI)
    assert len(out) == 1
    assert out[0]["event_id"] == "186127"


class _Pred:
    id = 1
    match_id = "m1"
    player1 = "Alfa Uno"
    player2 = "Beta Due"
    tournament = "Hangzhou"
    scheduled_at = datetime(2026, 9, 22, 5, tzinfo=timezone.utc)


def _agente():
    a = TennisSettlementAgent.__new__(TennisSettlementAgent)

    class _Log:
        def info(self, *x, **k): pass
        def warning(self, *x, **k): pass
    a.logger = _Log()
    return a


async def test_la_partita_ripetuta_dall_archivio_si_risolve(monkeypatch):
    monkeypatch.setattr(espn.httpx, "AsyncClient", _fake_client(_payload([_comp("186127")])))
    monkeypatch.setattr("agents.tennis_settlement.get_completed_results_for_days",
                        espn.get_completed_results_for_days)
    resolved = await _agente()._resolve_via_espn([_Pred()])
    assert [(r[0].match_id, r[1]) for r in resolved] == [("m1", "P1")]


async def test_due_partite_vere_fra_gli_stessi_giocatori_restano_ambigue(monkeypatch):
    payload = _payload([_comp("186127", when="2026-09-22T05:00Z"),
                        _comp("186999", when="2026-09-22T20:00Z")])
    monkeypatch.setattr(espn.httpx, "AsyncClient", _fake_client(payload))
    monkeypatch.setattr("agents.tennis_settlement.get_completed_results_for_days",
                        espn.get_completed_results_for_days)
    assert await _agente()._resolve_via_espn([_Pred()]) == []
