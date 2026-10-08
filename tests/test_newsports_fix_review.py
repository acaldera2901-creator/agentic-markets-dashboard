"""
#NEWSPORTS-FIX-REVIEW-1007 — i 4 difetti trovati dalla revisione di agentic_codex
su PR #519 (#NEWSPORTS-QUALITA-1006). Un blocco per difetto; ogni test è stato
verificato ROSSO sul codice precedente (mutazione) prima di diventare verde.
Sport dark: il servito ai clienti non cambia.
"""
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import agents.baseball_model_agent as mlb
import agents.mma_model_agent as mma
import core.supabase_client as sb
from agents.baseball_model_agent import series_capped, team_capped
from core.odds_api_client import consensus_is_fresh, devig_two_way


def _book(name, oh, oa, last_update=None):
    return {"book": name, "p_home": devig_two_way(oh, oa), "odds_home": oh,
            "odds_away": oa, "last_update": last_update}


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


NOW = datetime(2026, 10, 7, 18, 0, tzinfo=timezone.utc)
DODGERS, PADRES = "Los Angeles Dodgers", "San Diego Padres"


def _prior(source_id, hours_ago=1.0, pick="HOME", table="mlb_model"):
    row = {"home_team": DODGERS, "away_team": PADRES, "pick": pick,
           "published_at": (NOW - timedelta(hours=hours_ago)).isoformat()}
    if source_id is not None:
        row["source_id"] = source_id
    if table is not None:
        row["source_table"] = table
    return row


# ── 1. MLB: la stessa gara non si auto-blocca, il doubleheader sì ─────────────

def test_series_cap_ignores_the_same_game_published_earlier():
    assert not series_capped(DODGERS, PADRES, NOW, [_prior("99")], 5, source_id="99")


def test_series_cap_still_blocks_the_other_doubleheader_game():
    assert series_capped(DODGERS, PADRES, NOW, [_prior("98")], 5, source_id="99")


def test_series_cap_row_without_id_stays_in_the_cap():
    # fail-closed: senza identità non si può dire che sia la stessa gara
    assert series_capped(DODGERS, PADRES, NOW, [_prior(None)], 5, source_id="99")


def test_series_cap_same_id_from_another_source_table_still_counts():
    assert series_capped(DODGERS, PADRES, NOW, [_prior("99", table="altro")], 5, source_id="99")


def test_team_cap_ignores_the_same_game_but_not_other_games():
    assert not team_capped(DODGERS, NOW, [_prior("99")], source_id="99")
    assert team_capped(DODGERS, NOW, [_prior("98")], source_id="99")


def _wire_mlb_cycle(monkeypatch, recent, books=None, game_pk=99):
    now = datetime.now(timezone.utc)
    start = _iso(now + timedelta(hours=3))
    game = {
        "gamePk": game_pk, "gameDate": start, "status": {"abstractGameState": "Preview"},
        "teams": {
            "home": {"team": {"id": 119, "name": DODGERS},
                     "probablePitcher": {"id": 1, "fullName": "P Home"}},
            "away": {"team": {"id": 135, "name": PADRES},
                     "probablePitcher": {"id": 2, "fullName": "P Away"}},
        },
    }
    rec = {"wins": 60, "losses": 40, "runsScored": 500, "runsAllowed": 400}
    books = books if books is not None else [_book("pinnacle", 1.33, 3.40)]  # p_home ~0,72

    async def schedule(_d):
        return [game]

    async def standings(_s):
        return {119: dict(rec), 135: dict(rec)}

    async def prev(_s):
        return {"lgFip": 4.0, "winpct": {}}

    async def h2h(_l):
        return [{"event_id": "e", "home_team": DODGERS, "away_team": PADRES,
                 "commence_time": start, "books": books}]

    async def fip(_pid, _season, lg):
        return {"fip": lg, "games": 20, "starts": 20}

    calls = {"rows": [], "kwargs": []}

    async def upsert(rows, **kw):
        calls["rows"].extend(rows)
        calls["kwargs"].append(kw)
        return len(rows)

    async def fetch(_sport, _days):
        return recent

    for name, fn in (("get_schedule", schedule), ("get_standings", standings),
                     ("get_prev_season", prev), ("get_h2h_events", h2h),
                     ("get_pitcher_fip", fip), ("upsert_unified_rows", upsert),
                     ("fetch_recent_sport_pairs", fetch)):
        monkeypatch.setattr(mlb, name, fn)
    return calls


