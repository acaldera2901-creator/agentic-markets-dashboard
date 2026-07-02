"""Build the referee card-rate table used by the soft-markets cards model.

Referees materially affect cards (backtest: +~0.9% Brier over the team-only model,
scripts/backtest_soft_referee.py). This computes, per referee, a shrunk card-rate
multiplier = (referee mean total cards) / (global mean), and writes it to
data/referee_card_rates.json. The live model (core/soft_markets/referee.py) reads it
and multiplies the cards λ; an UNKNOWN referee → multiplier 1.0 (fail-safe, no data
discarded — coverage just grows as the table does).

Source now: football-data.co.uk (referee + HY/AY/HR/AR). Only leagues that populate
Referee contribute (Premier League today). Extensible: pass API-Football-derived
(referee, total_cards) rows to add every league + the World Cup (same-source names
match perfectly). Names are normalized to maximize cross-source matching.

Run:  .venv/bin/python -m scripts.build_referee_rates
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from core.soft_markets.referee import norm_ref  # noqa: E402 — identical normalization

CACHE = ROOT / "data" / "football_data_uk"
OUT = ROOT / "data" / "referee_card_rates.json"
SHRINK = 8.0        # referees need ~8 pseudo-matches before we trust their rate
MIN_MATCHES = 5     # below this we still shrink hard toward 1.0 (mult ≈ 1)


def build(rows: list[tuple[str, int]]) -> dict:
    """rows = [(referee_name, total_cards), ...] → table {global_mean, refs:{key:{n,mult}}}."""
    by_ref: dict[str, list[int]] = defaultdict(list)
    total = 0
    for name, cards in rows:
        k = norm_ref(name)
        if not k:
            continue
        by_ref[k].append(cards)
        total += cards
    n_all = sum(len(v) for v in by_ref.values())
    glob = total / n_all if n_all else 4.5
    refs = {}
    for k, cs in by_ref.items():
        s, n = sum(cs), len(cs)
        shrunk = (s + SHRINK * glob) / (n + SHRINK)  # → glob when n small
        refs[k] = {"n": n, "mult": round(shrunk / glob, 4) if glob else 1.0}
    return {"global_mean": round(glob, 3), "shrink": SHRINK, "min_matches": MIN_MATCHES, "refs": refs}


def rows_from_football_data() -> list[tuple[str, int]]:
    out = []
    for fp in sorted(CACHE.glob("*.csv")):
        for r in csv.DictReader(fp.read_text(encoding="utf-8", errors="replace").splitlines()):
            ref = (r.get("Referee") or "").strip()
            if not ref:
                continue
            try:
                cards = int(r["HY"]) + int(r["AY"]) + int(r["HR"]) + int(r["AR"])
            except (KeyError, ValueError, TypeError):
                continue
            out.append((ref, cards))
    return out


def run() -> None:
    rows = rows_from_football_data()
    table = build(rows)
    OUT.write_text(json.dumps(table, indent=2))
    print(f"referees: {len(table['refs'])}  global_mean_cards={table['global_mean']}  (from {len(rows)} matches)")
    top = sorted(table["refs"].items(), key=lambda kv: kv[1]["mult"], reverse=True)
    print("strictest:", [(k, v["mult"], v["n"]) for k, v in top[:3]])
    print("lenient  :", [(k, v["mult"], v["n"]) for k, v in top[-3:]])
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(run())
