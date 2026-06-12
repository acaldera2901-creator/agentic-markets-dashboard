"""P1 — tennis CLV vs US books (DraftKings/FanDuel) — SKELETON / harness.

Goal: measure whether our Elo-surface tennis picks beat the US closing line.
CLV (captured odds vs closing odds) is the honest forward test of edge, the same
bar we hold football to in scripts/backtest_clv.py.

STATUS: BLOCKED on data. The Odds API tennis adapter (core/tennis_odds_api_client)
polls regions="eu,uk" only and uses the live /odds endpoint — we have NO US book
odds and NO historical pull yet. This harness therefore runs against MOCK data
today and prints a clear BLOCKED banner when real US odds are absent, so it is
ready the moment the D2 budget unlocks collection.

NO PAID API CALLS. Inputs are local CSVs:
  --us-odds      pick-level US odds: open + close (DraftKings/FanDuel)
  --results      ESPN results export (winner per match) — already free/available

US odds CSV columns (one row per match per book, or pre-joined to the pick):
  match_key, book, player1, player2, open_odds_p1, open_odds_p2,
  close_odds_p1, close_odds_p2

Run (mock):
  ./venv/bin/python -m scripts.p1_tennis_clv --us-odds data/tennis/mock_us_odds.csv \
      --results data/tennis/mock_results.csv
"""
from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@dataclass(frozen=True)
class USOddsRow:
    match_key: str
    book: str
    player1: str
    player2: str
    open_odds_p1: float | None
    open_odds_p2: float | None
    close_odds_p1: float | None
    close_odds_p2: float | None


def _f(v: str | None) -> float | None:
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def load_us_odds(path: Path) -> list[USOddsRow]:
    if not path.exists():
        return []
    rows: list[USOddsRow] = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            rows.append(
                USOddsRow(
                    match_key=r.get("match_key", ""),
                    book=r.get("book", ""),
                    player1=r.get("player1", ""),
                    player2=r.get("player2", ""),
                    open_odds_p1=_f(r.get("open_odds_p1")),
                    open_odds_p2=_f(r.get("open_odds_p2")),
                    close_odds_p1=_f(r.get("close_odds_p1")),
                    close_odds_p2=_f(r.get("close_odds_p2")),
                )
            )
    return rows


def load_results(path: Path) -> dict[str, str]:
    """match_key -> winner player name. ESPN results export (free, available)."""
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            mk = r.get("match_key", "")
            w = r.get("winner", "")
            if mk and w:
                out[mk] = w
    return out


def _our_pick(match_key: str, p1: str, p2: str) -> tuple[str, float] | None:
    """Our Elo-surface model's pick + open-odds-side for this match.

    Deferred to models.elo_surface.EloSurfaceModel at integration time. The
    model is offline (Sackmann CSV), calibration already validated (holdout
    2025-26, n=8044, Brier 0.2206, ECE 0.0099, acc 63.4% — scripts/
    backtest_tennis_production.py). For the skeleton we return None so the
    harness exercises the BLOCKED path without inventing a prediction.
    """
    return None


def compute_clv(us_rows: list[USOddsRow], results: dict[str, str]) -> dict:
    have_open = any(r.open_odds_p1 and r.open_odds_p2 for r in us_rows)
    have_close = any(r.close_odds_p1 and r.close_odds_p2 for r in us_rows)
    blocked = not (us_rows and have_open and have_close)

    clv_vals: list[float] = []
    beat = n = 0
    matched = 0

    for r in us_rows:
        pick = _our_pick(r.match_key, r.player1, r.player2)
        if pick is None:
            continue
        side, _ = pick
        open_odds = r.open_odds_p1 if side == r.player1 else r.open_odds_p2
        close_odds = r.close_odds_p1 if side == r.player1 else r.close_odds_p2
        if not open_odds or not close_odds:
            continue
        matched += 1
        clv = open_odds / close_odds - 1.0
        clv_vals.append(clv)
        beat += 1 if open_odds > close_odds else 0
        n += 1

    return {
        "blocked": blocked,
        "rows": len(us_rows),
        "matched_picks": matched,
        "clv_mean_pct": (sum(clv_vals) / len(clv_vals) * 100) if clv_vals else float("nan"),
        "beat_pct": (beat / n * 100) if n else float("nan"),
        "n": n,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="P1 tennis CLV vs US books (skeleton)")
    ap.add_argument("--us-odds", required=True, type=Path)
    ap.add_argument("--results", required=True, type=Path)
    args = ap.parse_args(argv)

    us_rows = load_us_odds(args.us_odds)
    results = load_results(args.results)
    m = compute_clv(us_rows, results)

    print("=" * 60)
    print("P1 — Tennis CLV vs US books (DraftKings/FanDuel)")
    print("=" * 60)
    if m["blocked"]:
        print("BLOCCATO: mancano quote US (open/close) — vedi budget D2.")
        print("The Odds API: regione 'us' + endpoint /historical (10 crediti")
        print("per regione x mercato) NON ancora abilitati. Harness pronto:")
        print("appena arrivano le quote US gira senza modifiche.")
        print(f"(input visti: {m['rows']} righe odds, {len(results)} risultati)")
        print("=" * 60)
        return 0

    print(f"US odds rows         : {m['rows']}")
    print(f"matched model picks  : {m['matched_picks']}")
    print(f"CLV mean %           : {m['clv_mean_pct']:.3f}  (n={m['n']})")
    print(f"% picks beating close: {m['beat_pct']:.2f}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
