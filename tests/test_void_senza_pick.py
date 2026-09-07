"""#VOID-SENZA-PICK-0907 — una riga senza pick si chiude `void`, non won/lost.

## Come ci eravamo sbagliati

Il 30/08 abbiamo aggiunto due fallback al settlement — uno per il calcio
(`match_predictions.best_selection`), uno per il tennis
(`tennis_predictions.best_selection`) — convinti che un `pick` vuoto fosse un
esito vero buttato nel cestino. Il ragionamento sembrava solido: la sorgente ha
la selezione, la riga no, quindi la riga ha perso qualcosa.

Non aveva perso niente. `lib/unified-adapter.ts` scrive:

    pick: favBelowFloor ? null : row.best_selection,

`pick = NULL` e' il **floor che fa il suo lavoro**: il modello non ha un
favorito abbastanza netto e il prodotto pubblica la riga SENZA pronostico. Il
commento sopra quella riga lo dice: la riga «NON porta pick direzionale, cosi'
`wasShownAsPick` non conta pick mai mostrate».

Misurato il 07/09 sulle chiusure del 06/09 — righe senza pick, confidenza
mediana 49 (40-61); righe con pick, mediana 82 (56-95). Le quattro che avevamo
citato come «sconfitte scomparse»:

    Juventus-Milan 43 · Brommapojkarna-Elfsborg 44 · Everton-United 47 ·
    Eintracht-Augsburg 50

Su tutte il prodotto ha mostrato «nessun favorito netto». Recuperare
`best_selection` a partita finita e graduarle won/lost significa mettere nel
registro pubblico scelte che non abbiamo mai fatto vedere — e, dato che quella
sorgente e' riscritta in upsert dopo il fischio d'inizio, scelte che nel
frattempo si sono spostate verso il vincitore noto.

## Il criterio

Nessuna riga puo' avere `result in (won,lost)` con `pick` NULL. Regge per
costruzione: se non c'e' una scelta mostrata, non c'e' niente che possa vincere
o perdere. `void` non e' un terzo esito della partita — e' l'assenza di
scommessa, la semantica gia' documentata in `lib/tennis-settlement.ts`.

Il tasso pubblicato non si muove: `/api/v2/history` filtra gia' `pick not null`,
quindi queste righe non erano contate prima e non lo sono adesso. Cambia solo
che la colonna `result` smette di contraddire la colonna `pick`.
"""
import inspect
import logging
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

import agents.result_settlement as rs
import core.supabase_client as sc
from config.settings import settings


def _riga(id_, pick, casa, ospite, conf=None):
    return {
        "id": id_,
        "external_event_id": f"espn:{id_}",
        "source_id": f"espn:{id_}",
        "source_table": "match_predictions",
        "sport": "football",
        "league": "SA",
        "competition": "Serie A",
        "home_team": casa,
        "away_team": ospite,
        "market": "1X2",
        "pick": pick,
        "confidence_score": conf,
        "starts_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
        "world_cup_stage": None,
    }


# La giornata del 06/09 in miniatura, coi numeri veri: una riga sopra il floor
# che porta il suo pick, e tre sotto il floor pubblicate senza pronostico.
GIORNATA = [
    _riga(1, "home", "Napoli", "Cagliari", conf=82),
    _riga(2, None, "Juventus FC", "AC Milan", conf=43),
    _riga(3, "", "Everton FC", "Manchester United FC", conf=47),
    _riga(4, None, "Eintracht Frankfurt", "FC Augsburg", conf=50),
]
PUNTEGGI = {1: (3, 0), 2: (1, 1), 3: (2, 2), 4: (1, 4)}


@pytest.fixture
def agente():
    a = rs.ResultSettlementAgent.__new__(rs.ResultSettlementAgent)
    a.logger = logging.getLogger("test_void_senza_pick")
    a._scores_cache = {}
    a.set_status_detail = lambda _d: None
    return a


def _monta(monkeypatch, agente, righe=None):
    """Raccoglie lo stato finale di ogni riga: (esito, pick mostrato)."""
    righe = GIORNATA if righe is None else righe
    finale: dict[str, dict] = {}

    async def fake_fetch(cutoff_minutes=115, limit=50):
        return righe

    async def fake_settle(row_id, outcome, final_score=None):
        originale = next(
            (r["pick"] for r in righe if str(r["id"]) == str(row_id)), None
        )
        finale[str(row_id)] = {"result": outcome, "pick": (originale or "").strip()}
        return True

    async def fake_record(**kw):
        return True

    async def fake_result(row):
        casa, ospite = PUNTEGGI[row["id"]]
        return {"home_goals": casa, "away_goals": ospite}

    async def fake_void(row):
        return False

    async def fake_selezioni(ids):
        # La sorgente RISPONDE. E' il punto: il fallback fallirebbe questi test
        # solo se la sorgente e' raggiungibile, e in produzione lo e' — quindi
        # va simulata, altrimenti il test passa per un artefatto d'ambiente.
        return {str(r["source_id"]): "home" for r in righe}

    monkeypatch.setattr(rs, "fetch_unsettled_unified_predictions", fake_fetch)
    monkeypatch.setattr(rs, "fetch_football_selections", fake_selezioni, raising=False)
    monkeypatch.setattr(rs, "settle_unified_prediction", fake_settle)
    monkeypatch.setattr(rs, "record_pick_settlement", fake_record)
    monkeypatch.setattr(agente, "_fetch_unified_result", fake_result)
    monkeypatch.setattr(agente, "_should_void_abandoned", fake_void)
    return finale


