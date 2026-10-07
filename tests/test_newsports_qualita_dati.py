"""
#NEWSPORTS-QUALITA-1006 — difetti di qualità dati nei produttori MLB/UFC trovati
dall'audit read-only di agentic_codex del 06/10/2026. Un blocco per difetto;
ogni test qui è stato verificato ROSSO sul codice precedente (mutazione) prima
di diventare verde. Sport dark: il servito ai clienti non cambia.
"""
from datetime import datetime, timedelta, timezone

import pytest

import agents.baseball_model_agent as mlb
import agents.mma_model_agent as mma
import core.supabase_client as sb
from agents.baseball_model_agent import match_odds_event, picked_teams, team_capped
from agents.mma_model_agent import (
    build_unified_row as mma_row,
    bout_in_card,
    is_development_card,
    normalize_name_tokens,
    verify_bout_card,
)
from core.odds_api_client import (
    devig_two_way,
    market_consensus,
    pair_overround,
    parse_h2h_events,
)


def _book(name, oh, oa, last_update=None):
    return {"book": name, "p_home": devig_two_way(oh, oa), "odds_home": oh,
            "odds_away": oa, "last_update": last_update}


# ── 1. mediana con n pari: probabilità e quote dalla stessa riga ──────────────

def test_even_median_odds_are_coherent_with_the_served_probability():
    books = [_book("a", 1.60, 2.40), _book("b", 1.70, 2.20),
             _book("c", 1.80, 2.05), _book("d", 1.95, 1.90)]
    mkt = market_consensus(books)
    ordered = sorted(b["p_home"] for b in books)
    assert mkt["p_home"] == pytest.approx((ordered[1] + ordered[2]) / 2)  # mediana lab B4 invariata
    # la coppia di quote mostrata devigga ESATTAMENTE alla probabilità servita
    assert devig_two_way(mkt["odds_home"], mkt["odds_away"]) == pytest.approx(mkt["p_home"], abs=1e-3)
    assert mkt["odds_derived"] is True and mkt["odds_book"] is None
    # il margine è quello medio dei due book centrali, non zero (no quote "fair")
    ovr = pair_overround(mkt["odds_home"], mkt["odds_away"])
    expected = (pair_overround(1.70, 2.20) + pair_overround(1.80, 2.05)) / 2
    assert ovr == pytest.approx(expected, abs=2e-3)


def test_odd_median_and_pinnacle_keep_a_real_book_row():
    odd = market_consensus([_book("a", 1.60, 2.40), _book("b", 1.70, 2.20), _book("c", 1.80, 2.05)])
    assert odd["odds_derived"] is False and odd["odds_book"] == "b"
    assert (odd["odds_home"], odd["odds_away"]) == (1.70, 2.20)
    pin = market_consensus([_book("x", 1.60, 2.40), _book("pinnacle", 1.75, 2.15)])
    assert pin["source"] == "pinnacle" and pin["odds_book"] == "pinnacle"
    assert pin["odds_derived"] is False


# ── 2. quarantena: overround implausibile e consenso anomalo ──────────────────

def test_devig_quarantines_implausible_overround():
    assert devig_two_way(2.20, 2.20) is None      # 0,909: arbitraggio sullo stesso book
    assert devig_two_way(1.50, 2.00) is None      # 1,167: margine da mercato sospeso
    assert devig_two_way(1.90, 1.90) is not None  # 1,053: moneyline normale
    assert devig_two_way(2.02, 2.02) is not None  # 0,990: dentro la tolleranza


def test_parse_h2h_events_drops_quarantined_pairs():
    payload = [{
        "id": "e1", "home_team": "H", "away_team": "A", "commence_time": "2026-10-07T00:00:00Z",
        "bookmakers": [
            {"key": "ok", "markets": [{"key": "h2h", "outcomes": [
                {"name": "H", "price": 1.9}, {"name": "A", "price": 1.9}]}]},
            {"key": "stale", "markets": [{"key": "h2h", "outcomes": [
                {"name": "H", "price": 2.3}, {"name": "A", "price": 2.3}]}]},
        ],
    }]
    books = parse_h2h_events(payload)[0]["books"]
    assert [b["book"] for b in books] == ["ok"]


def test_anomalous_consensus_is_not_publishable():
    # il caso reale del 25/09: pHome 0,0099 con mediana su 5 book
    extreme = [_book(f"b{i}", 51.0, 1.005) for i in range(5)]
    assert extreme[0]["p_home"] < 0.05
    assert market_consensus(extreme) is None
    assert market_consensus([_book("pinnacle", 1.02, 25.0)]) is None   # p ~0,96
    assert market_consensus([_book("pinnacle", 1.30, 3.60)]) is not None


