"""Smoke run — Squad Condition Watch ①+② against live ESPN (no DB writes).

Builds the in-memory condition map for the WC field and prints reports for a few
nationals, then shows an enriched why-line for a synthetic matchup using a real
report. Run: python scripts/smoke_squad_condition.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.squad_condition_sync import build_condition_map
from core.world_cup_explanation import build_wc_enrichment, build_wc_explanation
from core.world_cup_probability import national_match_probabilities
from core.world_cup_history import canonical_team_name, load_national_history

TARGETS = ["Argentina", "Spain", "Brazil", "France", "England"]


async def main() -> int:
    cmap = await build_condition_map()
    print(f"# condition map: {len(cmap)} teams from live ESPN\n")
    if not cmap:
        print("NO DATA (ESPN unreachable or off-window) — fail-soft, empty map.")
        return 1

    for name in TARGETS:
        c = canonical_team_name(name)
        rep = cmap.get(c)
        if not rep:
            print(f"{name:12s} -> no report")
            continue
        print(
            f"{name:12s} injuries={len(rep['injuries']):2d} "
            f"squad_size={rep['squad_size']} "
            f"xi_value_ratio={rep['xi_value_ratio']} "
            f"availability={rep['availability_ratio']} "
            f"rotation={rep['rotation_flag']}"
        )
        if rep["injuries"]:
            print(f"             injured: {', '.join(rep['injuries'][:5])}")

    # Enriched why-line using two real reports.
    home, away = TARGETS[0], TARGETS[1]
    hc, ac = canonical_team_name(home), canonical_team_name(away)
    rh, ra = cmap.get(hc) or {}, cmap.get(ac) or {}
    history = load_national_history()
    probs = national_match_probabilities(history, hc, ac)
    if probs:
        enr = build_wc_enrichment(
            home_team=home, away_team=away,
            canonical_home=hc, canonical_away=ac,
            history=history, probs=probs,
            squad={
                "injuries_home": rh.get("injuries") or [],
                "injuries_away": ra.get("injuries") or [],
                "xi_value_ratio_home": rh.get("xi_value_ratio"),
                "xi_value_ratio_away": ra.get("xi_value_ratio"),
                "rotation_flag_home": bool(rh.get("rotation_flag")),
                "rotation_flag_away": bool(ra.get("rotation_flag")),
            },
        )
        pick = max({"HOME": probs["p_team_a"], "DRAW": probs["p_draw"],
                    "AWAY": probs["p_team_b"]}.items(), key=lambda kv: kv[1])[0]
        conf = round(max(probs["p_team_a"], probs["p_draw"], probs["p_team_b"]) * 100)
        text = build_wc_explanation(
            home_team=home, away_team=away, enrichment=enr, probs=probs,
            pick=pick, confidence=conf,
        )
        print(f"\n# enriched why ({home} vs {away}):\n{text}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
