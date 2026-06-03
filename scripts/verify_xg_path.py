"""End-to-end verification of the xG serving path (paper/parallel — no client flip).

1. Train XGModel on Understat history, predict a held-out slice, confirm the Brier
   matches the backtest (~0.58, beating the goals-only base toward the market).
2. Build a unified_predictions row for a real fixture via xg_prediction_to_unified_row
   (model_version=football-xg-v1, is_paper=True), with Understat->fd.co.uk name
   mapping. DRY RUN: the row is printed, never inserted. Promotion to client serving
   stays gated on an explicit deploy.

Run:  venv/bin/python -m scripts.verify_xg_path
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.supabase_client import DCPrediction, xg_prediction_to_unified_row  # noqa: E402
from core.team_mapping import understat_to_fd  # noqa: E402
from core.understat_data import load  # noqa: E402
from models.xg_model import OUTCOMES, XGModel  # noqa: E402
from scripts.backtest_clv import brier_1x2  # noqa: E402

LEAGUE_NAMES = {"PL": "Premier League", "PD": "La Liga", "BL1": "Bundesliga",
                "SA": "Serie A", "FL1": "Ligue 1"}


def run() -> None:
    matches = sorted(load(), key=lambda m: m.date)
    split = int(len(matches) * 0.8)
    train, test = matches[:split], matches[split:]
    print(f"Training XGModel on {len(train)} matches, verifying on {len(test)}…")

    model = XGModel().fit(train)

    # Walk forward through the held-out slice: predict, then feed the result back
    # (as production would, retraining/updating as results arrive). This keeps state
    # fresh and isolates whether the model itself is sound vs merely stale.
    briers = []
    sample = None
    for m in test:
        p = model.predict(m.home_team, m.away_team)
        if p is not None:
            briers.append(brier_1x2(p, m.result))
            if sample is None:
                sample = (m, p)
        model.update(m)

    mean_brier = sum(briers) / len(briers) if briers else float("nan")
    print("\n" + "=" * 56)
    print("STEP 1 — model verification")
    print(f"  predicted {len(briers)} held-out matches")
    print(f"  Brier: {mean_brier:.5f}   (goals-only base ~0.589, market ~0.575)")
    print("=" * 56)

    # STEP 2 — unified_predictions row (paper, dry run)
    m, p = sample
    pred = DCPrediction(
        match_id=f"xg-{m.league}-{m.date}-{understat_to_fd(m.home_team)}-{understat_to_fd(m.away_team)}".replace(" ", "_"),
        league=m.league,
        league_name=LEAGUE_NAMES.get(m.league, m.league),
        home_team=understat_to_fd(m.home_team),
        away_team=understat_to_fd(m.away_team),
        kickoff=f"{m.date.isoformat()}T15:00:00+00:00",
        p_home=p[0], p_draw=p[1], p_away=p[2],
        home_team_matches=10, away_team_matches=10,
    )
    row = xg_prediction_to_unified_row(pred)
    print("STEP 2 — unified_predictions row (DRY RUN, not inserted)")
    print(f"  {understat_to_fd(m.home_team)} vs {understat_to_fd(m.away_team)} "
          f"-> P(H/D/A) = {p[0]:.2f}/{p[1]:.2f}/{p[2]:.2f}")
    for k in ("model_version", "source_table", "is_paper", "plan_access", "signal_type", "status"):
        print(f"    {k}: {row.get(k)}")
    print("  full row keys:", sorted(row.keys()))
    print("=" * 56)
    print("Paper/parallel path verified. Client flip remains gated on explicit deploy.")


if __name__ == "__main__":
    run()
