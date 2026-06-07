"""#HARNESS-1 (APPROVE Andrea 2026-06-07): model promotion gate.

Runs the canonical out-of-time benchmark of every SERVED model and compares
against config/model-baselines.json. Exit 0 = no regression; exit 1 = at
least one model regressed beyond tolerance (Brier +0.002 / ECE +0.005).

THE RULE (ops/PROMOTION-GATE.md): no model-affecting change ships to prod
without a green gate AND a human APPROVE. This tool is the executable half of
the rule the audit asked for ("ogni upgrade promosso solo se vince il
backtest") — #CALIB-1 ran this process by hand and stopped a regression
(isotonic on club football); the gate makes it routine.

Benchmarks (all walk-forward, temporal holdouts, production code paths):
  football  scripts/benchmark-served.ts   (predict + applyTemperature, holdout season 2024)
  tennis    scripts/backtest_tennis_production.py  (EloSurfaceModel, holdout 2025-26)
  wc        inline replay (national model + isotonic artifact, NEUTRAL matches 2025+)
            NB: the WC artifact was fitted on a window overlapping this holdout —
            the WC number detects REGRESSIONS, it is not an absolute skill claim.

Usage:
  ./venv/bin/python scripts/promotion_gate.py                    # check
  ./venv/bin/python scripts/promotion_gate.py --update-baselines # accept current numbers
"""
from __future__ import annotations

import csv
import importlib.util
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

BASELINES = ROOT / "config" / "model-baselines.json"
TOLERANCE = {"brier": 0.002, "ece": 0.005}


def _load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def bench_football() -> dict:
    out = subprocess.run(
        ["npx", "tsx", "scripts/benchmark-served.ts"],
        cwd=ROOT, capture_output=True, text=True, timeout=900,
    )
    if out.returncode != 0:
        raise RuntimeError(f"benchmark-served.ts failed: {out.stderr[-400:]}")
    return json.loads(out.stdout.strip().splitlines()[-1])


def bench_tennis() -> dict:
    return _load_script("backtest_tennis_production").compute_metrics()


def bench_wc() -> dict:
    import numpy as np
    from core.world_cup_history import load_national_history
    from core.world_cup_probability import national_match_probabilities
    from core.wc_calibration import calibrate_wc_probabilities

    neutral = set()
    with open(ROOT / "data" / "national_teams" / "international_results_raw.csv") as fh:
        for r in csv.DictReader(fh):
            if str(r.get("neutral", "")).strip().upper() in ("TRUE", "1"):
                neutral.add((r["date"], r["home_team"], r["away_team"]))

    matches = load_national_history()
    matches.sort(key=lambda m: m["date"])
    probs, outcomes = [], []
    for i, m in enumerate(matches):
        if m["date"] < date(2025, 1, 1):
            continue
        if (m["date"].isoformat(), m["home_team"], m["away_team"]) not in neutral:
            continue
        res = national_match_probabilities(matches[:i], m["home_team"], m["away_team"])
        if not res or float(res.get("data_quality", 0)) < 0.75:
            continue
        cal = calibrate_wc_probabilities(res["p_team_a"], res["p_draw"], res["p_team_b"])
        probs.append(list(cal))
        hg, ag = m["home_goals"], m["away_goals"]
        outcomes.append(0 if hg > ag else 1 if hg == ag else 2)

    p = np.array(probs)
    y = np.array(outcomes)
    brier = float(np.mean(np.sum((p - np.eye(3)[y]) ** 2, axis=1)))
    ece_tot = 0.0
    for k in range(3):
        conf, hit = p[:, k], (y == k).astype(float)
        e = 0.0
        for b in range(10):
            lo, hi = b / 10, (b + 1) / 10
            msk = (conf >= lo) & (conf < hi if b < 9 else conf <= hi)
            if msk.sum():
                e += (msk.sum() / len(conf)) * abs(conf[msk].mean() - hit[msk].mean())
        ece_tot += e
    return {
        "sport": "wc",
        "holdout": "neutral 2025+ (overlaps artifact fit — regression detector only)",
        "n": len(outcomes),
        "brier": round(brier, 4),
        "ece": round(float(ece_tot / 3), 4),
    }


