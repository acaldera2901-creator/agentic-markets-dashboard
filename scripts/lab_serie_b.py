"""Walk-forward validation of the served football pipeline on Italian Serie B (I2).

Quality gate for #SERIE-B-1 (same discipline as #SUMMER-LEAGUES-1): before Serie B
is wired to the customer board it must clear the quality bar on held-out data, on
the SAME blend the board actually serves — not on the raw Poisson.

Faithful replica of the TS serving path (lib/poisson-model.ts + lib/calibration.ts
+ app/api/predictions/route.ts), so the numbers here predict live behaviour:

  1. buildModel  : per-team home/away attack+defense ratios, shrunk toward 1.0
                   with SHRINKAGE_PRIOR=4 (needs >=8 training matches).
  2. predict     : bivariate Poisson (11x11 grid). NO xG — Serie B has no Understat
                   coverage and is wired as a summer-league (xg={} in route.ts),
                   so pure-goals is the faithful model.
  3. temperature : tau=1.20 (applyTemperature), applied BEFORE the blend.
  4. market blend: p = 0.30*model + 0.70*devig(closing line)  (MARKET_BLEND_ALPHA).
                   Only fixtures with real closing odds are served (summer-league
                   rule: a fixture without real odds is NOT served) -> validated
                   exactly on that subset.
  5. surfacing   : a row is a directional pick only if max-prob(served) >= floor.

Walk-forward: matches sorted by date; each match is predicted by a model trained
ONLY on matches in the trailing 365 days (mirrors the shipped 365-day snapshot the
board rebuilds the model from). Real market closing line from football-data.co.uk
(Pinnacle PSC* -> market-average AvgC* fallback), de-vigged.

Run: venv/bin/python scripts/lab_serie_b.py
No new deps (stdlib only). Network: football-data.co.uk I2 CSVs.
"""
from __future__ import annotations

import math
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core import football_data_uk as fd  # noqa: E402

# ── serving constants (mirror lib/poisson-model.ts / calibration.ts) ─────────
SHRINKAGE_PRIOR = 4
MIN_MATCHES_PER_TEAM = 4
MIN_TRAIN_MATCHES = 8
CALIBRATION_TAU = 1.20
MARKET_BLEND_ALPHA = 0.30
TRAIN_WINDOW_DAYS = 365
SEASONS = [2022, 2023, 2024, 2025]  # I2 2022/23 .. 2025/26 (all with closing odds)


def poisson_pmf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam + k * math.log(lam) - math.lgamma(k + 1))


def build_model(matches: list[dict]) -> dict | None:
    if len(matches) < MIN_TRAIN_MATCHES:
        return None
    hg, hc, ag, ac = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)
    for m in matches:
        hg[m["home"]].append(m["hg"]); hc[m["home"]].append(m["ag"])
        ag[m["away"]].append(m["ag"]); ac[m["away"]].append(m["hg"])
    avg_home = sum(m["hg"] for m in matches) / len(matches)
    avg_away = sum(m["ag"] for m in matches) / len(matches)
    if avg_home <= 0 or avg_away <= 0:
        return None
    teams = set(hg) | set(ag)

    def shrink(raw: float, n: int) -> float:
        return (raw * n + 1.0 * SHRINKAGE_PRIOR) / (n + SHRINKAGE_PRIOR)

    def mean(xs: list[float], default: float) -> float:
        return sum(xs) / len(xs) if xs else default

    strengths = {}
    for t in teams:
        gh, ch, ga, ca = hg[t], hc[t], ag[t], ac[t]
        strengths[t] = {
            "aH": shrink(mean(gh, avg_home) / avg_home, len(gh)),
            "dH": shrink(mean(ch, avg_away) / avg_away, len(ch)),
            "aA": shrink(mean(ga, avg_away) / avg_away, len(ga)),
            "dA": shrink(mean(ca, avg_home) / avg_home, len(ca)),
            "matches": len(gh) + len(ga),
        }
    return {"strengths": strengths, "avg_home": avg_home, "avg_away": avg_away}


def predict(home: str, away: str, model: dict) -> dict | None:
    h = model["strengths"].get(home)
    a = model["strengths"].get(away)
    if not h or not a:
        return None
    reliable = min(h["matches"], a["matches"]) >= MIN_MATCHES_PER_TEAM
    lam_h = h["aH"] * a["dA"] * model["avg_home"]
    lam_a = a["aA"] * h["dH"] * model["avg_away"]
    ph = pd = pa = 0.0
    for i in range(11):
        pi = poisson_pmf(i, lam_h)
        for j in range(11):
            p = pi * poisson_pmf(j, lam_a)
            if i > j:
                ph += p
            elif i == j:
                pd += p
            else:
                pa += p
    t = ph + pd + pa
    return {"pH": ph / t, "pD": pd / t, "pA": pa / t, "reliable": reliable}


def temperature(p: tuple[float, float, float], tau: float = CALIBRATION_TAU) -> tuple[float, float, float]:
    if tau == 1.0:
        return p
    h, d, a = (max(x, 1e-9) ** (1 / tau) for x in p)
    s = h + d + a
    return (h / s, d / s, a / s)


def blend(model_p: tuple[float, float, float], market: tuple[float, float, float] | None,
          alpha: float = MARKET_BLEND_ALPHA) -> tuple[float, float, float]:
    if market is None or alpha >= 1:
        return model_p
    return tuple(alpha * m + (1 - alpha) * k for m, k in zip(model_p, market))


