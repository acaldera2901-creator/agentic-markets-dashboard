"""#PICK-PERSIST-0907 — il pick risolto dal settlement deve finire NELLA RIGA.

Il difetto. Il settlement sa gia' qual e' la scelta: quando
`unified_predictions.pick` e' vuoto la recupera dalla sorgente
(`match_predictions.best_selection` per il calcio, `tennis_predictions.
best_selection` per il tennis), la usa per decidere won/lost... e poi la butta
via. `settle_unified_prediction` scriveva `result`, `status`, `is_historical`,
`settled_at`, `updated_at` e il punteggio nelle notes — mai `pick`. La riga
restava con l'esito e senza la scelta.

Perche' non e' cosmetico. Ogni superficie pubblica che deve mostrare COSA
avevamo previsto filtra `pick not null`. Il filtro quindi non seleziona le
previsioni: seleziona gli ESITI di cui e' sopravvissuta la scelta.

Misurato su produzione il 07/09, chiusure del 06/09: 27 righe non-void, 12 con
pick (9 vinte, 75%) e 15 senza pick (6 vinte, 40%). Lo stesso giorno, la stessa
pipeline, due tassi di vittoria che differiscono di 35 punti — e il pubblico
vedeva solo il primo. Fra le righe senza pick: Juventus-Milan, Everton-United,
Eintracht-Augsburg, Brommapojkarna-Elfsborg.

IL test e' `test_invariante_...`: dopo la chiusura di una giornata, il numero di
righe won/lost CON pick deve essere uguale al numero di righe won/lost. Senza la
fix vale 1 contro 3.
"""
import logging
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

import agents.result_settlement as rs
import core.supabase_client as sc
from config.settings import settings


# ─── A. Il payload della PATCH ──────────────────────────────────────────────────

def _finto_client(monkeypatch, notes_esistenti="{}"):
    """PostgREST finto: la GET rende le notes, la PATCH viene raccolta."""
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "key123")
    monkeypatch.setattr(sc, "_REST_BASE", None)

    get_resp = MagicMock()
    get_resp.status_code = 200
    get_resp.json = MagicMock(return_value=[{"notes": notes_esistenti}])
    patch_resp = MagicMock()
    patch_resp.status_code = 204
    patch_resp.text = ""

    client = AsyncMock()
    client.get = AsyncMock(return_value=get_resp)
    client.patch = AsyncMock(return_value=patch_resp)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(sc.httpx, "AsyncClient", lambda *a, **k: ctx)
    return client


@pytest.mark.asyncio
async def test_il_pick_risolto_finisce_nella_patch(monkeypatch):
    client = _finto_client(monkeypatch)
    ok = await sc.settle_unified_prediction(
        "42", "lost", final_score="1-1", resolved_pick="home"
    )
    assert ok
    payload = client.patch.await_args.kwargs["json"]
    assert payload["pick"] == "home", "la scelta con cui si e' graduata la riga"
    assert payload["result"] == "lost"


@pytest.mark.asyncio
async def test_una_riga_che_il_pick_ce_l_ha_non_viene_toccata(monkeypatch):
    """Non-distruttivo: senza `resolved_pick` la colonna `pick` non e' nella
    PATCH, quindi il valore originale resta esattamente dov'era."""
    client = _finto_client(monkeypatch)
    await sc.settle_unified_prediction("42", "won", final_score="2-0")
    assert "pick" not in client.patch.await_args.kwargs["json"]


@pytest.mark.asyncio
@pytest.mark.parametrize("vuoto", [None, "", "   "])
async def test_un_pick_vuoto_non_si_scrive(monkeypatch, vuoto):
    """Meglio la colonna vuota che una stringa vuota che finge di essere un
    pronostico: `pick not null` tornerebbe vero su una riga senza scelta."""
    client = _finto_client(monkeypatch)
    await sc.settle_unified_prediction("42", "void", resolved_pick=vuoto)
    assert "pick" not in client.patch.await_args.kwargs["json"]


