"""Stake/Roobet shadow-eval — pure builders + settlement metrics (#SPORTSBOOK-SHADOW-1).

Forward-only A/B harness. Question Andrea wants answered on the numbers: does
folding Stake/Roobet quotes into our predictions IMPROVE or DEGRADE calibration
vs the market source we already use? A historical backtest is impossible (we
only have Stake/Roobet from 2026-06-11 on), so we snapshot every served
prediction with a per-book SHADOW variant and settle it forward.

This module is PURE (no DB, no model recompute, no side effects):
  - build_* produce the per-prediction row payload the writer persists;
  - the metric helpers (brier/log_loss/clv/realized_edge) are applied at
    settlement and in the report.

The shadow re-uses the EXACT served blend functions (core/market_blend,
core/tennis_market_blend) so the only thing that changes between baseline and
shadow is the ODDS SOURCE — never the math. Fail-closed: an unusable / absent
book quote yields matched=False and shadow==baseline, so a row can never gain
fabricated market information and the eval never overstates coverage.
"""
from __future__ import annotations

import math

from core.market_blend import MARKET_BLEND_ALPHA, blend_with_market, devig_1x2
from core.tennis_market_blend import (
    TENNIS_MARKET_BLEND_ALPHA,
    blend_tennis,
    devig_2way,
)

_EPS = 1e-12


# ─── builders ──────────────────────────────────────────────────────────────────

def build_football_shadow(
    *,
    base_probs: tuple[float, float, float],
    book: dict | None,
    alpha: float = MARKET_BLEND_ALPHA,
) -> dict:
    """Build the football (1X2) shadow leg for one book.

    ``base_probs`` = the SERVED triple (model already blended with the live
    market source) — read, never recomputed. ``book`` = a single book's odds
    {odds_home, odds_draw, odds_away}. Returns the de-vigged book probs (for
    diagnostics), the shadow blend, and an honest ``matched`` flag.
    """
    p_home, p_draw, p_away = base_probs
    market = (
        devig_1x2(book.get("odds_home"), book.get("odds_draw"), book.get("odds_away"))
        if book
        else None
    )
    sh, sd, sa = blend_with_market(p_home, p_draw, p_away, market, alpha=alpha)
    return {
        "matched": market is not None,
        "book_p_home": market["home"] if market else None,
        "book_p_draw": market["draw"] if market else None,
        "book_p_away": market["away"] if market else None,
        "shadow_p_home": sh,
        "shadow_p_draw": sd,
        "shadow_p_away": sa,
        "odds_home": (book or {}).get("odds_home"),
        "odds_draw": (book or {}).get("odds_draw"),
        "odds_away": (book or {}).get("odds_away"),
    }


def build_tennis_shadow(
    *,
    base_probs: tuple[float, float],
    book: dict | None,
    alpha: float = TENNIS_MARKET_BLEND_ALPHA,
) -> dict:
    """Build the tennis (2-way match-winner) shadow leg for one book."""
    p1, p2 = base_probs
    market = (
        devig_2way(book.get("odds_p1"), book.get("odds_p2")) if book else None
    )
    b1, b2 = blend_tennis(p1, p2, market, alpha=alpha)
    return {
        "matched": market is not None,
        "book_p1": market["p1"] if market else None,
        "book_p2": market["p2"] if market else None,
        "shadow_p1": b1,
        "shadow_p2": b2,
        "odds_p1": (book or {}).get("odds_p1"),
        "odds_p2": (book or {}).get("odds_p2"),
    }


# ─── settlement metrics ────────────────────────────────────────────────────────

def argmax_pick(probs: tuple[float, ...]) -> int:
    """Index of the picked outcome (0=home/p1, 1=draw, 2=away/p2)."""
    return max(range(len(probs)), key=lambda i: probs[i])


def brier_score(probs: tuple[float, ...], outcome_idx: int) -> float:
    """Multiclass Brier: sum_k (p_k - y_k)^2. Lower is better."""
    return sum(
        (p - (1.0 if i == outcome_idx else 0.0)) ** 2 for i, p in enumerate(probs)
    )


def log_loss_outcome(probs: tuple[float, ...], outcome_idx: int) -> float:
    """Negative log-likelihood of the realized outcome, clamped to stay finite."""
    p = max(_EPS, min(1.0 - _EPS, probs[outcome_idx]))
    return -math.log(p)


def clv(*, taken_odds: float | None, closing_odds: float | None) -> float | None:
    """Closing Line Value: implied-prob movement in our favour.

    Positive means we priced/took a price better than the close (the standard
    leading indicator of edge). CLV = (1/closing) - (1/taken) in probability
    space; None when either price is missing.
    """
    try:
        t, c = float(taken_odds or 0), float(closing_odds or 0)
    except (TypeError, ValueError):
        return None
    if t <= 1.0 or c <= 1.0:
        return None
    return (1.0 / c) - (1.0 / t)


def realized_edge(*, pick_prob: float, pick_odds: float | None) -> float | None:
    """Model edge on the picked outcome at the given price: p - 1/odds."""
    try:
        o = float(pick_odds or 0)
    except (TypeError, ValueError):
        return None
    if o <= 1.0:
        return None
    return pick_prob - (1.0 / o)