# ─── IL criterio ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_criterio_nessun_esito_deciso_senza_una_scelta_mostrata(agente, monkeypatch):
    """    count(pick not null AND result in (won,lost)) == count(result in (won,lost))

    Con il fallback valeva 1 contro 4: tre righe sotto il floor entravano nello
    storico come sconfitte su pronostici mai pubblicati."""
    finale = _monta(monkeypatch, agente)
    await agente._unified_settlement_cycle()

    decise = {k: v for k, v in finale.items() if v["result"] in ("won", "lost")}
    con_pick = {k: v for k, v in decise.items() if v["pick"]}
    assert con_pick == decise, (
        f"{len(decise) - len(con_pick)} righe decise senza una scelta mostrata: "
        "sono pronostici che il pubblico non ha mai visto"
    )


@pytest.mark.asyncio
async def test_le_righe_sotto_il_floor_sono_void_non_sconfitte(agente, monkeypatch):
    """Le tre che avevamo scambiato per «sconfitte scomparse». Non si puo'
    perdere una scommessa che non e' stata piazzata."""
    finale = _monta(monkeypatch, agente)
    await agente._unified_settlement_cycle()

    assert finale["2"]["result"] == "void", "Juventus-Milan 1-1, confidenza 43"
    assert finale["3"]["result"] == "void", "Everton-United 2-2, confidenza 47"
    assert finale["4"]["result"] == "void", "Eintracht-Augsburg 1-4, confidenza 50"


@pytest.mark.asyncio
async def test_la_riga_sopra_il_floor_si_grada_normalmente(agente, monkeypatch):
    """Il fix non spegne il settlement: dove una scelta e' stata mostrata,
    l'esito si calcola come sempre."""
    finale = _monta(monkeypatch, agente)
    await agente._unified_settlement_cycle()
    assert finale["1"] == {"result": "won", "pick": "home"}


@pytest.mark.asyncio
async def test_un_pick_mostrato_che_sbaglia_resta_una_sconfitta(agente, monkeypatch):
    """Il contrario del difetto: il fix non deve trasformare in `void` le
    sconfitte VERE, che sono l'unica meta' onesta di un track record."""
    righe = [_riga(1, "home", "Napoli", "Cagliari", conf=82)]
    monkeypatch.setitem(PUNTEGGI, 1, (0, 2))
    finale = _monta(monkeypatch, agente, righe=righe)
    await agente._unified_settlement_cycle()
    assert finale["1"] == {"result": "lost", "pick": "home"}


# ─── Il ponte del tennis ────────────────────────────────────────────────────────

def _ponte(monkeypatch, pick_di_riga):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "key123")
    monkeypatch.setattr(sc, "_REST_BASE", None)
    resp = MagicMock()
    resp.status_code = 200
    resp.json = MagicMock(return_value=[{"id": 7, "pick": pick_di_riga}])
    client = AsyncMock()
    client.get = AsyncMock(return_value=resp)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(sc.httpx, "AsyncClient", lambda *a, **k: ctx)
    visto = {}

    async def fake_settle(row_id, result, final_score=None):
        visto.update(row_id=row_id, result=result)
        return True

    monkeypatch.setattr(sc, "settle_unified_prediction", fake_settle)
    return visto


@pytest.mark.asyncio
async def test_tennis_sotto_il_floor_e_void_anche_col_vincitore_noto(monkeypatch):
    """Sapere chi ha vinto non basta: se non abbiamo mostrato su chi puntavamo,
    non c'e' nulla da graduare."""
    visto = _ponte(monkeypatch, pick_di_riga=None)
    await sc.settle_unified_tennis(
        "tennis:espn:182744:daniil-medvedev:frances-tiafoe",
        "Daniil Medvedev",
        final_score="6-4 6-3",
    )
    assert visto["result"] == "void"


@pytest.mark.asyncio
async def test_tennis_col_pick_mostrato_si_grada(monkeypatch):
    visto = _ponte(monkeypatch, pick_di_riga="Daniil Medvedev")
    await sc.settle_unified_tennis(
        "tennis:espn:182744:daniil-medvedev:frances-tiafoe",
        "Daniil Medvedev",
        final_score="6-4 6-3",
    )
    assert visto["result"] == "won"


# ─── Il cartello: non riaprire questa strada ────────────────────────────────────

def test_il_settlement_non_ha_piu_una_via_verso_best_selection():
    """Il difetto non era un errore di scrittura: era un'idea sbagliata, ed e'
    tornata due volte (calcio e tennis, lo stesso giorno). Se qualcuno ri-aggiunge
    un recupero da `best_selection` a chiusura avvenuta, questo test lo ferma e il
    docstring qui sopra gli spiega perche'."""
    assert not hasattr(sc, "fetch_football_selections"), (
        "il recupero della selezione del calcio e' stato rimosso di proposito"
    )
    firma = inspect.signature(sc.settle_unified_tennis).parameters
    assert "predicted_player" not in firma, (
        "il ponte tennis grada solo su `unified_predictions.pick`"
    )
    assert not hasattr(rs.ResultSettlementAgent, "_favorito")
