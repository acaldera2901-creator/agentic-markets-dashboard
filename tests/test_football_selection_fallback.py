"""
Il pronostico del calcio recuperato da `match_predictions.best_selection`.

`_unified_settlement_cycle` fa `if pick not in ("home","draw","away") -> void`.
Con `unified_predictions.pick` vuoto un esito VERO diventava un void: misurato
il 30/08, il void del calcio segue il senza-pick quasi riga per riga
(22/08: 24 righe, 14 void, 18 senza pick; 23/08: 30, 20, 21).
"""
import pytest
from core.supabase_client import _SELEZIONE_CALCIO


def test_la_mappa_copre_i_tre_esiti_1x2():
    assert _SELEZIONE_CALCIO == {"HOME": "home", "DRAW": "draw", "AWAY": "away"}


def test_i_valori_sono_quelli_che_il_settlement_accetta():
    """Se cambiassero, la riga tornerebbe in `void` in silenzio."""
    for v in _SELEZIONE_CALCIO.values():
        assert v in ("home", "draw", "away")


@pytest.mark.asyncio
async def test_senza_source_id_non_chiede_niente():
    from core.supabase_client import fetch_football_selections
    assert await fetch_football_selections([]) == {}


@pytest.mark.asyncio
async def test_source_id_vuoti_non_producono_richieste():
    from core.supabase_client import fetch_football_selections
    assert await fetch_football_selections(["", None]) == {}
