"""
La riconciliazione del ponte (#SETTLE-0909).

IL DIFETTO. Misurate il 10/09: 27 pick pubblicate e MOSTRATE con `result` NULL,
partite fra l'11/06 e il 24/08. Non vinte, non perse, non void, non
`unresolved`: invisibili in entrambe le direzioni — fuori dal track record e
non contate nemmeno come buchi.

Come ci sono arrivate: `_bulk_expire_stale` le aveva marcate `expired` a monte e
la chiamata al ponte non era passata. Quel metodo gira UNA VOLTA per processo e
i fallimenti li conta e li dimentica; da lì nessuno le riguarda piu', perche' lui
seleziona `outcome IS NULL` e il backstop TS pretende `winner NOT NULL`.

Nessun test poteva vederlo: ogni pezzo era corretto da solo. Questi lo vedono.
"""
import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from agents import tennis_settlement as ts
from agents.tennis_settlement import TennisSettlementAgent


class _SessioneFinta:
    """Restituisce le TennisPrediction locali per i match_id chiesti."""

    def __init__(self, righe):
        self._righe = righe

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def execute(self, _q):
        righe = self._righe

        class R:
            def scalars(self_inner):
                class S:
                    def all(self_s):
                        return righe
                return S()
        return R()


def _agente():
    a = TennisSettlementAgent.__new__(TennisSettlementAgent)
    a.logger = logging.getLogger("test")
    a._reconcile_cursor = None
    return a


def _pred(match_id, outcome=None, winner=None):
    return SimpleNamespace(match_id=match_id, outcome=outcome, winner=winner)


async def _gira(aperte, righe_locali):
    """Esegue la riconciliazione e ritorna le chiamate fatte al ponte."""
    chiamate = []

    async def ponte(match_id, winner, **kw):
        chiamate.append({"match_id": match_id, "winner": winner, **kw})
        return True

    with patch.object(ts, "unified_tennis_ancora_aperte",
                      new=AsyncMock(return_value=(aperte, None))), \
         patch.object(ts, "AsyncSessionLocal", lambda: _SessioneFinta(righe_locali)), \
         patch.object(ts, "settle_unified_tennis", new=ponte):
        await _agente()._riconcilia_ponte()
    return chiamate


class TestIlPonteSiRipara:
    @pytest.mark.asyncio
    async def test_una_riga_pubblica_aperta_con_esito_a_monte_viene_chiusa(self):
        """Il caso delle 27: a monte l'esito c'e', la riga pubblica e' rimasta aperta."""
        chiamate = await _gira(
            ["m1"], [_pred("m1", outcome="P1_WIN", winner="Jannik Sinner")]
        )
        assert len(chiamate) == 1
        assert chiamate[0]["match_id"] == "m1"
        assert chiamate[0]["winner"] == "Jannik Sinner"

    @pytest.mark.asyncio
    async def test_un_expired_senza_vincitore_si_DICHIARA_invece_di_sparire(self):
        """
        Lo stato esatto delle 27: `outcome='expired'`, `winner` NULL. Prima
        restavano invisibili; ora diventano un buco dichiarato.
        """
        chiamate = await _gira(["m2"], [_pred("m2", outcome="expired", winner=None)])
        assert len(chiamate) == 1
        assert chiamate[0]["winner"] is None
        assert chiamate[0]["unresolved"] is True

    @pytest.mark.asyncio
    async def test_una_riga_non_ancora_chiusa_a_monte_si_LASCIA_al_ciclo_normale(self):
        """La riconciliazione non ruba il lavoro al settlement: non indovina."""
        assert await _gira(["m3"], [_pred("m3", outcome=None)]) == []

    @pytest.mark.asyncio
    async def test_una_riga_pubblica_senza_riga_a_monte_non_si_inventa(self):
        assert await _gira(["m4"], []) == []

    @pytest.mark.asyncio
    async def test_nessuna_riga_aperta_nessuna_chiamata(self):
        assert await _gira([], [_pred("m5", outcome="P1_WIN", winner="X")]) == []

    @pytest.mark.asyncio
    async def test_la_traccia_dice_che_e_una_riconciliazione_non_un_settlement(self):
        """
        Serve a distinguere, in `settlement_audit` e nella nota, una chiusura
        tardiva da una tempestiva: sono due fatti diversi sulla stessa riga.
        """
        chiamate = await _gira(["m6"], [_pred("m6", outcome="P2_WIN", winner="Y")])
        assert chiamate[0]["verification_note"] == "riconciliazione-ponte"


class TestGiraOgniCiclo:
    @pytest.mark.asyncio
    async def test_la_riconciliazione_e_nel_ciclo_non_una_volta_per_processo(self):
        """
        La regola che conta: un rimedio a un ponte FALLITO che parte una volta
        sola eredita lo stesso difetto che deve curare. Due cicli, due passate.
        """
        a = _agente()
        passate = []

        async def finta():
            passate.append(1)

        expiry = AsyncMock()
        with patch.object(a, "_bulk_expire_stale", new=expiry), \
             patch.object(a, "_settle_recent", new=AsyncMock()), \
             patch.object(a, "_riconcilia_ponte", new=finta):
            await a._settlement_cycle()
            await a._settlement_cycle()

        assert len(passate) == 2, "la riconciliazione deve girare a OGNI ciclo"
        assert expiry.await_count == 2, "anche lo scaduto deve essere raccolto a ogni ciclo"


@pytest.mark.asyncio
async def test_missing_sources_do_not_prevent_cursor_progress_and_errors_retry():
    a = _agente()
    pages = AsyncMock(side_effect=[(["missing"], "cursor1"), None, ([], None)])
    with patch.object(ts, "unified_tennis_ancora_aperte", pages), \
         patch.object(ts, "AsyncSessionLocal", lambda: _SessioneFinta([])):
        await a._riconcilia_ponte()
        assert a._reconcile_cursor == "cursor1"
        await a._riconcilia_ponte()
        assert a._reconcile_cursor == "cursor1"
        await a._riconcilia_ponte()
        assert a._reconcile_cursor is None
    assert [call.kwargs["after_id"] for call in pages.await_args_list] == [None, "cursor1", "cursor1"]


@pytest.mark.asyncio
async def test_one_failed_bridge_does_not_starve_other_rows(caplog):
    a = _agente()
    bridge = AsyncMock(side_effect=[RuntimeError("temporary failure"), True])
    with patch.object(ts, "unified_tennis_ancora_aperte", AsyncMock(return_value=(["bad", "good"], "cursor1"))), \
         patch.object(ts, "AsyncSessionLocal", lambda: _SessioneFinta([
             _pred("bad", outcome="expired"), _pred("good", outcome="expired")
         ])), patch.object(ts, "settle_unified_tennis", bridge):
        await a._riconcilia_ponte()
    assert bridge.await_count == 2
    assert a._reconcile_cursor == "cursor1"
    assert "bad" in caplog.text and "temporary failure" in caplog.text


@pytest.mark.asyncio
async def test_upstream_read_failure_keeps_page_for_retry(caplog):
    a = _agente()
    a._reconcile_cursor = "cursor1"
    with patch.object(ts, "unified_tennis_ancora_aperte", AsyncMock(return_value=(["bad"], "cursor2"))), \
         patch.object(ts, "AsyncSessionLocal", side_effect=RuntimeError("DB down")):
        await a._riconcilia_ponte()
    assert a._reconcile_cursor == "cursor1"
    assert "DB down" in caplog.text