def brier(p: tuple[float, float, float], outcome: str) -> float:
    y = {"H": (1, 0, 0), "D": (0, 1, 0), "A": (0, 0, 1)}[outcome]
    return sum((pi - yi) ** 2 for pi, yi in zip(p, y))


def load_matches() -> list[dict]:
    out: list[dict] = []
    for yr in SEASONS:
        try:
            fdms = fd.parse_csv(fd.download_csv("SB", yr), "SB")
        except Exception as e:  # noqa: BLE001
            print(f"  ! season {yr} download failed: {e}")
            continue
        for m in fdms:
            ch, cd, ca = m.closing_home, m.closing_draw, m.closing_away
            out.append({
                "date": m.date, "home": m.home_team, "away": m.away_team,
                "hg": m.home_goals, "ag": m.away_goals, "result": m.result,
                "oh": ch, "od": cd, "oa": ca,
            })
    out.sort(key=lambda x: x["date"])
    return out


def main() -> None:
    print("Loading Serie B (I2) closing-odds history from football-data.co.uk ...")
    matches = load_matches()
    print(f"  {len(matches)} matches, {matches[0]['date']} .. {matches[-1]['date']}")

    from datetime import timedelta

    evaluated = []  # served rows with real odds (the ones the board would serve)
    for idx, m in enumerate(matches):
        window_start = m["date"] - timedelta(days=TRAIN_WINDOW_DAYS)
        train = [x for x in matches[:idx] if window_start <= x["date"] < m["date"]]
        model = build_model(train)
        if model is None:
            continue
        pr = predict(m["home"], m["away"], model)
        if pr is None or not pr["reliable"]:
            continue
        market = fd.implied_probs(m["oh"], m["od"], m["oa"])
        if market is None:  # summer-league rule: no real odds -> not served
            continue
        model_p = temperature((pr["pH"], pr["pD"], pr["pA"]))
        served = blend(model_p, market)
        conf = max(served) * 100
        pick = "HDA"[served.index(max(served))]
        evaluated.append({
            "conf": conf, "pick": pick, "result": m["result"],
            "hit": pick == m["result"],
            "brier_served": brier(served, m["result"]),
            "brier_market": brier(market, m["result"]),
            "served": served,
            "season": m["date"].year if m["date"].month >= 7 else m["date"].year - 1,
        })

    n = len(evaluated)
    n_years = (matches[-1]["date"] - matches[0]["date"]).days / 365.0
    print(f"\nEvaluated (reliable + real odds) : {n} matches over {n_years:.1f} yr")
    if n == 0:
        print("No evaluable matches."); return

    bs = sum(e["brier_served"] for e in evaluated) / n
    bm = sum(e["brier_market"] for e in evaluated) / n
    print(f"Brier  served(blend)={bs:.4f}   market-only={bm:.4f}   (lower=better)")

    # Calibration (ECE) on the served favourite probability.
    bins = defaultdict(lambda: [0, 0.0])  # decile -> [count, sum_prob], hits sep
    hits_bin = defaultdict(int)
    for e in evaluated:
        b = min(int((max(e["served"])) * 10), 9)
        bins[b][0] += 1
        bins[b][1] += max(e["served"])
        hits_bin[b] += 1 if e["hit"] else 0
    ece = 0.0
    for b, (cnt, psum) in bins.items():
        conf = psum / cnt
        acc = hits_bin[b] / cnt
        ece += (cnt / n) * abs(conf - acc)
    print(f"ECE (favourite calibration)      : {ece:.4f}")

    print("\nFloor sweep (surfaced directional picks):")
    print(f"  {'floor':>5} {'picks':>6} {'picks/yr':>9} {'hit-rate':>9} {'vol%':>6}")
    for floor in (56, 58, 60, 62, 65, 68):
        surf = [e for e in evaluated if e["conf"] >= floor]
        if not surf:
            print(f"  {floor:>5} {0:>6} {'-':>9} {'-':>9} {'-':>6}")
            continue
        hr = sum(e["hit"] for e in surf) / len(surf)
        print(f"  {floor:>5} {len(surf):>6} {len(surf)/n_years:>9.1f} {hr*100:>8.1f}% {len(surf)/n*100:>5.1f}%")

    print("\nBaseline: overall accuracy of served favourite (no floor):",
          f"{sum(e['hit'] for e in evaluated)/n*100:.1f}%  (n={n})")

    # Per-season robustness: a floor that only holds because one season carries
    # the aggregate is not safe to serve. `evaluated` preserves match order, so we
    # attach each row's season during the main loop instead (see `season` key).
    def season_of(d) -> int:
        return d.year if d.month >= 7 else d.year - 1

    print("\nPer-season robustness (hit-rate @ floor · n picks):")
    print(f"  {'season':>9} {'f56':>13} {'f58':>13} {'f60':>13}")
    seasons = sorted({e["season"] for e in evaluated})
    for s in seasons:
        cells = []
        for floor in (56, 58, 60):
            picks = [e["hit"] for e in evaluated if e["season"] == s and e["conf"] >= floor]
            cells.append(f"{sum(picks)/len(picks)*100:4.0f}% ({len(picks):>2})" if picks else f"{'-':>9}")
        print(f"  {s}/{(s + 1) % 100:02d} " + " ".join(f"{c:>13}" for c in cells))


if __name__ == "__main__":
    main()
