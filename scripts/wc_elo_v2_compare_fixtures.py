"""v1-vs-v2 comparison on the real upcoming WC2026 fixtures (no DB, no network).

Replays BOTH the served path (core.world_cup_probability v1) and the shadow
candidate (core.world_cup_elo_model v2) on the actual WC2026 group-stage
matchups carried in data/national_teams/international_results_raw.csv. Prints a
match-by-match table (p_v1, p_v2, picks same/different) — the evidence the
implementation report needs that the shadow produces sane v2 numbers on the live
slate. Read-only.

  ./.venv/bin/python scripts/wc_elo_v2_compare_fixtures.py
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.world_cup_history import canonical_team_name, load_national_history
from core.world_cup_probability import national_match_probabilities
from core.world_cup_elo_model import predict_wc_match

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "national_teams" / "international_results_raw.csv"
FIRST_KICKOFF = "2026-06-11"
MAX_FIXTURES = 33


def _pick(p: tuple[float, float, float]) -> str:
    return ["HOME", "DRAW", "AWAY"][max(range(3), key=lambda i: p[i])]


def main() -> None:
    raw = []
    with CSV_PATH.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r["tournament"] == "FIFA World Cup" and r["date"] >= FIRST_KICKOFF:
                raw.append(r)
    seen, fixtures = set(), []
    for r in raw:
        key = (r["home_team"], r["away_team"])
        if key in seen:
            continue
        seen.add(key)
        fixtures.append(r)
    fixtures = fixtures[:MAX_FIXTURES]

    hist = load_national_history()
    hist.sort(key=lambda m: m["date"])

    print(f"{'MATCH':38s} {'v1 H/D/A':20s} {'v2 H/D/A':20s} pick")
    print("-" * 92)
    same = diff = v2_only = v1_only = 0
    for r in fixtures:
        h, a = r["home_team"], r["away_team"]
        neutral = (r["neutral"] or "").strip().upper() == "TRUE"
        v1 = national_match_probabilities(hist, canonical_team_name(h), canonical_team_name(a))
        v2 = predict_wc_match(h, a, neutral=neutral)
        v1t = (v1["p_team_a"], v1["p_draw"], v1["p_team_b"]) if v1 else None
        p1 = _pick(v1t) if v1t else "—"
        p2 = _pick(v2) if v2 else "—"
        if v1t and v2:
            if p1 == p2:
                same += 1
                flag = "same"
            else:
                diff += 1
                flag = "DIFF"
        elif v2:
            v2_only += 1
            flag = "v2-only"
        elif v1t:
            v1_only += 1
            flag = "v1-only"
        else:
            flag = "none"
        s1 = f"{v1t[0]:.2f}/{v1t[1]:.2f}/{v1t[2]:.2f}" if v1t else "none"
        s2 = f"{v2[0]:.2f}/{v2[1]:.2f}/{v2[2]:.2f}" if v2 else "none"
        label = f"{h[:17]} vs {a[:15]}"
        print(f"{label:38s} {s1:20s} {s2:20s} {p1}->{p2} {flag}")

    print("-" * 92)
    print(f"TOTAL={len(fixtures)}  same_pick={same}  diff_pick={diff}  "
          f"v2_only(v1_missing)={v2_only}  v1_only(v2_missing)={v1_only}")


if __name__ == "__main__":
    main()
