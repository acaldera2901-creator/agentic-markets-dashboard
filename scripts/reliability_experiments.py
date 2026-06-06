"""FASE 4 — reliability upgrade experiments over Poisson v1 (served baseline).

Walk-forward over football-data.co.uk (results + Pinnacle/avg closing odds), 5
leagues x 5 seasons (2021-2025). For every test we collect, on the SAME held-out
matches, the 1X2 probability vector and score Brier / log-loss / ECE / accuracy
against the realized result. The market (de-vigged Pinnacle closing) is the
reference ceiling.

Experiments:
  base      Poisson v1 (faithful port of lib/poisson-model.ts, goals-only)
  xgblend   Poisson v1 with xG-blended ratings (w grid) — Football V4 served logic
  blend     p = a*p_model + (1-a)*p_market_devig  (grid on a)
  blend_xg  same blend but model = xgblend
  iso       isotonic recalibration per-class, fit past / apply forward
  shrunk    selective shrink toward market only where p_model < 0.35 (underdog)

This is a research harness. Read-only on data. No DB writes, no prod imports.

Run:  .venv/bin/python -m scripts.reliability_experiments
"""
from __future__ import annotations

import csv
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import (  # noqa: E402
    DIVISION_MAP,
    FDMatch,
    implied_probs,
    parse_csv,
)

CACHE = ROOT / "data" / "football_data_uk"
USTAT = ROOT / "data" / "understat"
LEAGUES = ["PL", "BL1", "SA", "PD", "FL1"]
START_YEARS = [2021, 2022, 2023, 2024, 2025]
WARMUP = 60
SHRINKAGE_PRIOR = 4
XG_BLEND_WEIGHT = 0.5
OUTCOMES = ("H", "D", "A")

# understat file naming (built from a quick listdir)
USTAT_FILES = {
    "PL": "EPL", "BL1": "Bundesliga", "SA": "Serie_A", "PD": "La_liga", "FL1": "Ligue_1",
}


def load_cached(league: str, year: int) -> list[FDMatch]:
    fp = CACHE / f"{league}_{DIVISION_MAP[league]}_{year}.csv"
    if not fp.exists():
        return []
    return parse_csv(fp.read_text(encoding="utf-8", errors="replace"), league)


# ── understat xG: per-team rolling last-10 home/away xG & xGA, league baselines ──
def load_understat(league: str) -> list[dict]:
    out: list[dict] = []
    name = USTAT_FILES[league]
    for yr in (2021, 2022, 2023, 2024):
        fp = USTAT / f"{league}_{name}_{yr}.csv"
        if not fp.exists():
            continue
        for r in csv.DictReader(fp.open()):
            try:
                out.append({
                    "date": r["date"], "home": r["home_team"], "away": r["away_team"],
                    "hxg": float(r["home_xg"]), "axg": float(r["away_xg"]),
                })
            except (ValueError, KeyError):
                continue
    out.sort(key=lambda x: x["date"])
    return out


def _norm(s: str) -> str:
    return s.lower().replace(".", "").replace("-", " ").strip()


# ── Poisson v1 port (parity with lib/poisson-model.ts) ──────────────────────────
def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 1.0


def _shrink(raw: float, n: int) -> float:
    return (raw * n + 1.0 * SHRINKAGE_PRIOR) / (n + SHRINKAGE_PRIOR)


