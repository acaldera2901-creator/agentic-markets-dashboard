"""#SETTLE-1001 a2 — ogni pick tennis SIGILLATO riceve la sua riga di chiusura.

Fino al 30/09 `record_pick_settlement` era chiamato solo dal calcio: il
registro tennis (pick_ledger source_table='tennis_predictions', nato il 21/09)
non aveva MAI una riga in pick_settlement — 1907 pick in arretrato.

La chiusura si grada sul pick SIGILLATO (pick_ledger.pick), non su quello
mostrato a chiusura: il sigillo esiste proprio perche' il pick mostrato puo'
cambiare fino all'inizio (misurate 20 divergenze su 2137 il 01/10).
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core import supabase_client as sc


def _resp(rows, status=200):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = rows
    return r


def _client(ledger_rows, unified_rows):
    client = AsyncMock()

    async def get(url, params=None, headers=None):
        return _resp(ledger_rows if url.endswith("/pick_ledger") else unified_rows)
    client.get.side_effect = get
    return client


async def _run(ledger_rows, unified_rows, winner, **kw):
    record = AsyncMock(return_value=True)
    with patch.object(sc.httpx, "AsyncClient") as mk, \
         patch.object(sc, "record_pick_settlement", new=record), \
         patch.object(sc, "settle_unified_prediction", new=AsyncMock(return_value=True)), \
         patch.object(sc.settings, "SUPABASE_URL", "https://x.supabase.co"), \
         patch.object(sc.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"):
        mk.return_value.__aenter__.return_value = _client(ledger_rows, unified_rows)
        await sc.settle_unified_tennis("tennis:espn:e1:k", winner, **kw)
    return record


SEALED = [{"model_version": "partner-market-v1", "pick": "Anna Kalinskaya"}]


async def test_vinto_rispetto_al_pick_sigillato_anche_se_quello_mostrato_e_cambiato():
    rec = await _run(SEALED, [{"id": "r1", "pick": "Petra Kvitova"}], "Anna Kalinskaya",
                     final_score="6-4 6-3")
    rec.assert_awaited_once_with(
        source_table="tennis_predictions", source_id="tennis:espn:e1:k",
        model_version="partner-market-v1", result="won",
        outcome="Anna Kalinskaya", final_score="6-4 6-3",
    )


async def test_perso():
    rec = await _run(SEALED, [{"id": "r1", "pick": "Anna Kalinskaya"}], "Petra Kvitova")
    assert rec.await_args.kwargs["result"] == "lost"


async def test_scaduta_a_7_giorni_e_unresolved_stato_terminale():
    rec = await _run(SEALED, [{"id": "r1", "pick": "Anna Kalinskaya"}], None, unresolved=True)
    kw = rec.await_args.kwargs
    assert (kw["result"], kw["outcome"], kw["final_score"]) == ("unresolved", None, None)


async def test_la_chiusura_sigillata_non_dipende_dalla_riga_servita():
    # La riga servita gia' chiusa altrove (es. backstop TS): il registro va
    # chiuso lo stesso, o il pick resta orfano per sempre.
    rec = await _run(SEALED, [], "Anna Kalinskaya")
    assert rec.await_args.kwargs["result"] == "won"


async def test_pick_non_sigillato_nessuna_scrittura():
    rec = await _run([], [{"id": "r1", "pick": "Anna Kalinskaya"}], "Anna Kalinskaya")
    rec.assert_not_awaited()


async def test_un_errore_del_registro_non_blocca_la_riga_servita():
    settle = AsyncMock(return_value=True)
    client = AsyncMock()

    async def get(url, params=None, headers=None):
        if url.endswith("/pick_ledger"):
            raise RuntimeError("boom")
        return _resp([{"id": "r1", "pick": "Anna Kalinskaya"}])
    client.get.side_effect = get
    with patch.object(sc.httpx, "AsyncClient") as mk, \
         patch.object(sc, "settle_unified_prediction", new=settle), \
         patch.object(sc.settings, "SUPABASE_URL", "https://x.supabase.co"), \
         patch.object(sc.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"):
        mk.return_value.__aenter__.return_value = client
        assert await sc.settle_unified_tennis("tennis:espn:e1:k", "Anna Kalinskaya") is True
    settle.assert_awaited_once()


async def test_una_scrittura_sigillata_fallita_e_un_warning_col_match_id(caplog):
    # Visibile subito nel log, non solo 8 giorni dopo dall'invariante.
    record = AsyncMock(return_value=False)
    with patch.object(sc.httpx, "AsyncClient") as mk, \
         patch.object(sc, "record_pick_settlement", new=record), \
         patch.object(sc, "settle_unified_prediction", new=AsyncMock(return_value=True)), \
         patch.object(sc.settings, "SUPABASE_URL", "https://x.supabase.co"), \
         patch.object(sc.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"), \
         caplog.at_level("WARNING", logger=sc.logger.name):
        mk.return_value.__aenter__.return_value = _client(SEALED, [])
        await sc.settle_unified_tennis("tennis:espn:e1:k", "Anna Kalinskaya")
    assert any("tennis:espn:e1:k" in r.getMessage() and r.levelname == "WARNING"
               for r in caplog.records)
