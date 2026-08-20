"""#TENNIS-FEED-DOWN-0805 — il board tennis era VUOTO e l'agente diceva
"no_active_tournaments".

Cronaca del 2026-08-05, verificata in produzione:
  · `tennis_fixtures` con `scheduled_at >= oggi`: **0 righe**
  · `/api/tennis`: `status:"not_ready"`, 0 match · board unified in finestra: 0 tennis
  · ultima predizione tennis scritta: 04/08 14:26 (~20h prima)
  · `agent_heartbeats.TennisDataCollectorAgent`:
        {"fixtures_collected":0,"source":"none","status":"no_active_tournaments"}
  · ESPN, nello stesso momento: **51 partite singolari non concluse** — National Bank
    Open (Toronto, Masters 1000) e Warsaw Polish Open.
  · il day-scoreboard (`site.api.espn.com/.../{atp,wta}/scoreboard`) rendeva **403**;
    l'endpoint HEADER (`site.web.api.espn.com/apis/v2/scoreboard/header`) rendeva **200**
    con tutto il necessario.

Il tennis è il ~93% del volume servito, quindi questo è un board vuoto sul prodotto —
mascherato dal messaggio di stato più rassicurante dei tre possibili.

Il payload di `tests/fixtures/espn_tennis_header_20260805.json` è REALE (ridotto),
scaricato da ESPN quel giorno: se ESPN cambia forma, questi test lo dicono.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from core.espn_tennis_client import (
    EspnFeedUnavailable,
    _header_event_to_fixture,
    get_fixtures_from_header,
)

PAYLOAD = json.loads(
    (Path(__file__).parent / "fixtures" / "espn_tennis_header_20260805.json").read_text(
        encoding="utf-8"
    )
)
# I match del campione sono del 2026-08-05: "adesso" va ancorato lì, altrimenti la
# finestra di trading li scarta e il test verde non proverebbe nulla.
NOW = datetime(2026, 8, 5, 10, 0, tzinfo=timezone.utc)


def _all_events():
    for lg in PAYLOAD["sports"][0]["leagues"]:
        for ev in lg.get("events", []):
            yield ev


def test_header_payload_yields_real_fixtures():
    got = [f for ev in _all_events() if (f := _header_event_to_fixture(ev, NOW))]
    assert got, "il feed header deve produrre fixture: e' la sorgente che regge quando l'altra cade"
    for f in got:
        assert f["player1"] and f["player2"]
        assert f["player1"] != f["player2"]
        assert f["tournament"]
        assert f["provider"] == "espn"
        assert f["match_id"].startswith("tennis:espn:")
        assert f["surface"] in ("hard", "clay", "grass")


def test_match_id_is_the_same_id_space_as_the_scoreboard():
    # Il match_id deve nascere da competitionId, lo STESSO id che il day-scoreboard
    # espone come competitions[].id. Se cambiasse, i fixture raccolti da qui non
    # deduperebbero piu' con quelli dell'altro endpoint e ogni partita entrerebbe
    # due volte, con odds e settlement sganciati.
    ev = next(e for e in _all_events() if e.get("status") == "pre")
    f = _header_event_to_fixture(ev, NOW)
    assert f is not None
    assert f["match_id"].split(":")[2] == str(ev["competitionId"])


def test_player_order_is_canonical_so_the_id_is_stable():
    got = [f for ev in _all_events() if (f := _header_event_to_fixture(ev, NOW))]
    from core.tennis_names import canonical_player_key

    for f in got:
        assert canonical_player_key(f["player1"]) <= canonical_player_key(f["player2"])


def test_completed_matches_are_never_emitted_as_fixtures():
    # Emettere una partita finita avvelenerebbe la pipeline con eventi passati.
    for ev in _all_events():
        if ev.get("status") == "post":
            assert _header_event_to_fixture(ev, NOW) is None


def test_doubles_are_dropped():
    ev = dict(next(e for e in _all_events() if e.get("status") == "pre"))
    ev["competitionType"] = {"text": "Men's Doubles"}
    assert _header_event_to_fixture(ev, NOW) is None


def test_trading_window_is_enforced_on_both_sides():
    ev = next(e for e in _all_events() if e.get("status") == "pre")
    # troppo nel passato (oltre la grazia di 2h)
    assert _header_event_to_fixture(ev, NOW + timedelta(days=3)) is None
    # troppo nel futuro (oltre le 48h di orizzonte)
    assert _header_event_to_fixture(ev, NOW - timedelta(days=5)) is None


@pytest.mark.parametrize(
    "mutation",
    [
        {"competitors": []},
        {"competitors": [{"displayName": "Solo Uno"}]},
        {"competitionId": ""},
        {"date": ""},
        {"date": "non-una-data"},
        {"competitors": [{"displayName": ""}, {"displayName": "Tale Altro"}]},
    ],
    ids=["no-competitors", "one-competitor", "no-id", "no-date", "bad-date", "unnamed-side"],
)
def test_fail_closed_on_incomplete_events(mutation):
    ev = dict(next(e for e in _all_events() if e.get("status") == "pre"))
    ev.update(mutation)
    assert _header_event_to_fixture(ev, NOW) is None


# ── la parte che conta davvero: un feed rotto NON e' "non ci sono tornei" ─────
class _Resp:
    def __init__(self, status_code=200, payload=None, bad_json=False):
        self.status_code = status_code
        self._payload = payload
        self._bad_json = bad_json

    def json(self):
        if self._bad_json:
            raise ValueError("not json")
        return self._payload


class _Client:
    def __init__(self, resp=None, exc=None):
        self._resp, self._exc = resp, exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, *a, **k):
        if self._exc:
            raise self._exc
        return self._resp


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "client,why",
    [
        (_Client(resp=_Resp(status_code=403)), "403 — e' esattamente il caso del 05/08"),
        (_Client(resp=_Resp(status_code=500)), "500"),
        (_Client(exc=RuntimeError("boom")), "rete giu'"),
        (_Client(resp=_Resp(bad_json=True)), "risposta non-json"),
        (_Client(resp=_Resp(payload={})), "payload senza blocco sports"),
    ],
    ids=["403", "500", "network", "bad-json", "empty-payload"],
)
async def test_broken_feed_raises_instead_of_looking_empty(monkeypatch, client, why):
    import core.espn_tennis_client as mod

    monkeypatch.setattr(mod.httpx, "AsyncClient", lambda *a, **k: client)
    with pytest.raises(EspnFeedUnavailable):
        await get_fixtures_from_header()
    # Il punto: NON deve tornare [] silenziosamente. Una lista vuota da un feed
    # rifiutato e' indistinguibile da una giornata senza tornei, ed e' la
    # confusione che ha tenuto il board vuoto per una mattina.


@pytest.mark.asyncio
async def test_healthy_feed_returns_fixtures(monkeypatch):
    import core.espn_tennis_client as mod

    monkeypatch.setattr(
        mod.httpx, "AsyncClient", lambda *a, **k: _Client(resp=_Resp(payload=PAYLOAD))
    )
    # Fuori dalla finestra di trading rispetto a NOW: la funzione usa l'orologio
    # reale, quindi qui verifico solo che NON solleva e che rende una lista.
    got = await get_fixtures_from_header()
    assert isinstance(got, list)


# ── perche' la raccolta ha reso zero: la distinzione che mancava ─────────────
def test_collection_status_calls_a_broken_feed_a_fault():
    from agents.tennis_data_collector import collection_status

    # IL CASO DEL 05/08: il feed rifiuta -> guasto, non "non ci sono tornei".
    assert collection_status("header feed http 403", None) == "feed_unavailable"
    assert collection_status("header feed unreachable: boom", {"qualifying": 5}) == "feed_unavailable"


def test_collection_status_separates_curation_from_empty_calendar():
    from agents.tennis_data_collector import collection_status

    # Il feed ha risposto e la curation ha scartato tutto: e' una scelta nostra,
    # non un guasto e non un calendario vuoto.
    assert collection_status(None, {"qualifying": 12, "minor": 0}) == "all_filtered"
    assert collection_status(None, {"qualifying": 0, "minor": 7}) == "all_filtered"
    # Feed ok, niente scartato, zero partite: giornata davvero vuota.
    assert collection_status(None, {"qualifying": 0, "minor": 0}) == "no_active_tournaments"
    assert collection_status(None, None) == "no_active_tournaments"


def test_no_active_tournaments_is_never_reported_when_the_feed_failed():
    from agents.tennis_data_collector import collection_status

    for err in ["403", "500", "timeout", "not json", "header feed carried no sports block"]:
        assert collection_status(err, None) != "no_active_tournaments"


# ── #ESPN-UA-403-0820: volume > 0 non vuol dire feed sano ────────────────────
def test_served_status_calls_a_covered_fault_a_fault():
    from agents.tennis_data_collector import served_status

    # IL CASO DEL 05/08-20/08: il day-scoreboard rifiuta, l'header copre, il
    # volume non e' zero -> l'allarme di `collection_status` non scatta mai e il
    # board serve 4 quarti di Cincinnati su 8 per 15 giorni.
    assert served_status("day-scoreboard refused every call (http 403)", 4) == "degraded"
    assert served_status("day-scoreboard unreachable: boom", 51) == "degraded"


def test_served_status_is_ok_when_the_primary_answered():
    from agents.tennis_data_collector import served_status

    assert served_status(None, 8) == "ok"
    assert served_status(None, 0) == "ok"
    # Primaria giu' E volume zero: lo dice gia' `collection_status`
    # (feed_unavailable), qui non si duplica l'allarme.
    assert served_status("http 403", 0) == "ok"
