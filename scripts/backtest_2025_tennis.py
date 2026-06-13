"""#BACKTEST-2025-1 — labelled, walk-forward 2025 tennis backtest reusing the
PRODUCTION surface-Elo model (models.elo_surface.EloSurfaceModel). Writes a JSON
artifact only; never touches the live track record.

Honesty / methodology (also shown in the UI disclaimer):
  - Walk-forward, NO look-ahead: each match is predicted from Elo built ONLY on
    earlier matches, then Elo is updated. Late-Dec-2024 season-opener matches
    are warm-up (NOT evaluated); only matches dated in 2025 are evaluated.
  - Pick = the player with the higher win probability; hit = that player won.
  - Source (Sackmann atp/wta) carries NO betting odds -> ROI/CLV are N/A for
    tennis (never fabricated). We report hit-rate + Brier.
  - ATP and WTA keep separate Elo pools (no cross-tour leakage).

Run:  venv/bin/python -m scripts.backtest_2025_tennis
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from models.elo_surface import EloSurfaceModel

ROOT = Path(__file__).resolve().parents[1]
FILES = {"ATP": ROOT / "data" / "tennis" / "atp_2025.csv",
         "WTA": ROOT / "data" / "tennis" / "wta_2025.csv"}
OUT = ROOT / "data" / "backtest_2025_tennis.json"


def run_tour(tour: str, path: Path) -> tuple[list[dict], dict]:
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    # chronological order: tourney_date (YYYYMMDD) then match_num
    def keyf(r):
        try:
            return (int(r["tourney_date"]), int(r.get("match_num") or 0))
        except ValueError:
            return (0, 0)
    rows.sort(key=keyf)

    model = EloSurfaceModel()
    picks: list[dict] = []
    for r in rows:
        w, l = (r.get("winner_name") or "").strip(), (r.get("loser_name") or "").strip()
        surface = (r.get("surface") or "Hard").strip() or "Hard"
        try:
            date_i = int(r["tourney_date"])
        except (ValueError, KeyError):
            continue
        if not w or not l:
            continue
        evaluate = date_i >= 20250101  # warm-up on late-2024 season opener only
        # predict BEFORE updating (no look-ahead). winner passed as p1; the model
        # only sees Elo ratings (outcome-blind), so order does not leak.
        pred = model.predict(w, l, surface)
        p_winner = float(pred["p1"])
        if evaluate:
            d = r["tourney_date"]
            picks.append({
                "competition": r.get("tourney_name") or tour,
                "tour": tour,
                "date": f"{d[:4]}-{d[4:6]}-{d[6:8]}",
                "surface": surface,
                "player1": w, "player2": l,        # p1 is the actual winner
                "favored": w if p_winner >= 0.5 else l,
                "winner": w,
                "won": p_winner >= 0.5,             # model favored the actual winner
                "p_favored": round(max(p_winner, 1.0 - p_winner), 4),
                "brier": round((p_winner - 1.0) ** 2, 4),
            })
        model.update(w, l, surface)
    return picks, summarize(picks)


def summarize(picks: list[dict]) -> dict:
    n = len(picks)
    won = sum(1 for p in picks if p["won"])
    brier = sum(p["brier"] for p in picks) / n if n else None
    return {
        "matches": n,
        "won": won, "lost": n - won,
        "hit_rate": round(won / n * 100, 1) if n else 0,
        "brier": round(brier, 4) if brier is not None else None,
        "roi_pct": None, "avg_clv_pct": None,  # no odds in source
    }


all_picks: list[dict] = []
per_comp: dict = {}
for tour, path in FILES.items():
    picks, summ = run_tour(tour, path)
    all_picks.extend(picks)
    per_comp[tour] = summ
    print(f"[{tour}] {len(picks)} evaluated 2025 matches -> {summ}")

overall = summarize(all_picks)
artifact = {
    "meta": {
        "id": "#BACKTEST-2025-1", "sport": "tennis", "season": "2025",
        "evaluated_window": "calendar 2025",
        "method": "walk-forward, no look-ahead; production surface-Elo "
                  "(models.elo_surface, K=24, surface/overall blend); "
                  "no betting odds in source -> ROI/CLV N/A",
        "tours": list(per_comp.keys()),
        "generated_for": "labelled simulation panel — NOT the live track record",
    },
    "overall": overall, "per_tour": per_comp, "picks": all_picks,
}
OUT.write_text(json.dumps(artifact, indent=2, ensure_ascii=False))
print("\nOVERALL", json.dumps(overall))
print("wrote", OUT, f"({len(all_picks)} picks)")