# ── 3. last_update per book propagato ─────────────────────────────────────────

def test_last_update_is_propagated_per_book_and_into_consensus():
    payload = [{
        "id": "e1", "home_team": "H", "away_team": "A", "commence_time": "2026-10-07T00:00:00Z",
        "bookmakers": [
            {"key": "b1", "last_update": "2026-10-06T10:00:00Z",
             "markets": [{"key": "h2h", "last_update": "2026-10-06T09:58:00Z", "outcomes": [
                 {"name": "H", "price": 1.8}, {"name": "A", "price": 2.0}]}]},
            {"key": "b2", "last_update": "2026-10-06T08:00:00Z",
             "markets": [{"key": "h2h", "outcomes": [
                 {"name": "H", "price": 1.7}, {"name": "A", "price": 2.1}]}]},
        ],
    }]
    books = parse_h2h_events(payload)[0]["books"]
    assert books[0]["last_update"] == "2026-10-06T09:58:00Z"  # timestamp del mercato
    assert books[1]["last_update"] == "2026-10-06T08:00:00Z"  # fallback del bookmaker
    mkt = market_consensus(books)  # n pari: età = la più vecchia dei due centrali
    assert mkt["last_update"] == "2026-10-06T08:00:00Z"
    pin = market_consensus([{**books[0], "book": "pinnacle"}])
    assert pin["last_update"] == "2026-10-06T09:58:00Z"


# ── 4. MLB doubleheader: mai un evento quote già iniziato, il più vicino ──────

def _game(when, home="New York Yankees", away="Baltimore Orioles"):
    return {"gamePk": 1, "gameDate": when, "status": {"abstractGameState": "Preview"},
            "teams": {"home": {"team": {"id": 147, "name": home}},
                      "away": {"team": {"id": 110, "name": away}}}}


def _ev(eid, when, home="New York Yankees", away="Baltimore Orioles"):
    return {"event_id": eid, "home_team": home, "away_team": away,
            "commence_time": when, "books": []}


def test_doubleheader_game2_never_takes_live_game1_odds():
    # 25/09/2026: gara 1 già live (quote in-game), gara 2 entro ±3h da lei
    now = datetime(2026, 9, 25, 19, 0, tzinfo=timezone.utc)
    g1_live = _ev("g1", "2026-09-25T17:05:00Z")
    g2 = _ev("g2", "2026-09-25T20:45:00Z")
    events = [g1_live, g2]
    got = match_odds_event(_game("2026-09-25T19:50:00Z"), events, now=now)
    assert got is g2
    assert events == [g1_live]


def test_doubleheader_only_a_started_event_means_no_match():
    now = datetime(2026, 9, 25, 19, 0, tzinfo=timezone.utc)
    events = [_ev("g1", "2026-09-25T17:05:00Z")]
    assert match_odds_event(_game("2026-09-25T19:50:00Z"), events, now=now) is None
    assert len(events) == 1


def test_match_picks_the_closest_event_not_the_first():
    now = datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)
    far = _ev("far", "2026-09-25T18:30:00Z")
    near = _ev("near", "2026-09-25T20:45:00Z")
    events = [far, near]
    assert match_odds_event(_game("2026-09-25T20:40:00Z"), events, now=now) is near


# ── 5. MLB cap squadra 14 giorni (v2.3 del lab) ───────────────────────────────

NOW = datetime(2026, 9, 20, 18, 0, tzinfo=timezone.utc)


def _pick(home, away, pick, days_ago):
    return {"home_team": home, "away_team": away, "pick": pick,
            "published_at": (NOW - timedelta(days=days_ago)).isoformat()}


def test_team_cap_blocks_the_picked_team_against_any_opponent():
    recent = [_pick("Los Angeles Dodgers", "San Francisco Giants", "HOME", 10)]
    assert team_capped("Los Angeles Dodgers", NOW, recent)          # avversario diverso
    assert not team_capped("San Francisco Giants", NOW, recent)     # l'avversario non è stato scelto
    assert not team_capped("Los Angeles Dodgers", NOW,
                           [_pick("Los Angeles Dodgers", "San Francisco Giants", "HOME", 15)])
    assert team_capped("San Diego Padres", NOW,
                       [_pick("Los Angeles Dodgers", "San Diego Padres", "AWAY", 3)])


def test_team_cap_is_fail_closed_on_unreadable_pick_or_date():
    no_pick = [{"home_team": "A", "away_team": "B", "published_at": NOW.isoformat()}]
    assert picked_teams(no_pick[0]) == ["a", "b"]
    assert team_capped("B", NOW, no_pick)
    assert team_capped("A", NOW, [{"home_team": "A", "away_team": "B", "pick": "HOME",
                                    "published_at": "boh"}])