def _pois(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    p = math.exp(-lam)
    for i in range(1, k + 1):
        p *= lam / i
    return p


def _scoreline_1x2(lam: float, mu: float) -> tuple[float, float, float]:
    ph = pd = pa = 0.0
    for i in range(11):
        for j in range(11):
            p = _pois(i, lam) * _pois(j, mu)
            if i > j:
                ph += p
            elif i == j:
                pd += p
            else:
                pa += p
    tot = ph + pd + pa
    return ph / tot, pd / tot, pa / tot


def poisson_v1(train: list[dict], home: str, away: str,
               xg_home: dict | None = None, xg_away: dict | None = None,
               xg_league: dict | None = None, w: float = 0.0) -> tuple[float, float, float] | None:
    if len(train) < 8:
        return None
    hg_t, hc_t = defaultdict(list), defaultdict(list)
    ag_t, ac_t = defaultdict(list), defaultdict(list)
    for r in train:
        hg_t[r["home_team"]].append(r["home_goals"])
        hc_t[r["home_team"]].append(r["away_goals"])
        ag_t[r["away_team"]].append(r["away_goals"])
        ac_t[r["away_team"]].append(r["home_goals"])
    avg_home = _mean([r["home_goals"] for r in train])
    avg_away = _mean([r["away_goals"] for r in train])
    if avg_home <= 0 or avg_away <= 0:
        return None
    if home not in hg_t and home not in ag_t:
        return None
    if away not in ag_t and away not in hg_t:
        return None

    atk_h = _shrink(_mean(hg_t[home] if hg_t[home] else [avg_home]) / avg_home, len(hg_t[home]))
    def_h = _shrink(_mean(hc_t[home] if hc_t[home] else [avg_away]) / avg_away, len(hc_t[home]))
    atk_a = _shrink(_mean(ag_t[away] if ag_t[away] else [avg_away]) / avg_away, len(ag_t[away]))
    def_a = _shrink(_mean(ac_t[away] if ac_t[away] else [avg_home]) / avg_home, len(ac_t[away]))

    if w > 0 and xg_league and xg_league.get("home", 0) > 0 and xg_league.get("away", 0) > 0:
        def blend(goals: float, xgf: float | None, base: float) -> float:
            return (1 - w) * goals + w * (xgf / base) if xgf and xgf > 0 else goals
        if xg_home:
            atk_h = blend(atk_h, xg_home.get("xg_home"), xg_league["home"])
            def_h = blend(def_h, xg_home.get("xga_home"), xg_league["away"])
        if xg_away:
            atk_a = blend(atk_a, xg_away.get("xg_away"), xg_league["away"])
            def_a = blend(def_a, xg_away.get("xga_away"), xg_league["home"])

    lam = atk_h * def_a * avg_home
    mu = atk_a * def_h * avg_away
    return _scoreline_1x2(lam, mu)


# ── metrics ─────────────────────────────────────────────────────────────────────
def brier(p: tuple[float, float, float], o: str) -> float:
    t = {x: (1.0 if x == o else 0.0) for x in OUTCOMES}
    return sum((p[i] - t[ox]) ** 2 for i, ox in enumerate(OUTCOMES))


def logloss(p: tuple[float, float, float], o: str) -> float:
    return -math.log(max(p[OUTCOMES.index(o)], 1e-12))


def accuracy(p: tuple[float, float, float], o: str) -> int:
    return 1 if OUTCOMES[int(np.argmax(p))] == o else 0


def ece(probs: list[tuple[float, float, float]], outs: list[str], bins: int = 10) -> float:
    # ECE on the predicted (argmax) class confidence
    buckets: dict[int, list[tuple[float, int]]] = defaultdict(list)
    for p, o in zip(probs, outs):
        k = int(np.argmax(p))
        conf = p[k]
        hit = 1 if OUTCOMES[k] == o else 0
        b = min(int(conf * bins), bins - 1)
        buckets[b].append((conf, hit))
    n_tot = sum(len(v) for v in buckets.values())
    if not n_tot:
        return float("nan")
    e = 0.0
    for items in buckets.values():
        ap = sum(c for c, _ in items) / len(items)
        hr = sum(h for _, h in items) / len(items)
        e += len(items) * abs(ap - hr)
    return e / n_tot


def summarize(name: str, probs, outs) -> dict:
    return {
        "name": name,
        "n": len(probs),
        "brier": sum(brier(p, o) for p, o in zip(probs, outs)) / len(probs),
        "logloss": sum(logloss(p, o) for p, o in zip(probs, outs)) / len(probs),
        "acc": sum(accuracy(p, o) for p, o in zip(probs, outs)) / len(probs),
        "ece": ece(probs, outs),
    }


# ── isotonic per-class recalibration ─────────────────────────────────────────────
def isotonic_fit_apply(train_probs, train_y, test_probs):
    from sklearn.isotonic import IsotonicRegression
    cal = []
    for cls in range(3):
        ir = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
        x = [p[cls] for p in train_probs]
        y = [1.0 if OUTCOMES[o] == OUTCOMES[cls] else 0.0 for o in train_y]
        ir.fit(x, y)
        cal.append(ir)
    out = []
    for p in test_probs:
        raw = [cal[c].predict([p[c]])[0] for c in range(3)]
        s = sum(raw)
        out.append(tuple(r / s for r in raw) if s > 0 else p)
    return out


def main() -> None:
    # collect held-out predictions walk-forward; store everything, split later
    rows: list[dict] = []  # each: model probs, market, outcome, league
    for lg in LEAGUES:
        matches: list[FDMatch] = []
        for yr in START_YEARS:
            matches.extend(load_cached(lg, yr))
        matches.sort(key=lambda m: m.date)
        if len(matches) <= WARMUP:
            continue

        # understat rolling xG state (last-10 home & away per team)
        ustat = load_understat(lg)
        ustat_by_date: dict[str, list[dict]] = defaultdict(list)
        for u in ustat:
            ustat_by_date[u["date"]].append(u)
        team_xg_home: dict[str, list[float]] = defaultdict(list)
        team_xga_home: dict[str, list[float]] = defaultdict(list)
        team_xg_away: dict[str, list[float]] = defaultdict(list)
        team_xga_away: dict[str, list[float]] = defaultdict(list)
        ustat_idx = 0
        ustat_norm = {}  # normalized name -> team key used in xg dicts

        train: list[dict] = []
        for idx, m in enumerate(matches):
            # advance understat state up to (not including) this match date
            while ustat_idx < len(ustat) and ustat[ustat_idx]["date"] < m.date.isoformat():
                u = ustat[ustat_idx]
                hk, ak = _norm(u["home"]), _norm(u["away"])
                team_xg_home[hk].append(u["hxg"]); team_xga_home[hk].append(u["axg"])
                team_xg_away[ak].append(u["axg"]); team_xga_away[ak].append(u["hxg"])
                ustat_norm[hk] = hk; ustat_norm[ak] = ak
                ustat_idx += 1

            if idx >= WARMUP:
                mkt = implied_probs(m.closing_home, m.closing_draw, m.closing_away)
                base = poisson_v1(train, m.home_team, m.away_team)
                if base and mkt:
                    outcome = m.result if m.result in OUTCOMES else (
                        "H" if m.home_goals > m.away_goals else "A" if m.away_goals > m.home_goals else "D")

                    # xG-blended ratings (last-10 averages, league baselines)
                    def last10(d, k):
                        v = d.get(k, [])[-10:]
                        return sum(v) / len(v) if v else None
                    hk, ak = _norm(m.home_team), _norm(m.away_team)
                    all_h = [v for k in team_xg_home for v in team_xg_home[k][-10:]]
                    all_ha = [v for k in team_xga_home for v in team_xga_home[k][-10:]]
                    xg_league = None
                    if all_h and all_ha:
                        xg_league = {"home": sum(all_h) / len(all_h), "away": sum(all_ha) / len(all_ha)}
                    xg_home = {"xg_home": last10(team_xg_home, hk), "xga_home": last10(team_xga_home, hk)} if hk in ustat_norm else None
                    xg_away = {"xg_away": last10(team_xg_away, ak), "xga_away": last10(team_xga_away, ak)} if ak in ustat_norm else None
                    xgb = poisson_v1(train, m.home_team, m.away_team, xg_home, xg_away, xg_league, XG_BLEND_WEIGHT)

                    rows.append({
                        "lg": lg, "outcome": outcome, "mkt": mkt, "base": base,
                        "xgb": xgb or base,  # fall back to base if xg unavailable
                        "has_xg": xgb is not None and (xg_home is not None or xg_away is not None),
                    })
            train.append(m.as_model_match())

    n = len(rows)
    split = n // 2
    train_rows, test_rows = rows[:split], rows[split:]
    outs = [r["outcome"] for r in test_rows]
    y_train = [OUTCOMES.index(r["outcome"]) for r in train_rows]
    print(f"Total held-out predictions: {n}  | calib-train {split} / eval {n - split}")
    print(f"xG coverage on eval: {sum(1 for r in test_rows if r['has_xg'])}/{len(test_rows)}")

    results = []
    # baselines
    results.append(summarize("market (Pinnacle de-vig)", [r["mkt"] for r in test_rows], outs))
    results.append(summarize("Poisson v1 (base, served)", [r["base"] for r in test_rows], outs))
    results.append(summarize("xG-blend Poisson (V4 served)", [r["xgb"] for r in test_rows], outs))

    # market blend grid on base and xgb
    def blend_vec(a, key):
        return [tuple(a * r[key][i] + (1 - a) * r["mkt"][i] for i in range(3)) for r in test_rows]
    best_blend = None
    for a in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]:
        s = summarize(f"blend base a={a:.1f}", blend_vec(a, "base"), outs)
        results.append(s)
        if best_blend is None or s["brier"] < best_blend["brier"]:
            best_blend = s
    for a in [0.3, 0.4, 0.5, 0.6, 0.7]:
        results.append(summarize(f"blend xgb a={a:.1f}", blend_vec(a, "xgb"), outs))

    # isotonic recalibration (fit on train_rows base, apply to test base)
    iso_probs = isotonic_fit_apply([r["base"] for r in train_rows], y_train, [r["base"] for r in test_rows])
    results.append(summarize("isotonic recal (base)", iso_probs, outs))
    iso_xgb = isotonic_fit_apply([r["xgb"] for r in train_rows], y_train, [r["xgb"] for r in test_rows])
    results.append(summarize("isotonic recal (xgb)", iso_xgb, outs))

    # selective underdog shrink toward market where any model class < 0.35
    def shrink_underdog(beta):
        out = []
        for r in test_rows:
            p = list(r["base"])
            # blend toward market only on the side where model is an underdog
            newp = [beta * p[i] + (1 - beta) * r["mkt"][i] if p[i] < 0.35 else p[i] for i in range(3)]
            s = sum(newp)
            out.append(tuple(x / s for x in newp))
        return out
    for beta in [0.3, 0.5, 0.7]:
        results.append(summarize(f"underdog-shrink beta={beta:.1f}", shrink_underdog(beta), outs))

    # blend + isotonic on top of the blend (stack the two best levers)
    if best_blend:
        a = float(best_blend["name"].split("=")[1])
        blended = blend_vec(a, "base")
        blended_train = [tuple(a * r["base"][i] + (1 - a) * r["mkt"][i] for i in range(3)) for r in train_rows]
        iso_blend = isotonic_fit_apply(blended_train, y_train, blended)
        results.append(summarize(f"blend a={a:.1f} + isotonic", iso_blend, outs))

    # ── print table ──
    print("\n" + "=" * 88)
    print(f"{'model':<34}{'n':>6}{'Brier':>11}{'logloss':>11}{'acc':>9}{'ECE':>9}")
    print("-" * 88)
    base_brier = next(r for r in results if r["name"].startswith("Poisson v1"))["brier"]
    for r in results:
        delta = base_brier - r["brier"]
        flag = f"  Δ{delta:+.5f}" if not r["name"].startswith("Poisson v1") else "  (baseline)"
        print(f"{r['name']:<34}{r['n']:>6}{r['brier']:>11.5f}{r['logloss']:>11.5f}{r['acc']:>9.4f}{r['ece']:>9.4f}{flag}")
    print("=" * 88)


if __name__ == "__main__":
    main()
