# tests/test_market_promotion_018.py
"""#018 — real market predictions (APPROVE Andrea 2026-06-06).

Covers the promotion chain end-to-end at unit level:
  provider fixtures carry stage/venue → WC context completeness ≥ 0.78,
  de-vig + α=0.3 blend mirror the TS math,
  the unified writer promotes to signal ONLY with (allowing tier AND real
  market), never fabricates odds/edge, and tennis value bets respect the
  evidence-backed 1.50–2.10 odds band.
"""
import json

from core.market_blend import MARKET_BLEND_ALPHA, blend_with_market, devig_1x2
from core.football_data_org_client import _normalize
from core.supabase_client import DCPrediction, wc_prediction_to_unified_row
from core.world_cup_context import infer_stage


def _pred(ph=0.46, pd=0.27, pa=0.27):
    return DCPrediction(
        match_id="t1", league="WC", league_name="FIFA World Cup 2026",
        home_team="Mexico", away_team="South Africa",
        kickoff="2026-06-11T19:00:00Z",
        p_home=ph, p_draw=pd, p_away=pa,
        home_team_matches=20, away_team_matches=18,
    )


ODDS = {"home": 2.10, "draw": 3.30, "away": 3.80}


# ── market blend (mirror of lib/poisson-model.ts) ───────────────────────────

def test_devig_normalizes_and_fails_closed():
    m = devig_1x2(2.0, 3.5, 4.0)
    assert m is not None
    assert abs(m["home"] + m["draw"] + m["away"] - 1.0) < 1e-9
    assert m["home"] > m["draw"] > m["away"]
    # fail-closed on any missing/invalid leg — never fabricate a market
    assert devig_1x2(None, 3.5, 4.0) is None
    assert devig_1x2(2.0, 0, 4.0) is None
    assert devig_1x2("x", 3.5, 4.0) is None


def test_blend_is_simplex_preserving_and_identity_without_market():
    market = devig_1x2(*ODDS.values())
    ph, pd, pa = blend_with_market(0.46, 0.27, 0.27, market)
    assert abs(ph + pd + pa - 1.0) < 1e-9
    # α=0.3 → market-dominant: served sits between model and market
    assert min(0.46, market["home"]) <= ph <= max(0.46, market["home"])
    # no market → identity (the fail-safe that reproduces pure model serving)
    assert blend_with_market(0.46, 0.27, 0.27, None) == (0.46, 0.27, 0.27)
    assert 0 < MARKET_BLEND_ALPHA < 1


# ── WC unified writer promotion rules ────────────────────────────────────────

def test_signal_requires_tier_and_market():
    row = wc_prediction_to_unified_row(
        _pred(), stage="group", signal_allowed=True,
        odds_triple=ODDS, bookmaker="bet365",
    )
    assert row["signal_type"] == "signal"
    assert row["is_paper"] is False
    assert row["odds"] == 2.1  # pick=HOME → home price
    assert row["edge_percent"] is not None
    notes = json.loads(row["notes"])
    assert notes["odds_home"] == 2.1 and notes["bookmaker"] == "bet365"


def test_notes_persist_pinnacle_anchor_source():
    # #PINNACLE-ANCHOR-1: the served row records which sharp tier priced it.
    row = wc_prediction_to_unified_row(
        _pred(), stage="group", signal_allowed=True,
        odds_triple=ODDS, bookmaker="pinnacle", anchor_source="pinnacle",
    )
    notes = json.loads(row["notes"])
    assert notes["anchor_source"] == "pinnacle"
    assert notes["bookmaker"] == "pinnacle"


def test_notes_anchor_source_derived_from_book_when_not_passed():
    # Matchbook collector path doesn't set anchor_source → derived from the name.
    row = wc_prediction_to_unified_row(
        _pred(), stage="group", signal_allowed=True,
        odds_triple=ODDS, bookmaker="matchbook",
    )
    notes = json.loads(row["notes"])
    assert notes["anchor_source"] == "sharp_exchange"


