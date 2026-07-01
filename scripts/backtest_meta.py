"""Dual-track meta-model backtest — the honest "where is the edge" engine.

Reuses the exact no-leakage walk-forward substrate of scripts.backtest_clv
(football-data.co.uk results + Pinnacle opening/closing odds, per-league warmup +
Dixon-Coles refit) and, for every predicted match, collects a feature row:

    base (market-BLIND):  DC probs (H,D,A) · Poisson-v1 probs (H,D,A) · pi_diff · form_diff
    market:               de-vigged OPENING probs (H,D,A) · de-vigged CLOSING probs (H,D,A)
    labels/odds:          outcome · opening odds · closing odds

Feature collection is slow (DC L-BFGS-B refits) so it is cached to
data/meta_features_football.json. Delete that file to force a rebuild.

Then two second-level stackers are fit on a TEMPORAL split (earliest 65% train,
latest 35% test — no look-ahead, base probs are already walk-forward):

  Track A  (market-AWARE, includes OPENING market prob as a feature)
           -> product: the served probability. Judged on Brier / log-loss / ECE.
  Track B  (market-BLIND, models only)
           -> truth serum: value picks priced at OPENING and CLOSING odds -> ROI + CLV.
              Bootstrap CI on ROI per segment feeds the promotion gate.

Baselines to beat: Poisson v1 (what clients are served TODAY) and the market itself.

Run:  .venv/bin/python -m scripts.backtest_meta
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import FDMatch, implied_probs  # noqa: E402
from models.dixon_coles import DixonColesModel  # noqa: E402
from models.match_features import PiRating, form_ppg, result_char  # noqa: E402
from scripts.backtest_clv import (  # noqa: E402
    DC_HALF_LIFE_DAYS,
    DC_REFIT_EVERY,
    LEAGUES,
    OUTCOMES,
    START_YEARS,
    WARMUP,
    brier_1x2,
    load_cached,
    poisson_v1_predict,
)

CACHE = ROOT / "data" / "meta_features_football.json"
EDGE_MAP = ROOT / "reports" / "edge_map_football.json"
TRAIN_FRAC = 0.65
N_BOOT = 2000
RNG_SEED = 20260701


# ── feature collection (cached) ─────────────────────────────────────────────────
def collect_rows() -> list[dict]:
    if CACHE.exists():
        rows = json.loads(CACHE.read_text())
        print(f"Loaded {len(rows)} cached feature rows from {CACHE.name}")
        return rows

    print("Building feature matrix (walk-forward, cached)…")
    by_league: dict[str, list[FDMatch]] = {}
    for lg in LEAGUES:
        ms: list[FDMatch] = []
        for yr in START_YEARS:
            ms.extend(load_cached(lg, yr))
        ms.sort(key=lambda m: m.date)
        by_league[lg] = ms
        print(f"  {lg}: {len(ms)} matches")

    rows: list[dict] = []
    for lg, matches in by_league.items():
        if len(matches) <= WARMUP:
            continue
        dc = DixonColesModel()
        train_dicts: list[dict] = [m.as_model_match() for m in matches[:WARMUP]]
        dc.fit(train_dicts, half_life_days=DC_HALF_LIFE_DAYS)
        # warm the feature trackers over the warmup window
        pi = PiRating()
        results_log: dict[str, list] = defaultdict(list)
        for m in matches[:WARMUP]:
            pi.update(m.home_team, m.away_team, m.home_goals, m.away_goals)
            results_log[m.home_team].append(result_char(m.home_goals, m.away_goals))
            results_log[m.away_team].append(result_char(m.away_goals, m.home_goals))
        since_refit = 0

        for m in matches[WARMUP:]:
            outcome = m.result if m.result in OUTCOMES else (
                "H" if m.home_goals > m.away_goals else "A" if m.away_goals > m.home_goals else "D"
            )
            mkt_close = implied_probs(m.closing_home, m.closing_draw, m.closing_away)
            mkt_open = implied_probs(m.open_h, m.open_d, m.open_a)
            try:
                dcp = dc.predict(m.home_team, m.away_team)
            except Exception:  # noqa: BLE001 — unseen team before refit
                dcp = None
            poi = poisson_v1_predict(train_dicts, m.home_team, m.away_team)

            if dcp and poi and mkt_close:
                rows.append({
                    "date": m.date.isoformat(),
                    "league": lg,
                    "dc": [dcp[0], dcp[1], dcp[2]],
                    "poi": [poi[0], poi[1], poi[2]],
                    "pi_diff": pi.rating_diff(m.home_team, m.away_team),
                    "form_diff": form_ppg(results_log[m.home_team]) - form_ppg(results_log[m.away_team]),
                    "mkt_close": list(mkt_close),
                    "mkt_open": list(mkt_open) if mkt_open else None,
                    "odds_close": [m.closing_home, m.closing_draw, m.closing_away],
                    "odds_open": [m.open_h, m.open_d, m.open_a] if mkt_open else None,
                    "y": OUTCOMES.index(outcome),
                })

            train_dicts.append(m.as_model_match())
            pi.update(m.home_team, m.away_team, m.home_goals, m.away_goals)
            results_log[m.home_team].append(result_char(m.home_goals, m.away_goals))
            results_log[m.away_team].append(result_char(m.away_goals, m.home_goals))
            since_refit += 1
            if since_refit >= DC_REFIT_EVERY:
                prev = dc
                dc = DixonColesModel()
                dc.fit(train_dicts, warm_start=prev, half_life_days=DC_HALF_LIFE_DAYS)
                since_refit = 0

    CACHE.write_text(json.dumps(rows))
    print(f"Wrote {len(rows)} feature rows -> {CACHE.name}")
    return rows


# ── metrics ─────────────────────────────────────────────────────────────────────
def clean_probs(probs: np.ndarray) -> np.ndarray:
    """Clip tiny negatives (DC numerical noise) and renormalize rows to sum 1."""
    p = np.clip(np.asarray(probs, dtype=float), 1e-9, None)
    return p / p.sum(axis=1, keepdims=True)


def brier_mean(probs: np.ndarray, y: np.ndarray) -> float:
    return float(np.mean([brier_1x2(tuple(p), OUTCOMES[o]) for p, o in zip(probs, y)]))


def ece(probs: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    """Expected calibration error on the predicted (argmax) class."""
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    correct = (pred == y).astype(float)
    edges = np.linspace(0, 1, bins + 1)
    e = 0.0
    n = len(y)
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (conf > lo) & (conf <= hi) if i > 0 else (conf >= lo) & (conf <= hi)
        if mask.sum() == 0:
            continue
        e += mask.sum() / n * abs(correct[mask].mean() - conf[mask].mean())
    return float(e)


def metrics_block(probs: np.ndarray, y: np.ndarray) -> dict:
    probs = clean_probs(probs)
    acc = float((probs.argmax(axis=1) == y).mean())
    return {
        "brier": round(brier_mean(probs, y), 5),
        "logloss": round(float(log_loss(y, probs, labels=[0, 1, 2])), 5),
        "ece": round(ece(probs, y), 5),
        "acc": round(acc, 4),
        "n": int(len(y)),
    }


def roi_picks(probs: np.ndarray, odds: np.ndarray, y: np.ndarray, margin: float = 0.0):
    """Flat-stake 1u on every selection with positive model EV. Returns per-match
    (stake, profit) arrays so ROI can be bootstrapped."""
    stakes = np.zeros(len(y))
    profits = np.zeros(len(y))
    for k in range(len(y)):
        for i in range(3):
            o = odds[k, i]
            if o and o > 1.0 and probs[k, i] * o > 1.0 + margin:
                stakes[k] += 1.0
                profits[k] += (o - 1.0) if y[k] == i else -1.0
    return stakes, profits


def roi_ci(stakes: np.ndarray, profits: np.ndarray, rng: np.random.Generator):
    total_stake = stakes.sum()
    if total_stake <= 0:
        return float("nan"), (float("nan"), float("nan")), 0
    roi = profits.sum() / total_stake * 100
    n = len(stakes)
    boot = []
    for _ in range(N_BOOT):
        idx = rng.integers(0, n, n)
        s = stakes[idx].sum()
        if s > 0:
            boot.append(profits[idx].sum() / s * 100)
    lo, hi = np.percentile(boot, [2.5, 97.5]) if boot else (float("nan"), float("nan"))
    nbets = int((stakes > 0).sum())
    return roi, (float(lo), float(hi)), nbets


# ── stackers ──────────────────────────────────────────────────────────────────
def fit_stacker(Xtr: np.ndarray, ytr: np.ndarray, Xte: np.ndarray) -> np.ndarray:
    sc = StandardScaler().fit(Xtr)
    clf = LogisticRegression(max_iter=3000, C=1.0).fit(sc.transform(Xtr), ytr)
    proba = clf.predict_proba(sc.transform(Xte))
    # align columns to OUTCOMES order (classes_ may be subset/reordered)
    out = np.zeros((len(Xte), 3))
    for j, cls in enumerate(clf.classes_):
        out[:, cls] = proba[:, j]
    return out


def run() -> None:
    rows = collect_rows()
    rng = np.random.default_rng(RNG_SEED)

    # temporal split
    rows.sort(key=lambda r: r["date"])
    split = int(len(rows) * TRAIN_FRAC)
    tr, te = rows[:split], rows[split:]
    print(f"\nRows: {len(rows)}  train {len(tr)} (<= {tr[-1]['date']})  test {len(te)} (>= {te[0]['date']})")

    def base_feats(rs):
        return np.array([r["dc"] + r["poi"] + [r["pi_diff"], r["form_diff"]] for r in rs], dtype=float)

    y_tr = np.array([r["y"] for r in tr])
    y_te = np.array([r["y"] for r in te])

    # ---- baselines on the TEST slice ----
    poi_te = np.array([r["poi"] for r in te])
    dc_te = np.array([r["dc"] for r in te])
    mktc_te = np.array([r["mkt_close"] for r in te])

    print("\n" + "=" * 74)
    print("TRACK A — calibrated served probability (lower Brier/logloss/ECE = better)")
    print("=" * 74)
    print(f"{'Model':<40}{'Brier':>9}{'LogLoss':>9}{'ECE':>8}{'Acc':>8}")
    print("-" * 74)

    def line(name, m):
        print(f"{name:<40}{m['brier']:>9.5f}{m['logloss']:>9.5f}{m['ece']:>8.4f}{m['acc']:>8.4f}")

    line("Poisson v1 (SERVED TODAY)", metrics_block(poi_te, y_te))
    line("Dixon-Coles", metrics_block(dc_te, y_te))
    line("Market — closing (ceiling ref)", metrics_block(mktc_te, y_te))

    # market-blind stacker (no circularity — models only)
    A_blind = fit_stacker(base_feats(tr), y_tr, base_feats(te))
    line("Meta market-BLIND (models only)", metrics_block(A_blind, y_te))

    # market-aware stacker using OPENING price (no look-ahead) where available
    open_mask_tr = np.array([r["mkt_open"] is not None for r in tr])
    open_mask_te = np.array([r["mkt_open"] is not None for r in te])
    cov = open_mask_te.mean() if len(te) else 0.0
    if open_mask_tr.sum() > 200 and open_mask_te.sum() > 100:
        def aware_feats(rs):
            return np.array(
                [r["dc"] + r["poi"] + [r["pi_diff"], r["form_diff"]] + r["mkt_open"] for r in rs],
                dtype=float,
            )
        tr_o = [r for r in tr if r["mkt_open"] is not None]
        te_o = [r for r in te if r["mkt_open"] is not None]
        A_aware = fit_stacker(aware_feats(tr_o), np.array([r["y"] for r in tr_o]), aware_feats(te_o))
        y_te_o = np.array([r["y"] for r in te_o])
        line(f"Meta market-AWARE (+opening, cov {cov:.0%})", metrics_block(A_aware, y_te_o))
        # fair market-opening reference on the same subset
        line("  Market — opening (same subset)",
             metrics_block(np.array([r["mkt_open"] for r in te_o]), y_te_o))
    else:
        print(f"  (opening odds coverage too low: {cov:.0%} — skipping market-AWARE track)")

    # ---- TRACK B: edge / CLV (market-blind picks priced at market) ----
    print("\n" + "=" * 74)
    print("TRACK B — edge/CLV: market-BLIND value picks priced at the line")
    print("  positive ROI (CI excluding 0) = genuine edge; closing is the hard bar")
    print("=" * 74)
    odds_close_te = np.array([r["odds_close"] for r in te], dtype=float)
    s_c, p_c = roi_picks(A_blind, odds_close_te, y_te)
    roi_c, ci_c, nb_c = roi_ci(s_c, p_c, rng)
    print(f"  vs CLOSING : {nb_c:>5} bets  ROI {roi_c:>+6.2f}%  CI95 [{ci_c[0]:>+6.2f}, {ci_c[1]:>+6.2f}]")

    have_open = np.array([r["odds_open"] is not None for r in te])
    if have_open.sum() > 50:
        te_o = [r for r in te if r["odds_open"] is not None]
        A_blind_o = A_blind[have_open]
        odds_open_te = np.array([r["odds_open"] for r in te_o], dtype=float)
        y_te_o = np.array([r["y"] for r in te_o])
        s_o, p_o = roi_picks(A_blind_o, odds_open_te, y_te_o)
        roi_o, ci_o, nb_o = roi_ci(s_o, p_o, rng)
        print(f"  vs OPENING : {nb_o:>5} bets  ROI {roi_o:>+6.2f}%  CI95 [{ci_o[0]:>+6.2f}, {ci_o[1]:>+6.2f}]")

    # ---- per-league Edge Map (seed) ----
    print("\n" + "=" * 74)
    print("EDGE MAP by league (test slice) — Track A calibration + Track B ROI vs closing")
    print("=" * 74)
    print(f"{'League':<8}{'N':>5}{'BrierA':>9}{'BrierMkt':>9}{'ROIclose':>10}{'CI95':>22}{'GATE':>6}")
    print("-" * 74)
    edge_map = {}
    leagues_te = np.array([r["league"] for r in te])
    for lg in sorted(set(leagues_te)):
        mask = leagues_te == lg
        if mask.sum() < 30:
            continue
        mA = metrics_block(A_blind[mask], y_te[mask])
        mMkt = metrics_block(mktc_te[mask], y_te[mask])
        s, p = roi_picks(A_blind[mask], odds_close_te[mask], y_te[mask])
        roi, ci, nb = roi_ci(s, p, rng)
        gate = "PASS" if (ci[0] > 0) else "off"
        print(f"{lg:<8}{int(mask.sum()):>5}{mA['brier']:>9.5f}{mMkt['brier']:>9.5f}"
              f"{roi:>+10.2f}{('[%+.1f,%+.1f]' % ci):>22}{gate:>6}")
        edge_map[lg] = {
            "n": int(mask.sum()),
            "brier_meta": mA["brier"], "brier_market": mMkt["brier"],
            "roi_close": round(roi, 3), "roi_close_ci95": [round(ci[0], 3), round(ci[1], 3)],
            "n_bets": nb, "gate_pass": bool(ci[0] > 0),
        }

    EDGE_MAP.write_text(json.dumps(edge_map, indent=2))
    print("=" * 74)
    print(f"Edge map written -> {EDGE_MAP.relative_to(ROOT)}")
    print("Reminder: a football-mainline segment that PASSES the closing gate is a")
    print("leakage red flag to investigate, not a victory — closing is ~efficient.")


if __name__ == "__main__":
    run()