def _recent_row(source_id, hours_ago=1.0):
    return {"source_table": "mlb_model", "source_id": source_id,
            "home_team": DODGERS, "away_team": PADRES, "pick": "HOME",
            "published_at": (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()}


async def test_mlb_cycle_refreshes_the_game_published_at_the_previous_cycle(monkeypatch):
    calls = _wire_mlb_cycle(monkeypatch, [_recent_row("99")])
    assert await mlb.BaseballModelAgent()._compute_cycle() == 1
    assert calls["rows"][0]["source_id"] == "99"


async def test_mlb_cycle_doubleheader_second_game_stays_capped(monkeypatch):
    calls = _wire_mlb_cycle(monkeypatch, [_recent_row("98")])
    assert await mlb.BaseballModelAgent()._compute_cycle() == 0
    assert calls["rows"] == []


class _Resp:
    def __init__(self, status, payload):
        self.status_code, self._payload, self.text = status, payload, str(payload)

    def json(self):
        return self._payload


async def test_fetch_recent_sport_pairs_selects_the_row_identity(monkeypatch):
    seen = {}

    class _C:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, params=None, headers=None):
            seen.update(params or {})
            return _Resp(200, [])

    monkeypatch.setattr(sb, "_rest_base", lambda: "http://supabase.test/rest/v1")
    monkeypatch.setattr(sb.httpx, "AsyncClient", _C)
    assert await sb.fetch_recent_sport_pairs("baseball", 14) == []
    cols = set(seen["select"].split(","))
    assert {"source_table", "source_id", "published_at", "pick"} <= cols


# ── 3. quota stantia = consenso non pubblicabile ──────────────────────────────

def test_consensus_freshness_rules():
    fresh = {"last_update": _iso(NOW - timedelta(hours=1)), "source": "pinnacle"}
    stale = {"last_update": _iso(NOW - timedelta(hours=7)), "source": "pinnacle"}
    assert consensus_is_fresh(fresh, NOW, 6)
    assert not consensus_is_fresh(stale, NOW, 6)
    assert not consensus_is_fresh({"last_update": "ieri sera"}, NOW, 6)   # illeggibile
    assert consensus_is_fresh({"last_update": None}, NOW, 6)              # assente: documentato
    assert consensus_is_fresh(stale, NOW, 0)                              # controllo spento


def test_default_max_age_is_six_hours():
    from config.settings import settings
    assert settings.NEWSPORT_ODDS_MAX_AGE_HOURS == 6.0


async def test_mlb_cycle_skips_a_stale_consensus(monkeypatch):
    old = _iso(datetime.now(timezone.utc) - timedelta(hours=9))
    calls = _wire_mlb_cycle(monkeypatch, [], books=[_book("pinnacle", 1.33, 3.40, old)])
    assert await mlb.BaseballModelAgent()._compute_cycle() == 0
    assert calls["rows"] == []


async def test_mlb_cycle_publishes_a_fresh_consensus(monkeypatch):
    new = _iso(datetime.now(timezone.utc) - timedelta(minutes=10))
    calls = _wire_mlb_cycle(monkeypatch, [], books=[_book("pinnacle", 1.33, 3.40, new)])
    assert await mlb.BaseballModelAgent()._compute_cycle() == 1