@pytest.mark.asyncio
async def test_la_provenienza_e_dichiarata_e_le_notes_non_si_perdono(monkeypatch):
    """`best_selection` viene letto ALLA CHIUSURA da una tabella in upsert, non
    da un registro immutabile: la riga deve dire da dove viene quel pick."""
    import json
    client = _finto_client(monkeypatch, notes_esistenti='{"p_home": 0.51}')
    await sc.settle_unified_prediction(
        "42", "lost", final_score="1-1", resolved_pick="home"
    )
    notes = json.loads(client.patch.await_args.kwargs["json"]["notes"])
    assert notes["pick_source"] == "best_selection"
    assert notes["final_score"] == "1-1"
    assert notes["p_home"] == 0.51, "le notes esistenti si fondono, non si perdono"


@pytest.mark.asyncio
async def test_senza_pick_risolto_nessuna_provenienza_inventata(monkeypatch):
    import json
    client = _finto_client(monkeypatch)
    await sc.settle_unified_prediction("42", "won", final_score="2-0")
    assert "pick_source" not in json.loads(client.patch.await_args.kwargs["json"]["notes"])


# ─── B. L'invariante sulla giornata (calcio) ────────────────────────────────────

def _riga(id_, ext, pick, casa, ospite, source_id):
    return {
        "id": id_,
        "external_event_id": ext,
        "source_id": source_id,
        "source_table": "match_predictions",
        "sport": "football",
        "league": "SA",
        "competition": "Serie A",
        "home_team": casa,
        "away_team": ospite,
        "market": "1X2",
        "pick": pick,
        "starts_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
        "world_cup_stage": None,
    }


# La giornata del 06/09 in miniatura: una riga col suo pick, e due senza — che
# in produzione sono finite in storico come sconfitte anonime.
GIORNATA = [
    _riga(1, "espn:1", "home", "Barcelona", "Valencia", "espn:1"),      # pick suo
    _riga(2, "558618", None, "Juventus FC", "AC Milan", "558618"),      # recuperabile
    _riga(3, "565786", "", "Eintracht Frankfurt", "FC Augsburg", "565786"),
]
PUNTEGGI = {1: (2, 0), 2: (1, 1), 3: (0, 2)}   # won, lost, lost
SELEZIONI = {"558618": "home", "565786": "home"}


@pytest.fixture
def agente():
    a = rs.ResultSettlementAgent.__new__(rs.ResultSettlementAgent)
    a.logger = logging.getLogger("test_pick_persistence")
    a._scores_cache = {}
    a.set_status_detail = lambda _d: None
    return a


def _monta_giornata(monkeypatch, agente):
    """Rende lo STATO FINALE di ogni riga come lo vedrebbe una query pubblica:
    il pick originale, o quello che il settlement ha scritto."""
    finale: dict[str, dict] = {}

    async def fake_fetch(cutoff_minutes=115, limit=50):
        return GIORNATA

    async def fake_selezioni(ids):
        return {k: v for k, v in SELEZIONI.items() if k in ids}

    async def fake_settle(row_id, outcome, final_score=None, resolved_pick=None):
        originale = next(
            (r["pick"] for r in GIORNATA if str(r["id"]) == str(row_id)), None
        )
        finale[str(row_id)] = {
            "result": outcome,
            # esattamente la semantica della PATCH: `pick` si sovrascrive solo
            # se il chiamante ne passa uno.
            "pick": (resolved_pick or "").strip() or (originale or ""),
        }
        return True

    async def fake_record(**kw):
        return True

    async def fake_result(row):
        casa, ospite = PUNTEGGI[row["id"]]
        return {"home_goals": casa, "away_goals": ospite}

    async def fake_void(row):
        return False

    monkeypatch.setattr(rs, "fetch_unsettled_unified_predictions", fake_fetch)
    monkeypatch.setattr(rs, "fetch_football_selections", fake_selezioni)
    monkeypatch.setattr(rs, "settle_unified_prediction", fake_settle)
    monkeypatch.setattr(rs, "record_pick_settlement", fake_record)
    monkeypatch.setattr(agente, "_fetch_unified_result", fake_result)
    monkeypatch.setattr(agente, "_should_void_abandoned", fake_void)
    return finale


