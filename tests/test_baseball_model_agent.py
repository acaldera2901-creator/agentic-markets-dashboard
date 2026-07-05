"""
Tests for the MLB ingestion agent (#NEWSPORTS Gate 2) — pure functions only,
no network. Contract under test: probability served = market devig + floor
(the model never moves it); tiers per settings (PROVISIONAL floors 62/65);
warm-up and doubleheader rules from the Gate 1 report / lab audits.
"""
import json

import pytest

from agents.baseball_model_agent import (
    assign_tier,
    build_unified_row,
    log5,
    match_odds_event,
    model_home_prob,
    pyth_prior_rating,
)
from config.settings import settings
from core.odds_api_client import devig_two_way, market_consensus


# ── market math (odds_api_client helpers shared with the MMA agent) ───────────

def test_devig_two_way_matches_lab_formula():
    # 1.52 / 2.63 → implied .6579/.3802 → devig home = .6337
    assert devig_two_way(1.52, 2.63) == pytest.approx(0.6337, abs=1e-4)


def test_devig_two_way_rejects_degenerate_prices():
    assert devig_two_way(1.0, 2.5) is None
    assert devig_two_way(0, 2.5) is None
    assert devig_two_way(1.8, None) is None


def test_market_consensus_prefers_pinnacle():
    books = [
        {"book": "bet365", "p_home": 0.60, "odds_home": 1.6, "odds_away": 2.4},
        {"book": "pinnacle", "p_home": 0.65, "odds_home": 1.5, "odds_away": 2.7},
        {"book": "unibet", "p_home": 0.62, "odds_home": 1.58, "odds_away": 2.5},
    ]
    mkt = market_consensus(books)
    assert mkt["p_home"] == 0.65
    assert mkt["source"] == "pinnacle"
    assert mkt["n_books"] == 3


def test_market_consensus_true_median_odd_and_even():
    def b(p):
        return {"book": f"b{p}", "p_home": p, "odds_home": 1.9, "odds_away": 1.9}
    # odd n → middle element
    assert market_consensus([b(0.55), b(0.70), b(0.60)])["p_home"] == 0.60
    # even n → average of the two middle elements (lab audit B4)
    mkt = market_consensus([b(0.50), b(0.60), b(0.70), b(0.80)])
    assert mkt["p_home"] == pytest.approx(0.65)
    assert mkt["source"] == "median"


def test_market_consensus_empty_is_none():
    assert market_consensus([]) is None


# ── model (why/warning only — probability-neutral contract) ───────────────────

def test_log5_symmetry_and_home_edge():
    assert log5(0.5, 0.5) == pytest.approx(0.5)
    assert log5(0.6, 0.4) > 0.5


def test_pyth_prior_rating_no_games_returns_blended_prior():
    # 0 games → 0.5*0.5 + 0.5*prev_wp
    assert pyth_prior_rating({"wins": 0, "losses": 0, "runsScored": 0, "runsAllowed": 0}, 0.6) == pytest.approx(0.55)
    assert pyth_prior_rating(None, None) == pytest.approx(0.5)


def test_model_home_prob_fip_mismatch_moves_the_model_not_the_market():
    base = model_home_prob(0.5, 0.5, 4.0, 4.0)
    better_home_sp = model_home_prob(0.5, 0.5, 3.0, 5.0)  # home FIP much better
    assert better_home_sp > base


# ── tiers (floors from settings, inclusive; disagreement caps the tier) ───────

def test_assign_tier_boundaries_and_warmup():
    assert assign_tier(0.61, True, True) is None
    assert assign_tier(0.62, True, True) == "standard"
    assert assign_tier(0.65, True, True) == "premium"
    # warm-up blocks everything
    assert assign_tier(0.70, True, False) is None


def test_assign_tier_disagreement_blocks_premium_not_standard():
    assert assign_tier(0.66, False, True) == "standard"
    assert assign_tier(0.63, False, True) == "standard"


def test_assign_tier_reads_settings_not_hardcoded(monkeypatch):
    monkeypatch.setattr(settings, "SURFACE_FLOOR_BASEBALL", 64)
    monkeypatch.setattr(settings, "NEWSPORT_BASEBALL_PREMIUM", 68)
    assert assign_tier(0.63, True, True) is None
    assert assign_tier(0.64, True, True) == "standard"
    assert assign_tier(0.68, True, True) == "premium"