def _wire_mma_cycle(monkeypatch, last_update=None):
    now = datetime.now(timezone.utc)
    start = now + timedelta(hours=10)
    ev = {"event_id": "f1", "home_team": "Fighter A", "away_team": "Fighter B",
          "commence_time": _iso(start),
          "books": [_book("pinnacle", 1.30, 3.60, last_update)]}  # p_home ~0,73

    async def h2h(_l):
        return [ev]

    async def windows():
        return [{"name": "UFC 400 A vs B", "start_ms": start.timestamp() * 1000,
                 "text": "UFC 400 Fighter A vs Fighter B main event"}]

    calls = {"rows": [], "kwargs": []}

    async def upsert(rows, **kw):
        calls["rows"].extend(rows)
        calls["kwargs"].append(kw)
        return len(rows)

    monkeypatch.setattr(mma, "get_h2h_events", h2h)
    monkeypatch.setattr(mma, "get_ufc_windows", windows)
    monkeypatch.setattr(mma, "upsert_unified_rows", upsert)
    return calls


async def test_mma_cycle_skips_a_stale_consensus(monkeypatch):
    calls = _wire_mma_cycle(monkeypatch, _iso(datetime.now(timezone.utc) - timedelta(hours=8)))
    assert await mma.MmaModelAgent()._compute_cycle() == 0
    assert calls["rows"] == []


# ── 4. published_at = prima pubblicazione, non l'ultimo ciclo ─────────────────

async def test_mma_cycle_upserts_keeping_the_first_published_at(monkeypatch):
    calls = _wire_mma_cycle(monkeypatch)
    assert await mma.MmaModelAgent()._compute_cycle() == 1
    assert calls["kwargs"] == [{"keep_published_at": True}]


async def test_mlb_cycle_upserts_keeping_the_first_published_at(monkeypatch):
    calls = _wire_mlb_cycle(monkeypatch, [])
    assert await mlb.BaseballModelAgent()._compute_cycle() == 1
    assert calls["kwargs"] == [{"keep_published_at": True}]


def _resp(status, body=None):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body if body is not None else []
    r.text = json.dumps(body or {})
    return r


ROW = {"source_table": "ufc_model", "source_id": "f1", "pick": "HOME",
       "published_at": "2026-10-07T18:00:00+00:00", "updated_at": "2026-10-07T18:00:00+00:00"}


def _upsert_env():
    return (patch.object(sb.settings, "SUPABASE_URL", "https://x.supabase.co"),
            patch.object(sb.settings, "SUPABASE_SERVICE_ROLE_KEY", "k"))


async def test_upsert_keep_published_at_patch_omits_it_on_existing_row():
    client = AsyncMock()
    client.patch.return_value = _resp(200, [ROW])
    u, k = _upsert_env()
    with patch.object(sb.httpx, "AsyncClient") as mk, u, k:
        mk.return_value.__aenter__.return_value = client
        assert await sb.upsert_unified_rows([dict(ROW)], keep_published_at=True) == 1
    assert client.patch.await_count == 1
    url = client.patch.await_args.args[0]
    body = client.patch.await_args.kwargs["json"]
    assert "published_at=not.is.null" in url
    assert "published_at" not in body and body["updated_at"] == ROW["updated_at"]
    client.post.assert_not_awaited()


async def test_upsert_keep_published_at_fills_a_null_one_then_inserts_new():
    client = AsyncMock()
    # 1° PATCH (righe già pubblicate): niente · 2° PATCH (chiave): niente → POST
    client.patch.side_effect = [_resp(200, []), _resp(200, [])]
    client.post.return_value = _resp(201)
    u, k = _upsert_env()
    with patch.object(sb.httpx, "AsyncClient") as mk, u, k:
        mk.return_value.__aenter__.return_value = client
        assert await sb.upsert_unified_rows([dict(ROW)], keep_published_at=True) == 1
    second = client.patch.await_args_list[1]
    assert "published_at=" not in second.args[0]
    assert second.kwargs["json"]["published_at"] == ROW["published_at"]
    assert client.post.await_args.kwargs["json"]["published_at"] == ROW["published_at"]


