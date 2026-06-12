"""#TRACKREC-PROOF-1 runner — recompute the served track record from the
append-only ledger, deterministically, with zero writes.

Reads two read-only inputs (CSV exports of pick_ledger and pick_settlement, or a
read-only SELECT dump) and recomputes Brier, ECE, accuracy/hit-rate, CLV and ROI
on the picks that were ACTUALLY served — joined on (source_table, source_id,
model_version). The point is reproducibility: anyone can re-run this against an
export of the ledger and get the identical numbers the product publishes.

Determinism: fixed seed, no randomness, no network, no DB writes. Settlements
are append-only — when more than one settlement row exists for a pick the LATEST
by settled_at wins (in-place edits are impossible by migration design, so a
correction is a new row).

Run:
  ./venv/bin/python -m scripts.track_record_proof \
      --ledger export/pick_ledger.csv --settlement export/pick_settlement.csv
"""
from __future__ import annotations

import argparse
import csv
import random
import sys
from collections import defaultdict
from dataclasses import dataclass
from math import log
from pathlib import Path

SEED = 1729
random.seed(SEED)

OUTCOME_TO_IDX = {"HOME": 0, "DRAW": 1, "AWAY": 2}


@dataclass(frozen=True)
class LedgerPick:
    source_table: str
    source_id: str
    model_version: str
    sport: str
    pick: str | None
    p_home: float | None
    p_draw: float | None
    p_away: float | None
    confidence: float | None
    odds: float | None
    is_backfill: bool


@dataclass(frozen=True)
class Settlement:
    result: str
    outcome: str | None
    closing_odds: float | None
    settled_at: str


def _f(v: str | None) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def load_ledger(path: Path) -> dict[tuple[str, str, str], LedgerPick]:
    picks: dict[tuple[str, str, str], LedgerPick] = {}
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            key = (r["source_table"], r["source_id"], r["model_version"])
            picks[key] = LedgerPick(
                source_table=r["source_table"],
                source_id=r["source_id"],
                model_version=r["model_version"],
                sport=r.get("sport", ""),
                pick=(r.get("pick") or None),
                p_home=_f(r.get("p_home")),
                p_draw=_f(r.get("p_draw")),
                p_away=_f(r.get("p_away")),
                confidence=_f(r.get("confidence")),
                odds=_f(r.get("odds")),
                is_backfill=str(r.get("is_backfill", "")).strip().lower()
                in ("true", "t", "1"),
            )
    return picks


def load_settlements(path: Path) -> dict[tuple[str, str, str], Settlement]:
    """Latest settlement per key wins (append-only corrections)."""
    latest: dict[tuple[str, str, str], Settlement] = {}
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            key = (r["source_table"], r["source_id"], r["model_version"])
            s = Settlement(
                result=r["result"],
                outcome=(r.get("outcome") or None),
                closing_odds=_f(r.get("closing_odds")),
                settled_at=r.get("settled_at", ""),
            )
            prev = latest.get(key)
            if prev is None or s.settled_at >= prev.settled_at:
                latest[key] = s
    return latest


# ─── metrics ────────────────────────────────────────────────────────────────
def brier_1x2(p: tuple[float, float, float], outcome_idx: int) -> float:
    target = [0.0, 0.0, 0.0]
    target[outcome_idx] = 1.0
    return sum((pi - ti) ** 2 for pi, ti in zip(p, target))


def ece(pairs: list[tuple[float, int]], bins: int = 10) -> float:
    buckets: dict[int, list[tuple[float, int]]] = defaultdict(list)
    for prob, hit in pairs:
        b = min(int(prob * bins), bins - 1)
        buckets[b].append((prob, hit))
    total = sum(len(v) for v in buckets.values())
    if not total:
        return float("nan")
    err = 0.0
    for items in buckets.values():
        ap = sum(p for p, _ in items) / len(items)
        hr = sum(h for _, h in items) / len(items)
        err += len(items) * abs(ap - hr)
    return err / total