# ── odds matching (lab audit C2: doubleheaders) ────────────────────────────────

def _game(pk, home="Los Angeles Dodgers", away="San Diego Padres",
          when="2026-07-05T22:10:00Z"):
    return {
        "gamePk": pk,
        "gameDate": when,
        "status": {"abstractGameState": "Preview"},
        "teams": {
            "home": {"team": {"id": 119, "name": home}, "probablePitcher": {"id": 1, "fullName": "P Home"}},
            "away": {"team": {"id": 135, "name": away}, "probablePitcher": {"id": 2, "fullName": "P Away"}},
        },
    }


def _event(when="2026-07-05T22:05:00Z", home="Los Angeles Dodgers", away="San Diego Padres"):
    return {"event_id": "ev1", "home_team": home, "away_team": away,
            "commence_time": when, "books": []}


def test_match_odds_event_requires_teams_and_time_window():
    events = [_event()]
    assert match_odds_event(_game(1), events) is not None
    assert events == []  # matched event is consumed (doubleheader safety)

    # same teams but 8h away (the OTHER doubleheader game) → no match
    events = [_event(when="2026-07-05T14:00:00Z")]
    assert match_odds_event(_game(2), events) is None
    assert len(events) == 1


def test_match_odds_event_doubleheader_pairs_each_game_once():
    ev_day = _event(when="2026-07-05T17:00:00Z")
    ev_night = _event(when="2026-07-05T23:30:00Z")
    events = [ev_day, ev_night]
    got_day = match_odds_event(_game(1, when="2026-07-05T17:05:00Z"), events)
    got_night = match_odds_event(_game(2, when="2026-07-05T23:10:00Z"), events)
    assert got_day is ev_day and got_night is ev_night
    assert events == []


# ── unified row contract (docs/NEWSPORTS-INTEGRATION.md) ──────────────────────

def test_build_unified_row_contract():
    game = _game(824012)
    mkt = {"p_home": 0.657, "source": "pinnacle", "n_books": 30,
           "odds_home": 1.52, "odds_away": 2.63}
    recs = {119: {"wins": 59, "losses": 31, "runsScored": 500, "runsAllowed": 350},
            135: {"wins": 43, "losses": 45, "runsScored": 380, "runsAllowed": 420}}
    row = build_unified_row(
        game=game, mkt=mkt, p_model=0.709, tier="premium", season=2026,
        sp_home="Emmet Sheehan", sp_away="JP Sears",
        fip_home=4.54, fip_away=5.10, flags=[], recs=recs,
        now_iso="2026-07-05T15:00:00+00:00",
    )
    assert row["sport"] == "baseball"
    assert row["source_table"] == "mlb_model"
    assert row["source_id"] == "824012"          # str, stable dedup key
    assert row["league"] == "MLB"
    assert row["pick"] == "HOME"                  # p_home .657 → favourite home
    assert row["p_draw"] is None                  # 2-outcome sport
    assert row["confidence_score"] == 66
    assert row["edge_percent"] is None            # market-anchored, no edge claim
    assert row["signal_type"] == "paper"          # DARK phase
    assert row["is_historical"] is False and row["is_demo"] is False
    assert row["published_at"] and row["expires_at"] == game["gameDate"]
    notes = json.loads(row["notes"])
    assert notes["mkt_source"] == "pinnacle" and notes["n_books"] == 30
    enr = row["enrichment"]
    assert enr["sp_home"] == "Emmet Sheehan"
    assert enr["model_agrees"] is True
    assert enr["tier"] == "premium"
    assert enr["record_home"] == "59-31"


def test_build_unified_row_away_pick():
    game = _game(824013)
    mkt = {"p_home": 0.3798, "source": "pinnacle", "n_books": 31,
           "odds_home": 2.6, "odds_away": 1.55}
    row = build_unified_row(
        game=game, mkt=mkt, p_model=0.4545, tier="standard", season=2026,
        sp_home="A", sp_away="B", fip_home=4.5, fip_away=3.1,
        flags=[], recs={}, now_iso="2026-07-05T15:00:00+00:00",
    )
    assert row["pick"] == "AWAY"
    assert row["confidence_score"] == 62
    assert row["odds"] == 1.55                    # pick-side odds
    assert row["enrichment"]["model_agrees"] is True  # both < 0.5 → agree on away
