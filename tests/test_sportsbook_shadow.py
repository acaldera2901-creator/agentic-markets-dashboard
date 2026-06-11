"""Tests for the Stake/Roobet shadow-eval harness (#SPORTSBOOK-SHADOW-1).

Forward-only A/B: every served prediction is snapshotted with its baseline
(market source already used) and per-book SHADOW probabilities (the served
model probs re-blended with Stake/Roobet quotes via the SAME devig/blend
functions). The served path is NEVER touched — these are pure builders +
settlement metrics, no DB and no model recompute.

Invariants under test:
  - baseline probs are passed through untouched (we read what the model serves);
  - shadow blend reuses core/*market_blend exactly, fail-closed on bad odds;
  - coverage flags are honest (no book quote -> matched=False, shadow==baseline);
  - football (3-way) and tennis (2-way) both map;
  - settlement metrics (Brier, log-loss, CLV, realized edge) match hand calc.
"""
import math

import pytest

from core import sportsbook_shadow as ss


# ─── football 3-way ────────────────────────────────────────────────────────────

def test_football_shadow_blends_with_book_odds():
    base = (0.50, 0.30, 0.20)  # served model+market(theoddsapi) triple
    book = {"odds_home": 2.0, "odds_draw": 3.5, "odds_away": 4.0}
    row = ss.build_football_shadow(
        base_probs=base, book=book, alpha=0.3
    )
    assert row["matched"] is True
    # de-vigged then convex blended; simplex preserved
    bp = (row["shadow_p_home"], row["shadow_p_draw"], row["shadow_p_away"])
    assert abs(sum(bp) - 1.0) < 1e-9
    # the blend must MOVE the probs toward the (market-dominant) book
    assert bp != base


def test_football_shadow_no_book_is_identity_and_unmatched():
    base = (0.50, 0.30, 0.20)
    row = ss.build_football_shadow(base_probs=base, book=None, alpha=0.3)
    assert row["matched"] is False
    assert (row["shadow_p_home"], row["shadow_p_draw"], row["shadow_p_away"]) == base


def test_football_shadow_bad_odds_fail_closed():
    base = (0.50, 0.30, 0.20)
    bad = {"odds_home": 0.0, "odds_draw": None, "odds_away": 4.0}
    row = ss.build_football_shadow(base_probs=base, book=bad, alpha=0.3)
    assert row["matched"] is False
    assert (row["shadow_p_home"], row["shadow_p_draw"], row["shadow_p_away"]) == base


# ─── tennis 2-way ────────────────────────────────────────────────────────────

def test_tennis_shadow_blends_two_way():
    base = (0.65, 0.35)
    book = {"odds_p1": 1.5, "odds_p2": 2.6}
    row = ss.build_tennis_shadow(base_probs=base, book=book, alpha=0.3)
    assert row["matched"] is True
    assert abs(row["shadow_p1"] + row["shadow_p2"] - 1.0) < 1e-9
    assert (row["shadow_p1"], row["shadow_p2"]) != base


def test_tennis_shadow_no_book_identity():
    base = (0.65, 0.35)
    row = ss.build_tennis_shadow(base_probs=base, book=None, alpha=0.3)
    assert row["matched"] is False
    assert (row["shadow_p1"], row["shadow_p2"]) == base


# ─── settlement metrics ────────────────────────────────────────────────────────

def test_brier_three_way():
    # outcome HOME (index 0); probs put 0.5 on it
    b = ss.brier_score((0.5, 0.3, 0.2), 0)
    # (0.5-1)^2 + (0.3-0)^2 + (0.2-0)^2 = .25+.09+.04 = .38
    assert abs(b - 0.38) < 1e-9


def test_log_loss_clamped():
    # perfect-miss is clamped, never infinite
    ll = ss.log_loss_outcome((0.0, 0.0, 1.0), 0)
    assert math.isfinite(ll)
    assert ll > 0


def test_clv_uses_closing_price():
    # took 2.0, closing 1.8 -> positive CLV (we beat the close)
    clv = ss.clv(taken_odds=2.0, closing_odds=1.8)
    assert clv > 0
    # took 1.8, closing 2.0 -> negative
    assert ss.clv(taken_odds=1.8, closing_odds=2.0) < 0
    # no closing -> None
    assert ss.clv(taken_odds=2.0, closing_odds=None) is None


def test_realized_edge_and_hit():
    # pick prob 0.6 at odds 2.0 -> edge = 0.6 - 0.5 = 0.10; won -> hit 1
    assert abs(ss.realized_edge(pick_prob=0.6, pick_odds=2.0) - 0.10) < 1e-9
    assert ss.realized_edge(pick_prob=0.6, pick_odds=None) is None


def test_pick_from_triple():
    assert ss.argmax_pick((0.5, 0.3, 0.2)) == 0
    assert ss.argmax_pick((0.2, 0.5, 0.3)) == 1
    assert ss.argmax_pick((0.2, 0.3, 0.5)) == 2