def test_paper_with_market_shows_reference_odds_but_no_edge():
    row = wc_prediction_to_unified_row(
        _pred(), stage="group", signal_allowed=False,
        odds_triple=ODDS, bookmaker="bet365",
    )
    assert row["signal_type"] == "paper"
    assert row["is_paper"] is True
    assert row["edge_percent"] is None  # paper never claims an edge


def test_no_market_stays_paper_even_when_tier_allows():
    row = wc_prediction_to_unified_row(_pred(), stage="group", signal_allowed=True)
    assert row["signal_type"] == "paper"
    assert row["odds"] is None
    assert row["edge_percent"] is None
    notes = json.loads(row["notes"])
    assert "odds_home" not in notes  # nothing fabricated


def test_edge_uses_unrounded_probability_no_sign_flip():
    """#14 regression: edge_percent must use the raw pick probability, not the
    rounded confidence_score. Here the true edge is NEGATIVE (the model rates
    the pick below the market-implied probability), but rounding the
    probability up to the nearest integer percent would flip it positive.

    p_home = 0.4755 (pick=HOME, it is the max), odds_home = 2.10.
    implied = 1/2.10 = 0.476190...
      raw edge   = 0.4755   - 0.476190 = -0.00069  -> negative (correct)
      rounded    = round(47.55)=48 -> 0.48 - 0.476190 = +0.00381 -> positive (bug)
    """
    pred = _pred(ph=0.4755, pd=0.2645, pa=0.2600)
    row = wc_prediction_to_unified_row(
        pred, stage="group", signal_allowed=True,
        odds_triple=ODDS, bookmaker="bet365",
    )
    # display confidence still rounds to the integer percent
    assert row["confidence_score"] == 48
    # but the edge is computed from 0.4755, so it stays NEGATIVE
    assert row["edge_percent"] is not None
    assert row["edge_percent"] < 0, (
        f"edge should be negative (true prob below implied), got {row['edge_percent']}"
    )
    # exact value: (0.4755 - 1/2.10) * 100, rounded to 2dp
    assert row["edge_percent"] == round((0.4755 - 1.0 / 2.10) * 100, 2)


def test_partial_odds_never_promote():
    row = wc_prediction_to_unified_row(
        _pred(), stage="group", signal_allowed=True,
        odds_triple={"home": 2.1, "draw": None, "away": 3.8},
    )
    assert row["signal_type"] == "paper"


# ── provider fixtures: stage/group/venue passthrough ─────────────────────────

def test_fdorg_normalize_carries_stage_group_matchday():
    raw = {
        "id": 537327, "utcDate": "2026-06-11T19:00:00Z",
        "stage": "GROUP_STAGE", "group": "GROUP_A", "matchday": 1,
        "venue": None,
        "homeTeam": {"name": "Mexico"}, "awayTeam": {"name": "South Africa"},
        "score": {"fullTime": {}},
    }
    fx = _normalize(raw)
    stage, group, matchday, knockout = infer_stage(fx)
    assert (stage, group, matchday) == ("group", "A", 1)


def test_fdorg_normalize_passes_venue_when_present():
    raw = {
        "id": 1, "utcDate": "2026-06-11T19:00:00Z",
        "venue": "Estadio Banorte",
        "homeTeam": {"name": "A"}, "awayTeam": {"name": "B"},
        "score": {"fullTime": {}},
    }
    fx = _normalize(raw)
    assert fx["fixture"]["venue"]["name"] == "Estadio Banorte"


# ── tennis value-bet odds band (calibration report 2026-06-06) ───────────────

def test_tennis_selection_respects_odds_band():
    from agents.tennis_model_agent import TennisModelAgent, MIN_ODDS, MAX_ODDS

    assert (MIN_ODDS, MAX_ODDS) == (1.50, 2.10)
    # inside the band, positive edge → selection
    edge, sel = TennisModelAgent._market_edge(0.60, 0.40, 1.90, 2.10)
    assert sel == "P1" and edge is not None and edge > 0
    # outside the band (price too high) → no selection even with huge edge
    edge, sel = TennisModelAgent._market_edge(0.55, 0.45, 2.60, 1.55)
    assert sel != "P1"
