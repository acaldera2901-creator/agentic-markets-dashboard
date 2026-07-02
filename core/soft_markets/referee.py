"""Referee card-rate multiplier for the soft-markets CARDS model.

Referees materially change the card count (backtest: +~0.9% Brier over team-only,
scripts/backtest_soft_referee.py). This applies a per-referee multiplier to the
cards λ. Table built by scripts/build_referee_rates.py → data/referee_card_rates.json.

FAIL-SAFE: an unknown or thinly-sampled referee → multiplier 1.0 (no adjustment, no
data discarded). Coverage grows as the table does — works for any league + the World
Cup once those referees enter the table (API-Football exposes fixture.referee for all).
"""
from __future__ import annotations

import json
from pathlib import Path

_TABLE: dict | None = None
_PATH = Path(__file__).resolve().parents[2] / "data" / "referee_card_rates.json"


def norm_ref(name: str) -> str:
    """Normalize referee names across sources (shared with build_referee_rates)."""
    s = (name or "").lower().replace(".", " ").replace(",", " ")
    toks = [t for t in s.split() if t and t not in ("england", "jr", "sr")]
    return " ".join(toks).strip()


def _table() -> dict:
    global _TABLE
    if _TABLE is None:
        try:
            _TABLE = json.loads(_PATH.read_text()) if _PATH.exists() else {}
        except Exception:  # noqa: BLE001 — never let a bad table break predictions
            _TABLE = {}
    return _TABLE


def referee_multiplier(name: str | None) -> float:
    """Cards λ multiplier for this referee, or 1.0 if unknown/thin (fail-safe)."""
    t = _table()
    refs = t.get("refs") or {}
    r = refs.get(norm_ref(name or ""))
    if not r:
        return 1.0
    if r.get("n", 0) < t.get("min_matches", 5):
        return 1.0
    m = r.get("mult", 1.0)
    # clamp to a sane band so a noisy table entry can't distort λ absurdly
    return float(min(1.5, max(0.6, m)))