async def test_upsert_default_is_unchanged_for_football():
    client = AsyncMock()
    client.patch.return_value = _resp(200, [ROW])
    u, k = _upsert_env()
    with patch.object(sb.httpx, "AsyncClient") as mk, u, k:
        mk.return_value.__aenter__.return_value = client
        assert await sb.upsert_unified_rows([dict(ROW)]) == 1
    assert client.patch.await_count == 1
    assert "published_at=" not in client.patch.await_args.args[0]
    assert client.patch.await_args.kwargs["json"]["published_at"] == ROW["published_at"]


# ── 5. quota derivata: mai nella riga, per NESSUN consumatore ─────────────────
# La PR copriva solo /api/newsports. La stessa quota restava nella colonna
# top-level `odds` (bookmaker="median") e in notes.odds_*, e /api/v2/predictions
# passa `notes` al client senza mascheramento. Ora il prezzo derivato non esce.
from core.odds_api_client import DERIVED_BOOKMAKER, market_consensus, offered_prices

_EVEN = [_book("a", 1.50, 2.70), _book("b", 1.55, 2.55),
         _book("c", 1.60, 2.45), _book("d", 1.65, 2.35)]


def _mlb_row(mkt):
    game = {"gamePk": 777, "gameDate": "2026-10-07T23:10:00Z",
            "teams": {"home": {"team": {"id": 1, "name": DODGERS}},
                      "away": {"team": {"id": 2, "name": PADRES}}}}
    return mlb.build_unified_row(game=game, mkt=mkt, p_model=0.6, tier="standard",
                                 season=2026, sp_home=None, sp_away=None,
                                 fip_home=4.0, fip_away=4.0, flags=[], recs={},
                                 now_iso=_iso(NOW))


def _mma_row(mkt):
    ev = {"event_id": "ufc-1", "home_team": "Fighter A", "away_team": "Fighter B",
          "commence_time": "2026-10-10T23:00:00Z", "books": []}
    return mma.build_unified_row(ev=ev, mkt=mkt, tier="standard", ufc_event="UFC 333",
                                 hours_to_fight=10.0, flags=[], now_iso=_iso(NOW),
                                 org_verification="bout_in_card")


def test_even_median_row_carries_no_derived_price_anywhere():
    mkt = market_consensus(_EVEN)
    assert mkt["odds_derived"] is True            # premessa: mediana pari = derivata
    for row in (_mlb_row(mkt), _mma_row(mkt)):
        notes = json.loads(row["notes"])
        assert row["odds"] is None
        assert row["bookmaker"] == DERIVED_BOOKMAKER   # colonna NOT NULL: dichiarata, non vuota
        assert notes["odds_home"] is None and notes["odds_away"] is None
        assert notes["odds_derived"] is True
        assert notes["p_home"] == round(mkt["p_home"], 4)   # probabilità invariata


def test_real_book_price_is_kept_with_the_book_that_quotes_it():
    odd = market_consensus(_EVEN[:3])              # n dispari: riga reale del book "b"
    pin = market_consensus(_EVEN + [_book("pinnacle", 1.58, 2.50)])
    for mkt, book in ((odd, "b"), (pin, "pinnacle")):
        assert mkt["odds_derived"] is False
        for row in (_mlb_row(mkt), _mma_row(mkt)):
            notes = json.loads(row["notes"])
            assert row["odds"] == (mkt["odds_home"] if notes["p_home"] >= 0.5 else mkt["odds_away"])
            assert row["bookmaker"] == book
            assert (notes["odds_home"], notes["odds_away"]) == (mkt["odds_home"], mkt["odds_away"])


def test_offered_prices_never_returns_a_derived_number():
    px = offered_prices({"odds_derived": True, "odds_home": 1.6, "odds_away": 2.4,
                         "source": "median", "odds_book": None}, pick_home=True)
    assert px == {"odds": None, "odds_home": None, "odds_away": None,
                  "bookmaker": DERIVED_BOOKMAKER}