# ── 5+6. ciclo MLB: cap squadra cablato e storico illeggibile = zero pick ─────

def _wire_mlb_cycle(monkeypatch, recent):
    now = datetime.now(timezone.utc)
    start = (now + timedelta(hours=3)).isoformat().replace("+00:00", "Z")
    game = {
        "gamePk": 99, "gameDate": start, "status": {"abstractGameState": "Preview"},
        "teams": {
            "home": {"team": {"id": 119, "name": "Los Angeles Dodgers"},
                     "probablePitcher": {"id": 1, "fullName": "P Home"}},
            "away": {"team": {"id": 135, "name": "San Diego Padres"},
                     "probablePitcher": {"id": 2, "fullName": "P Away"}},
        },
    }
    rec = {"wins": 60, "losses": 40, "runsScored": 500, "runsAllowed": 400}

    async def schedule(_d):
        return [game]

    async def standings(_s):
        return {119: dict(rec), 135: dict(rec)}

    async def prev(_s):
        return {"lgFip": 4.0, "winpct": {}}

    async def h2h(_l):
        return [{"event_id": "e", "home_team": "Los Angeles Dodgers",
                 "away_team": "San Diego Padres", "commence_time": start,
                 "books": [_book("pinnacle", 1.33, 3.40)]}]  # p_home ~0,72

    async def fip(_pid, _season, lg):
        return {"fip": lg, "games": 20, "starts": 20}

    written = []

    async def upsert(rows):
        written.extend(rows)
        return len(rows)

    async def fetch(_sport, _days):
        return recent

    for name, fn in (("get_schedule", schedule), ("get_standings", standings),
                     ("get_prev_season", prev), ("get_h2h_events", h2h),
                     ("get_pitcher_fip", fip), ("upsert_unified_rows", upsert),
                     ("fetch_recent_sport_pairs", fetch)):
        monkeypatch.setattr(mlb, name, fn)
    return written


async def test_mlb_cycle_publishes_when_history_is_readable_and_empty(monkeypatch):
    written = _wire_mlb_cycle(monkeypatch, [])
    assert await mlb.BaseballModelAgent()._compute_cycle() == 1
    assert written[0]["home_team"] == "Los Angeles Dodgers"


async def test_mlb_cycle_team_cap_blocks_a_new_opponent(monkeypatch):
    recent = [{"home_team": "San Francisco Giants", "away_team": "Los Angeles Dodgers",
               "pick": "AWAY",
               "published_at": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()}]
    written = _wire_mlb_cycle(monkeypatch, recent)
    assert await mlb.BaseballModelAgent()._compute_cycle() == 0
    assert written == []


async def test_mlb_cycle_unreadable_history_means_no_new_picks(monkeypatch):
    written = _wire_mlb_cycle(monkeypatch, None)  # None = lettura fallita
    assert await mlb.BaseballModelAgent()._compute_cycle() == 0
    assert written == []


# ── 6. fetch_recent_sport_pairs distingue errore da vuoto ─────────────────────

class _Resp:
    def __init__(self, status, payload):
        self.status_code, self._payload, self.text = status, payload, str(payload)

    def json(self):
        return self._payload


def _fake_client(result):
    class _C:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            if isinstance(result, Exception):
                raise result
            return result
    return _C


@pytest.mark.parametrize("result,expected", [
    (_Resp(200, []), []),
    (_Resp(200, [{"home_team": "A", "away_team": "B", "pick": "HOME",
                  "published_at": "2026-10-01T00:00:00Z"}]), "rows"),
    (_Resp(500, {"message": "boom"}), None),
    (_Resp(200, {"message": "not a list"}), None),
    (RuntimeError("network down"), None),
])
async def test_fetch_recent_sport_pairs_error_is_none_empty_is_list(monkeypatch, result, expected):
    monkeypatch.setattr(sb, "_rest_base", lambda: "http://supabase.test/rest/v1")
    monkeypatch.setattr(sb.httpx, "AsyncClient", _fake_client(result))
    got = await sb.fetch_recent_sport_pairs("baseball", 14)
    if expected == "rows":
        assert isinstance(got, list) and got[0]["pick"] == "HOME"
    else:
        assert got == expected


async def test_fetch_recent_sport_pairs_unconfigured_db_is_none(monkeypatch):
    monkeypatch.setattr(sb, "_rest_base", lambda: None)
    assert await sb.fetch_recent_sport_pairs("baseball", 14) is None


# ── 7. UFC: appartenenza del bout alla card, nomi normalizzati ────────────────