def bench_wc_v2() -> dict:
    """Head-to-head v2 (football-worldcup-v2-elo) on the SAME holdout as bench_wc.

    Not part of the routine served-model gate (v2 is shadow, not served) — run via
    --wc-v2-compare to produce the v2-vs-v1 promotion evidence on the served-path
    holdout. The lab (scripts/lab_backtest_10y.py) is the walk-forward case; this
    is the gate-side case on neutral 2025+ matches, identical sample selection to
    bench_wc so the two numbers are directly comparable.
    """
    import csv as _csv

    import numpy as np
    from core.world_cup_history import load_national_history
    from core.world_cup_probability import national_match_probabilities
    from core.world_cup_elo_model import predict_wc_match

    neutral = set()
    with open(ROOT / "data" / "national_teams" / "international_results_raw.csv") as fh:
        for r in _csv.DictReader(fh):
            if str(r.get("neutral", "")).strip().upper() in ("TRUE", "1"):
                neutral.add((r["date"], r["home_team"], r["away_team"]))

    matches = load_national_history()
    matches.sort(key=lambda m: m["date"])
    probs, outcomes = [], []
    for i, m in enumerate(matches):
        if m["date"] < date(2025, 1, 1):
            continue
        if (m["date"].isoformat(), m["home_team"], m["away_team"]) not in neutral:
            continue
        # SAME quality gate as bench_wc: only matches the served path would price.
        v1 = national_match_probabilities(matches[:i], m["home_team"], m["away_team"])
        if not v1 or float(v1.get("data_quality", 0)) < 0.75:
            continue
        v2 = predict_wc_match(m["home_team"], m["away_team"], neutral=True)
        if v2 is None:
            continue
        probs.append(list(v2))
        hg, ag = m["home_goals"], m["away_goals"]
        outcomes.append(0 if hg > ag else 1 if hg == ag else 2)

    p = np.array(probs)
    y = np.array(outcomes)
    brier = float(np.mean(np.sum((p - np.eye(3)[y]) ** 2, axis=1)))
    ece_tot = 0.0
    for k in range(3):
        conf, hit = p[:, k], (y == k).astype(float)
        e = 0.0
        for b in range(10):
            lo, hi = b / 10, (b + 1) / 10
            msk = (conf >= lo) & (conf < hi if b < 9 else conf <= hi)
            if msk.sum():
                e += (msk.sum() / len(conf)) * abs(conf[msk].mean() - hit[msk].mean())
        ece_tot += e
    acc = float(np.mean(p.argmax(axis=1) == y))
    return {
        "sport": "wc_v2",
        "holdout": "neutral 2025+ (same sample as bench_wc; v2 Elo candidate)",
        "n": len(outcomes),
        "brier": round(brier, 4),
        "ece": round(float(ece_tot / 3), 4),
        "accuracy": round(acc, 4),
    }


def main() -> None:
    if "--wc-v2-compare" in sys.argv:
        v1 = bench_wc()
        v2 = bench_wc_v2()
        print("[gate] WC v1 (served):", v1)
        print("[gate] WC v2 (Elo shadow):", v2)
        d_brier = v2["brier"] - v1["brier"]
        verdict = "v2 WINS" if d_brier < -TOLERANCE["brier"] else (
            "v1 wins/tie" if d_brier > TOLERANCE["brier"] else "no material diff")
        print(f"[gate] ΔBrier v2-v1 = {d_brier:+.4f} (tol ±{TOLERANCE['brier']}) -> {verdict}")
        print("[gate] NB: shadow only — promotion requires this green AND a human APPROVE.")
        return

    update = "--update-baselines" in sys.argv
    results = {}
    for name, fn in (("football", bench_football), ("tennis", bench_tennis), ("wc", bench_wc)):
        print(f"[gate] benchmarking {name}…", flush=True)
        results[name] = fn()
        print(f"[gate]   {results[name]}")

    if update or not BASELINES.exists():
        BASELINES.parent.mkdir(parents=True, exist_ok=True)
        BASELINES.write_text(json.dumps({"tolerance": TOLERANCE, "models": results}, indent=2))
        print(f"[gate] baselines {'updated' if update else 'initialized'} -> {BASELINES}")
        return

    baselines = json.loads(BASELINES.read_text())["models"]
    failures = []
    for name, cur in results.items():
        base = baselines.get(name)
        if not base:
            failures.append(f"{name}: nessuna baseline registrata")
            continue
        for metric, tol in TOLERANCE.items():
            delta = cur[metric] - base[metric]
            status = "OK" if delta <= tol else "FAIL"
            print(f"[gate] {name:9s} {metric}: {base[metric]:.4f} -> {cur[metric]:.4f} (Δ{delta:+.4f}, tol +{tol}) {status}")
            if delta > tol:
                failures.append(f"{name}/{metric}: {base[metric]:.4f} -> {cur[metric]:.4f}")

    if failures:
        print("\n[gate] ❌ REGRESSIONE — promozione bloccata:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print("\n[gate] ✅ verde — nessuna regressione oltre tolleranza")


if __name__ == "__main__":
    main()