@pytest.mark.asyncio
async def test_invariante_ogni_riga_chiusa_won_lost_ha_il_suo_pick(agente, monkeypatch):
    """IL criterio di successo, nella forma in cui e' stato chiesto:

        count(pick not null AND result in (won,lost)) == count(result in (won,lost))

    Su produzione, il 06/09, valeva 12 contro 27. Qui senza la fix vale 1 contro 3.
    """
    finale = _monta_giornata(monkeypatch, agente)
    await agente._unified_settlement_cycle()

    decise = [r for r in finale.values() if r["result"] in ("won", "lost")]
    con_pick = [r for r in decise if r["pick"]]
    assert len(decise) == 3, "le tre partite hanno un punteggio: nessuna e' void"
    assert len(con_pick) == len(decise), (
        f"{len(decise) - len(con_pick)} righe chiuse won/lost senza pick: "
        "spariscono da ogni superficie che filtra `pick not null`, e con loro "
        "sparisce solo un pezzo dello storico — quello che perde"
    )


@pytest.mark.asyncio
async def test_il_pick_scritto_e_quello_che_ha_deciso_l_esito(agente, monkeypatch):
    """Il pick e l'esito devono raccontare la stessa cosa: 'home' su un 1-1 e'
    una sconfitta, e la riga deve dire entrambe. Un pick scollegato dall'esito
    sarebbe peggio della colonna vuota."""
    finale = _monta_giornata(monkeypatch, agente)
    await agente._unified_settlement_cycle()

    assert finale["2"] == {"result": "lost", "pick": "home"}, "Juventus-Milan 1-1"
    assert finale["3"] == {"result": "lost", "pick": "home"}, "Eintracht-Augsburg 0-2"
    assert finale["1"] == {"result": "won", "pick": "home"}, "il pick suo resta suo"


@pytest.mark.asyncio
async def test_senza_selezione_recuperabile_non_si_inventa_un_pick(agente, monkeypatch):
    """Quando la sorgente non ha piu' `best_selection` la riga resta senza pick e
    va in void, come prima. Meglio un buco dichiarato di un pronostico inventato."""
    finale = _monta_giornata(monkeypatch, agente)
    monkeypatch.setattr(rs, "fetch_football_selections", AsyncMock(return_value={}))
    await agente._unified_settlement_cycle()

    assert finale["2"]["result"] == "void"
    assert finale["2"]["pick"] == ""


# ─── C. Il ponte del tennis ─────────────────────────────────────────────────────

def _ponte(monkeypatch, pick_di_riga):
    """settle_unified_tennis_prediction con una sola riga, e raccoglie la
    chiamata alla chiusura."""
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

    async def fake_settle(row_id, result, final_score=None, resolved_pick=None):
        visto.update(row_id=row_id, result=result, resolved_pick=resolved_pick)
        return True

    monkeypatch.setattr(sc, "settle_unified_prediction", fake_settle)
    return visto


@pytest.mark.asyncio
async def test_tennis_il_favorito_recuperato_viene_scritto(monkeypatch):
    visto = _ponte(monkeypatch, pick_di_riga=None)
    await sc.settle_unified_tennis(
        "tennis:espn:182744:daniil-medvedev:frances-tiafoe",
        winner_name="Daniil Medvedev",
        predicted_player="Daniil Medvedev",
        final_score="6-4 6-3",
    )
    assert visto["result"] == "won"
    assert visto["resolved_pick"] == "Daniil Medvedev"


@pytest.mark.asyncio
async def test_tennis_una_riga_col_suo_pick_resta_intatta(monkeypatch):
    visto = _ponte(monkeypatch, pick_di_riga="Jannik Sinner")
    await sc.settle_unified_tennis(
        "tennis:espn:1:jannik-sinner:carlos-alcaraz",
        winner_name="Jannik Sinner",
        predicted_player="Carlos Alcaraz",
        final_score="6-4 6-3",
    )
    assert visto["result"] == "won", "vince il pick della riga, non il fallback"
    assert visto["resolved_pick"] is None
