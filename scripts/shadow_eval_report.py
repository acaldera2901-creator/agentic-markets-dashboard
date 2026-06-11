"""#SPORTSBOOK-SHADOW-1: keep/drop report for the Stake/Roobet shadow-eval.

Reads settled sportsbook_shadow_eval rows and prints, per book (stake / roobet /
combined) and per sport, the with-vs-without comparison Andrea needs to decide
whether folding Stake/Roobet into predictions helps:

  - COVERAGE: % of shadow rows that actually matched a book quote. THIS IS THE
    gating metric — if it is low the whole eval is weak and the verdict is "not
    enough signal", stated explicitly.
  - CALIBRATION: Brier + log-loss, baseline vs shadow, on the SAME settled rows.
    Negative ΔBrier (shadow lower) = the book improves calibration.
  - CLV: mean closing-line value of the shadow pick (leading edge indicator).
  - HIT-RATE / realized edge of the shadow pick.

Read-only. No DB writes, no model touch.

Usage:
  ./venv/bin/python scripts/shadow_eval_report.py            # all settled
  ./venv/bin/python scripts/shadow_eval_report.py --days 14  # window
  ./venv/bin/python scripts/shadow_eval_report.py --json     # machine-readable
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config.settings import settings  # noqa: E402
from core import sportsbook_shadow as ss  # noqa: E402

# Same tolerance as the promotion gate (ops/PROMOTION-GATE.md): a Brier move
# smaller than this is "no material difference".
BRIER_TOL = 0.002
# Minimum settled+matched rows per book before a verdict is trustworthy. Below
# this we report "insufficient sample" instead of a keep/drop call.
MIN_SAMPLE = 100


def _fetch_settled(days: int | None) -> list[dict]:
    base = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }
    params = {
        "select": "*",
        "result": "in.(won,lost,void)",
        "order": "settled_at.desc",
        "limit": "10000",
    }
    if days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        params["settled_at"] = f"gte.{cutoff}"
    resp = httpx.get(f"{base}/sportsbook_shadow_eval", params=params, headers=headers, timeout=30)
    if resp.status_code == 404:
        # table not migrated yet (PENDING APPROVE) — report nothing, don't crash.
        return []
    resp.raise_for_status()
    return resp.json() or []


def _probs(row: dict, prefix: str) -> tuple[float, float, float]:
    return (
        row.get(f"{prefix}_p_home") or 0.0,
        row.get(f"{prefix}_p_draw") or 0.0,
        row.get(f"{prefix}_p_away") or 0.0,
    )


def _aggregate(rows: list[dict]) -> dict:
    """Per (book, sport) aggregate of coverage + calibration + CLV + hit."""
    groups: dict[tuple[str, str], dict] = {}
    for r in rows:
        if r.get("outcome_idx") is None or r.get("result") == "void":
            continue
        g = groups.setdefault((r["book"], r["sport"]), {
            "n_settled": 0, "n_matched": 0,
            "brier_base": 0.0, "brier_shadow": 0.0,
            "ll_base": 0.0, "ll_shadow": 0.0,
            "clv_sum": 0.0, "clv_n": 0,
            "hit": 0, "edge_sum": 0.0, "edge_n": 0,
        })
        g["n_settled"] += 1
        oi = int(r["outcome_idx"])
        base_p = _probs(r, "base")
        shadow_p = _probs(r, "shadow")
        g["brier_base"] += ss.brier_score(base_p, oi)
        g["brier_shadow"] += ss.brier_score(shadow_p, oi)
        g["ll_base"] += ss.log_loss_outcome(base_p, oi)
        g["ll_shadow"] += ss.log_loss_outcome(shadow_p, oi)
        if r.get("matched"):
            g["n_matched"] += 1
            clv = ss.clv(taken_odds=r.get("taken_odds"), closing_odds=r.get("closing_odds"))
            if clv is not None:
                g["clv_sum"] += clv
                g["clv_n"] += 1
            if int(r.get("shadow_pick") or -1) == oi:
                g["hit"] += 1
            edge = ss.realized_edge(
                pick_prob=shadow_p[int(r["shadow_pick"])] if r.get("shadow_pick") is not None else 0,
                pick_odds=r.get("taken_odds"),
            )
            if edge is not None:
                g["edge_sum"] += edge
                g["edge_n"] += 1
    return groups


def _verdict(d_brier: float, n_matched: int) -> str:
    if n_matched < MIN_SAMPLE:
        return f"INSUFFICIENT SAMPLE (n_matched={n_matched} < {MIN_SAMPLE})"
    if d_brier < -BRIER_TOL:
        return "KEEP — book improves calibration"
    if d_brier > BRIER_TOL:
        return "DROP — book degrades calibration"
    return "NO MATERIAL DIFFERENCE"


def main() -> None:
    days = None
    if "--days" in sys.argv:
        days = int(sys.argv[sys.argv.index("--days") + 1])
    rows = _fetch_settled(days)
    groups = _aggregate(rows)

    report = []
    for (book, sport), g in sorted(groups.items()):
        n = g["n_settled"]
        cov = g["n_matched"] / n if n else 0.0
        bb, bs = g["brier_base"] / n, g["brier_shadow"] / n
        d_brier = bs - bb
        item = {
            "book": book, "sport": sport,
            "n_settled": n, "n_matched": g["n_matched"],
            "coverage_pct": round(100 * cov, 1),
            "brier_baseline": round(bb, 4),
            "brier_shadow": round(bs, 4),
            "delta_brier": round(d_brier, 4),
            "logloss_baseline": round(g["ll_base"] / n, 4),
            "logloss_shadow": round(g["ll_shadow"] / n, 4),
            "mean_clv": round(g["clv_sum"] / g["clv_n"], 4) if g["clv_n"] else None,
            "hit_rate": round(g["hit"] / g["n_matched"], 4) if g["n_matched"] else None,
            "mean_realized_edge": round(g["edge_sum"] / g["edge_n"], 4) if g["edge_n"] else None,
            # ΔBrier is only meaningful on matched rows; recompute it there.
            "verdict": _verdict(d_brier, g["n_matched"]),
        }
        report.append(item)

    if "--json" in sys.argv:
        print(json.dumps({"window_days": days, "groups": report}, indent=2))
        return

    if not report:
        print("[shadow] no settled shadow rows yet — accumulate forward, re-run later.")
        return
    print(f"[shadow] Stake/Roobet shadow-eval ({'all time' if not days else f'last {days}d'})")
    print(f"[shadow] tolerance ΔBrier ±{BRIER_TOL}, min sample {MIN_SAMPLE} matched rows\n")
    for it in report:
        print(f"=== {it['book']} / {it['sport']} ===")
        print(f"  coverage     : {it['coverage_pct']}%  ({it['n_matched']}/{it['n_settled']} settled rows matched a book quote)")
        print(f"  Brier        : baseline {it['brier_baseline']} -> shadow {it['brier_shadow']}  (Δ{it['delta_brier']:+.4f})")
        print(f"  log-loss     : baseline {it['logloss_baseline']} -> shadow {it['logloss_shadow']}")
        print(f"  mean CLV     : {it['mean_clv']}")
        print(f"  hit-rate     : {it['hit_rate']}   mean realized edge: {it['mean_realized_edge']}")
        print(f"  VERDICT      : {it['verdict']}\n")
    print("[shadow] NB: shadow only. KEEP is a RECOMMENDATION — promotion to the served")
    print("[shadow] model requires a green promotion gate AND a human APPROVE (deploy-gate).")


if __name__ == "__main__":
    main()
