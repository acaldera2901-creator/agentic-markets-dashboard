"""
Tests for the UFC ingestion agent (#NEWSPORTS Gate 2) — pure functions only.
Contract: pick = market favourite above floor (70/75 PROVISIONAL), 2-30h
post-weigh-in window, UFC-only org matching, unified row per the contract doc.
"""
import json

import pytest

from agents.mma_model_agent import (
    MAX_H,
    MIN_H,
    assign_tier,
    build_unified_row,
    match_ufc_event,
)
from config.settings import settings


# ── tiers ─────────────────────────────────────────────────────────────────────

def test_assign_tier_boundaries():
    assert assign_tier(0.69) is None
    assert assign_tier(0.70) == "standard"
    assert assign_tier(0.75) == "premium"
    assert assign_tier(0.9999) == "premium"


def test_assign_tier_reads_settings(monkeypatch):
    monkeypatch.setattr(settings, "SURFACE_FLOOR_MMA", 72)
    monkeypatch.setattr(settings, "NEWSPORT_MMA_PREMIUM", 80)
    assert assign_tier(0.71) is None
    assert assign_tier(0.72) == "standard"
    assert assign_tier(0.80) == "premium"


# ── UFC card window matching (org filter, fail-closed upstream) ───────────────

def test_match_ufc_event_window_minus3_plus9_hours():
    card_start = 1_000_000_000_000.0  # arbitrary epoch ms
    windows = [{"name": "UFC 318", "start_ms": card_start}]
    h = 3.6e6
    assert match_ufc_event(card_start, windows) == "UFC 318"
    assert match_ufc_event(card_start - 3 * h, windows) == "UFC 318"   # early prelims
    assert match_ufc_event(card_start + 9 * h, windows) == "UFC 318"   # main event tail
    assert match_ufc_event(card_start - 4 * h, windows) is None
    assert match_ufc_event(card_start + 10 * h, windows) is None
    assert match_ufc_event(card_start, []) is None                      # no cards → no UFC


def test_pick_window_constants_match_gate1_rules():
    # The 2-30h window IS the anti-substitution rule from the Gate 1 audit —
    # pin it so a refactor can't silently widen it.
    assert (MIN_H, MAX_H) == (2, 30)


# ── unified row contract ──────────────────────────────────────────────────────

def _event():
    return {
        "event_id": "abc123",
        "home_team": "Fighter A",
        "away_team": "Fighter B",
        "commence_time": "2026-07-12T02:00:00Z",
        "books": [],
    }


def test_build_unified_row_contract():
    mkt = {"p_home": 0.74, "source": "pinnacle", "n_books": 6,
           "odds_home": 1.35, "odds_away": 3.20}
    row = build_unified_row(
        ev=_event(), mkt=mkt, tier="standard", ufc_event="UFC 318",
        hours_to_fight=11.4, flags=[], now_iso="2026-07-11T15:00:00+00:00",
    )
    assert row["sport"] == "mma"
    assert row["source_table"] == "ufc_model"
    assert row["source_id"] == "abc123"
    assert row["league"] == "UFC"
    assert row["competition"] == "UFC 318"
    # fighters ride the home/away slots (prod convention, contract doc)
    assert row["home_team"] == "Fighter A" and row["away_team"] == "Fighter B"
    assert row["pick"] == "HOME"
    assert row["p_draw"] is None
    assert row["confidence_score"] == 74
    assert row["odds"] == 1.35
    assert row["edge_percent"] is None
    assert row["signal_type"] == "paper"
    assert row["is_historical"] is False and row["is_demo"] is False
    notes = json.loads(row["notes"])
    assert notes["p_home"] == 0.74 and notes["n_books"] == 6
    enr = row["enrichment"]
    assert enr["org_verified"] is True and enr["window_ok"] is True
    assert enr["hours_to_fight"] == 11.4
    assert enr["tier"] == "standard"


def test_build_unified_row_underdog_side():
    mkt = {"p_home": 0.26, "source": "median", "n_books": 4,
           "odds_home": 3.6, "odds_away": 1.30}
    row = build_unified_row(
        ev=_event(), mkt=mkt, tier="standard", ufc_event="UFC Fight Night",
        hours_to_fight=5.0, flags=[], now_iso="2026-07-11T15:00:00+00:00",
    )
    assert row["pick"] == "AWAY"
    assert row["confidence_score"] == 74
    assert row["odds"] == 1.30