CARD = {
    "name": "UFC 332 Silva vs Wang",
    "start_ms": datetime(2026, 10, 3, 21, 0, tzinfo=timezone.utc).timestamp() * 1000,
    "text": "UFC 332 Silva vs Wang  UFC 332 heads to Salt Lake City as Natalia Silva "
            "faces Wang Cong in the main event at Delta Center.",
}


def test_normalize_name_tokens_strips_accents_and_order():
    assert normalize_name_tokens("Natália Silva") == normalize_name_tokens("silva natalia")
    assert normalize_name_tokens("Cong Wang") == normalize_name_tokens("Wang Cong")
    assert normalize_name_tokens("Sean O’Malley") == normalize_name_tokens("Sean O'Malley")


def test_bout_in_card_requires_both_fighters_named():
    assert bout_in_card("Natália Silva", "Cong Wang", CARD)
    assert not bout_in_card("Natália Silva", "Someone Else", CARD)
    assert not bout_in_card("Fighter A", "Fighter B", {"name": "UFC Fight Night", "text": ""})


def test_verify_bout_card_levels():
    t = CARD["start_ms"] + 2 * 3.6e6
    assert verify_bout_card("Natália Silva", "Cong Wang", t, [CARD]) == (CARD["name"], "bout_in_card")
    assert verify_bout_card("Fighter A", "Fighter B", t, [CARD]) == (CARD["name"], "time_only")
    assert verify_bout_card("Fighter A", "Fighter B", t + 24 * 3.6e6, [CARD]) == (None, None)


def test_time_only_row_does_not_claim_org_verified():
    ev = {"event_id": "x", "home_team": "Fighter A", "away_team": "Fighter B",
          "commence_time": "2026-10-03T23:00:00Z", "books": []}
    mkt = {"p_home": 0.74, "source": "pinnacle", "n_books": 5,
           "odds_home": 1.35, "odds_away": 3.2}
    kw = dict(ev=ev, mkt=mkt, tier="standard", ufc_event="UFC 332",
              hours_to_fight=10.0, flags=[], now_iso="2026-10-03T13:00:00+00:00")
    assert mma_row(**kw, org_verification="time_only")["enrichment"]["org_verified"] is False
    enr = mma_row(**kw, org_verification="bout_in_card")["enrichment"]
    assert enr["org_verified"] is True and enr["org_verification"] == "bout_in_card"


# ── 8. UFC: card di sviluppo (DWCS / Road to UFC) escluse ─────────────────────

def test_is_development_card():
    assert is_development_card("Dana Whites Contender Series season 10 Week 9")  # come TheSportsDB
    assert is_development_card("Dana White's Contender Series 2026: Week 3")
    assert is_development_card("Road to UFC Season 4: Episode 2")
    assert not is_development_card("UFC 332 Silva vs Wang")
    assert not is_development_card(None)


def _wire_mma_cycle(monkeypatch, card_name, card_text=""):
    now = datetime.now(timezone.utc)
    start = now + timedelta(hours=10)
    ev = {"event_id": "f1", "home_team": "Fighter A", "away_team": "Fighter B",
          "commence_time": start.isoformat().replace("+00:00", "Z"),
          "books": [_book("pinnacle", 1.30, 3.60)]}  # p_home ~0,73

    async def h2h(_l):
        return [ev]

    async def windows():
        return [{"name": card_name, "start_ms": start.timestamp() * 1000, "text": card_text}]

    written = []

    async def upsert(rows):
        written.extend(rows)
        return len(rows)

    monkeypatch.setattr(mma, "get_h2h_events", h2h)
    monkeypatch.setattr(mma, "get_ufc_windows", windows)
    monkeypatch.setattr(mma, "upsert_unified_rows", upsert)
    return written


async def test_mma_cycle_excludes_development_cards(monkeypatch):
    written = _wire_mma_cycle(monkeypatch, "Dana Whites Contender Series season 10 Week 9")
    assert await mma.MmaModelAgent()._compute_cycle() == 0
    assert written == []


async def test_mma_cycle_main_card_time_only_is_published_but_not_verified(monkeypatch):
    written = _wire_mma_cycle(monkeypatch, "UFC Fight Night Royval vs Taira")
    assert await mma.MmaModelAgent()._compute_cycle() == 1
    enr = written[0]["enrichment"]
    assert enr["org_verified"] is False and enr["org_verification"] == "time_only"


async def test_mma_cycle_main_card_naming_both_fighters_is_verified(monkeypatch):
    written = _wire_mma_cycle(monkeypatch, "UFC 400 A vs B",
                              "UFC 400 Fighter A vs Fighter B main event")
    assert await mma.MmaModelAgent()._compute_cycle() == 1
    assert written[0]["enrichment"]["org_verified"] is True