def compute(picks, settlements) -> dict:
    brier_vals: list[float] = []
    cal_pairs: list[tuple[float, int]] = []
    hits = decided = 0
    clv_vals: list[float] = []
    clv_beat = clv_n = 0
    roi_staked = roi_profit = 0.0
    roi_bets = 0
    counted = voided = unresolved = 0

    for key, pk in sorted(picks.items()):  # sorted → deterministic order
        s = settlements.get(key)
        if s is None:
            continue
        if s.result == "unresolved":
            unresolved += 1
            continue
        if s.result == "void" or pk.pick is None:
            voided += 1
            continue
        counted += 1

        # Brier / ECE need a full distribution + realized outcome index.
        if pk.sport == "football" and None not in (pk.p_home, pk.p_draw, pk.p_away):
            oidx = OUTCOME_TO_IDX.get((s.outcome or "").upper())
            if oidx is not None:
                p = (pk.p_home, pk.p_draw, pk.p_away)
                brier_vals.append(brier_1x2(p, oidx))
                pick_idx = OUTCOME_TO_IDX.get((pk.pick or "").upper())
                if pick_idx is not None:
                    cal_pairs.append((p[pick_idx], 1 if pick_idx == oidx else 0))

        won = s.result == "won"
        decided += 1
        hits += 1 if won else 0
        if pk.confidence is not None:
            cal_pairs.append((pk.confidence, 1 if won else 0)) if pk.sport != "football" else None

        # CLV: did our captured odds beat the closing line?
        if pk.odds and s.closing_odds and s.closing_odds > 0:
            clv = pk.odds / s.closing_odds - 1.0
            clv_vals.append(clv)
            clv_beat += 1 if pk.odds > s.closing_odds else 0
            clv_n += 1

        # ROI: flat 1u at the captured odds on every decided pick that had a price.
        if pk.odds:
            roi_staked += 1.0
            roi_bets += 1
            roi_profit += (pk.odds - 1.0) if won else -1.0

    def mean(xs):
        return sum(xs) / len(xs) if xs else float("nan")

    return {
        "n_picks": len(picks),
        "n_settled_counted": counted,
        "n_void": voided,
        "n_unresolved": unresolved,
        "brier": mean(brier_vals),
        "ece": ece(cal_pairs),
        "accuracy": (hits / decided) if decided else float("nan"),
        "clv_mean_pct": (mean(clv_vals) * 100) if clv_vals else float("nan"),
        "clv_beat_pct": (clv_beat / clv_n * 100) if clv_n else float("nan"),
        "clv_n": clv_n,
        "roi_pct": (roi_profit / roi_staked * 100) if roi_staked else float("nan"),
        "roi_bets": roi_bets,
        "roi_profit_u": roi_profit,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="#TRACKREC-PROOF-1 deterministic runner")
    ap.add_argument("--ledger", required=True, type=Path)
    ap.add_argument("--settlement", required=True, type=Path)
    ap.add_argument("--model-version", default=None, help="filter to one model_version")
    ap.add_argument(
        "--cohort",
        choices=("forward", "backfill", "all"),
        default="forward",
        help="forward = look-ahead-proof verified picks (default); backfill = "
        "historical reconstruction; all = both (NEVER publish mixed as verified)",
    )
    args = ap.parse_args(argv)

    picks = load_ledger(args.ledger)
    settlements = load_settlements(args.settlement)
    if args.model_version:
        picks = {k: v for k, v in picks.items() if v.model_version == args.model_version}
    if args.cohort == "forward":
        picks = {k: v for k, v in picks.items() if not v.is_backfill}
    elif args.cohort == "backfill":
        picks = {k: v for k, v in picks.items() if v.is_backfill}

    m = compute(picks, settlements)
    print("=" * 60)
    print(f"#TRACKREC-PROOF-1 (seed={SEED}, deterministic, read-only)")
    print(f"cohort: {args.cohort}")
    if args.model_version:
        print(f"model_version: {args.model_version}")
    print("=" * 60)
    print(f"picks in ledger      : {m['n_picks']}")
    print(f"settled & counted    : {m['n_settled_counted']}")
    print(f"void / unresolved    : {m['n_void']} / {m['n_unresolved']}")
    print(f"Brier (1X2)          : {m['brier']:.5f}")
    print(f"ECE                  : {m['ece']:.5f}")
    print(f"accuracy / hit-rate  : {m['accuracy']:.4f}")
    print(f"CLV mean %           : {m['clv_mean_pct']:.3f}  (n={m['clv_n']})")
    print(f"% picks beating close: {m['clv_beat_pct']:.2f}")
    print(f"ROI % (flat 1u)      : {m['roi_pct']:+.2f}  ({m['roi_bets']} bets, {m['roi_profit_u']:+.1f}u)")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
