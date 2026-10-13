"""
#NEWSPORTS-SETTLE-LEDGER-1008 — settlement e registro sigillato di MLB/UFC.

Prima: nessun percorso regolava baseball/mma (ogni fetch filtra sport=football),
le righe non entravano in pick_ledger e venivano riscritte anche dopo l'inizio.
Ogni blocco qui è verificato ROSSO per mutazione prima di diventare verde.
Sport dark: con zero righe baseball/mma niente cambia nel servito.
"""
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import agents.newsports_settlement as ns
import core.mlb_stats_client as mlbc
import core.supabase_client as sb
from agents.newsports_settlement import classify_mlb, classify_ufc, grade

NOW = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def _g(state, hs=None, as_=None, pk=1):
    return {"gamePk": pk, "status": {"detailedState": state},
            "teams": {"home": {"score": hs}, "away": {"score": as_}}}


def _resp(status, body=None):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body if body is not None else []
    r.text = json.dumps(body or {})
    return r


def _env():
    return (patch.object(sb.settings, "SUPABASE_URL", "https://x.supabase.co"),
            patch.object(sb.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"))


# ── 1. MLB: esito per gamePk, rinvio = void, pareggio = void ─────────────────

def test_mlb_final_scores_and_states():
    assert classify_mlb([_g("Final", 5, 3)]) == {"home": 5, "away": 3}
    assert classify_mlb([_g("Game Over", 1, 2)]) == {"home": 1, "away": 2}
    assert classify_mlb([_g("Completed Early", 4, 0)]) == {"home": 4, "away": 0}
    assert classify_mlb([_g("Final: Tied", 3, 3)]) == {"void": True}


def test_mlb_postponed_or_cancelled_is_void_even_if_played_later():
    assert classify_mlb([_g("Postponed")]) == {"void": True}
    assert classify_mlb([_g("Cancelled")]) == {"void": True}
    assert classify_mlb([_g("Postponed"), _g("Final", 2, 1)]) == {"void": True}


def test_mlb_in_progress_or_unreadable_is_not_graded():
    assert classify_mlb([_g("In Progress", 2, 1)]) is None
    assert classify_mlb([_g("Suspended", 2, 1)]) is None
    assert classify_mlb([_g("Final", None, None)]) is None
    assert classify_mlb([]) is None


async def test_mlb_lookup_is_by_gamepk_not_teams_and_date(monkeypatch):
    seen = {}

    async def fake(url, params=None):
        seen.update(params or {})
        # doubleheader: la fonte può restituire anche l'altra gara, va scartata
        return {"dates": [{"games": [_g("Final", 3, 1, pk=111), _g("Final", 2, 5, pk=222)]}]}

    monkeypatch.setattr(mlbc, "_get_json", fake)
    entries = await mlbc.get_game_entries(222)
    assert seen == {"sportId": 1, "gamePk": 222}
    assert classify_mlb(entries) == {"home": 2, "away": 5}


# ── 2. UFC: per id evento, pareggio / no contest = void ──────────────────────

def _ufc(completed=True, a="1", b="0"):
    return {"id": "ev1", "completed": completed,
            "scores": [{"name": "Fighter A", "score": a}, {"name": "Fighter B", "score": b}]}


def test_ufc_winner_draw_and_pending():
    assert classify_ufc(_ufc(), "Fighter A", "Fighter B") == {"home": 1.0, "away": 0.0}
    assert classify_ufc(_ufc(a="0", b="1"), "Fighter A", "Fighter B") == {"home": 0.0, "away": 1.0}
    assert classify_ufc(_ufc(a="0", b="0"), "Fighter A", "Fighter B") == {"void": True}
    assert classify_ufc(_ufc(completed=False), "Fighter A", "Fighter B") is None
    assert classify_ufc(None, "Fighter A", "Fighter B") is None


def test_ufc_unreadable_or_replaced_fighter_is_not_graded():
    assert classify_ufc(_ufc(a="x"), "Fighter A", "Fighter B") is None
    assert classify_ufc(_ufc(), "Fighter A", "Somebody Else") is None


def test_grade_home_away():
    assert grade("HOME", {"home": 5, "away": 3}) == ("won", "home")
    assert grade("AWAY", {"home": 5, "away": 3}) == ("lost", "home")
    assert grade("HOME", {"void": True}) == ("void", None)


# ── 3. ciclo: fetch dedicato, registro sul pick SIGILLATO, unresolved a 72h ──

def _wire_cycle(monkeypatch, rows, *, result, sealed=(True, {"pick": "HOME"})):
    calls = {"settle": [], "ledger": [], "scores": 0}

    async def fetch_rows():
        return rows

    async def result_for(row, scores):
        return result

    async def fetch_scores(key):
        calls["scores"] += 1
        return []

    async def sealed_fn(st, sid, mv):
        return sealed

    async def ledger(**kw):
        calls["ledger"].append(kw)
        return True

    async def settle(row_id, result_, **kw):
        calls["settle"].append((row_id, result_, kw))
        return True

    for name, fn in (("fetch_unsettled_newsports_rows", fetch_rows), ("_result_for", result_for),
                     ("_fetch_scores", fetch_scores), ("fetch_sealed_pick", sealed_fn),
                     ("record_pick_settlement", ledger), ("settle_unified_prediction", settle)):
        monkeypatch.setattr(ns, name, fn)
    return calls


def _row(table="mlb_model", pick="HOME", hours_ago=4.0):
    return {"id": 7, "sport": "baseball" if table == "mlb_model" else "mma",
            "source_table": table, "source_id": "222", "pick": pick,
            "home_team": "Fighter A", "away_team": "Fighter B",
            "starts_at": _iso(NOW - timedelta(hours=hours_ago))}


async def test_cycle_with_no_rows_writes_nothing_and_calls_no_source(monkeypatch):
    calls = _wire_cycle(monkeypatch, [], result=None)
    assert await ns.settle_newsports_cycle(NOW) == 0
    assert calls == {"settle": [], "ledger": [], "scores": 0}


async def test_cycle_grades_served_row_and_ledger_on_its_own_sealed_pick(monkeypatch):
    # il pick servito è cambiato in AWAY, il sigillo dice HOME: due esiti diversi
    calls = _wire_cycle(monkeypatch, [_row(pick="AWAY")], result={"home": 5, "away": 3},
                        sealed=(True, {"pick": "HOME"}))
    assert await ns.settle_newsports_cycle(NOW) == 1
    (rid, res, kw), = calls["settle"]
    assert (rid, res) == ("7", "lost")
    assert kw["verification_source"] == "mlb-statsapi" and kw["final_score"] == "5-3"
    led, = calls["ledger"]
    assert led["result"] == "won" and led["model_version"] == ns.MLB_MODEL_VERSION
    assert led["source_table"] == "mlb_model" and led["source_id"] == "222"


async def test_cycle_ledger_read_failure_settles_nothing(monkeypatch):
    calls = _wire_cycle(monkeypatch, [_row()], result={"home": 5, "away": 3},
                        sealed=(False, None))
    assert await ns.settle_newsports_cycle(NOW) == 0
    assert calls["settle"] == [] and calls["ledger"] == []


async def test_cycle_void_is_not_stamped_verified(monkeypatch):
    calls = _wire_cycle(monkeypatch, [_row(table="ufc_model")], result={"void": True})
    assert await ns.settle_newsports_cycle(NOW) == 1
    (_, res, kw), = calls["settle"]
    assert res == "void" and kw["verification_source"] is None
    assert calls["ledger"][0]["result"] == "void"
    assert calls["scores"] == 1          # una sola /scores per tutto il ciclo UFC


async def test_cycle_waits_then_unresolved_after_72h(monkeypatch):
    calls = _wire_cycle(monkeypatch, [_row(hours_ago=10)], result=None)
    assert await ns.settle_newsports_cycle(NOW) == 0 and calls["settle"] == []
    calls = _wire_cycle(monkeypatch, [_row(hours_ago=73)], result=None)
    assert await ns.settle_newsports_cycle(NOW) == 1
    (_, res, kw), = calls["settle"]
    assert res == "unresolved" and kw["verification_source"] is None
    assert calls["ledger"][0]["result"] == "unresolved"


async def test_cycle_without_sealed_pick_still_settles_the_served_row(monkeypatch):
    calls = _wire_cycle(monkeypatch, [_row()], result={"home": 1, "away": 2},
                        sealed=(True, None))
    assert await ns.settle_newsports_cycle(NOW) == 1
    assert calls["ledger"] == [] and calls["settle"][0][1] == "lost"


async def test_fetch_unsettled_newsports_targets_only_baseball_and_mma():
    client = AsyncMock()
    client.get.return_value = _resp(200, [])
    u, k = _env()
    with patch.object(sb.httpx, "AsyncClient") as mk, u, k:
        mk.return_value.__aenter__.return_value = client
        assert await sb.fetch_unsettled_newsports_rows() == []
        client.get.return_value = _resp(500, {"e": 1})
        assert await sb.fetch_unsettled_newsports_rows() is None   # errore ≠ vuoto
    params = client.get.await_args.kwargs["params"]
    assert params["sport"] == "in.(baseball,mma)" and params["result"] == "is.null"
    assert "source_id" in params["select"] and "source_table" in params["select"]


# ── 4. upsert: niente riscrittura dopo l'inizio o dopo l'esito ───────────────

ROW = {"source_table": "mlb_model", "source_id": "222", "pick": "HOME",
       "published_at": "2026-10-09T08:00:00+00:00", "updated_at": "2026-10-09T08:00:00+00:00"}


async def test_upsert_lock_after_start_filters_every_patch():
    client = AsyncMock()
    client.patch.side_effect = [_resp(200, []), _resp(200, [])]
    client.post.return_value = _resp(409, {"code": "23505"})   # riga iniziata: indice unico
    u, k = _env()
    with patch.object(sb.httpx, "AsyncClient") as mk, u, k:
        mk.return_value.__aenter__.return_value = client
        assert await sb.upsert_unified_rows([dict(ROW)], keep_published_at=True,
                                            lock_after_start=True) == 0
    for call in client.patch.await_args_list:
        assert "starts_at=gt." in call.args[0] and "result=is.null" in call.args[0]


async def test_upsert_without_lock_is_unchanged():
    client = AsyncMock()
    client.patch.return_value = _resp(200, [ROW])
    u, k = _env()
    with patch.object(sb.httpx, "AsyncClient") as mk, u, k:
        mk.return_value.__aenter__.return_value = client
        assert await sb.upsert_unified_rows([dict(ROW)]) == 1
    assert "starts_at=" not in client.patch.await_args.args[0]


# ── 5. sigillo in pick_ledger: primo pick, mai dopo l'inizio, mai quota derivata

def _unified(starts_in_h=5.0, odds=1.62, bookmaker="pinnacle"):
    return {"source_table": "mlb_model", "source_id": "222", "sport": "baseball",
            "league": "MLB", "competition": "MLB 2026", "home_team": "A", "away_team": "B",
            "pick": "HOME", "confidence_score": 62, "odds": odds, "bookmaker": bookmaker,
            "signal_type": "paper",
            "starts_at": _iso(datetime.now(timezone.utc) + timedelta(hours=starts_in_h)),
            "notes": json.dumps({"p_home": 0.62, "p_away": 0.38, "mkt_source": "pinnacle"})}


def test_ledger_row_maps_the_published_pick():
    r = sb.ledger_row_from_unified(_unified(), "mlb-market-anchored-v1")
    assert r["pick"] == "HOME" and r["confidence"] == 0.62 and r["p_home"] == 0.62
    assert r["sport"] == "baseball" and r["market"] == "H2H"
    assert r["model_version"] == "mlb-market-anchored-v1" and r["is_paper"] is True


def test_ledger_row_refuses_started_events_and_keeps_derived_price_out():
    assert sb.ledger_row_from_unified(_unified(starts_in_h=-0.1), "v") is None
    r = sb.ledger_row_from_unified(_unified(odds=None, bookmaker="consensus (derived, not offered)"), "v")
    assert r["odds"] is None


async def test_seal_posts_insert_or_ignore_on_the_ledger_key():
    client = AsyncMock()
    client.post.return_value = _resp(201)
    u, k = _env()
    with patch.object(sb.httpx, "AsyncClient") as mk, u, k:
        mk.return_value.__aenter__.return_value = client
        assert await sb.seal_pick_ledger_rows([_unified(), _unified(starts_in_h=-1)], "v") == 1
    url = client.post.await_args.args[0]
    assert url.endswith("/pick_ledger?on_conflict=source_table,source_id,model_version")
    assert "ignore-duplicates" in client.post.await_args.kwargs["headers"]["Prefer"]
    assert len(client.post.await_args.kwargs["json"]) == 1   # l'evento iniziato non parte
