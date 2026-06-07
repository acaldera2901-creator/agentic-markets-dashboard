"""P3 (PROPOSAL accuracy WC, msg_mq3ufltj): venue-factor predictive-power study.

ANALYSIS ONLY — does not touch the served model. Measures whether travel_km,
rest_days, and altitude_delta carry out-of-sample predictive signal on the
historical international-results dataset, on top of a market-free skill baseline
(home/elo-style strength + home advantage).

Method
------
- Sample: matches in the Americas + high-altitude venues since 2002 where both
  teams' home coordinates and the venue city are resolvable (so travel/altitude
  are real, not imputed). Neutral and non-neutral both kept; a `host` indicator
  absorbs the ordinary home effect.
- Outcome: 3-class (home win / draw / away win).
- Baseline features: a pre-match strength gap (rolling goal-difference form,
  leakage-free) + host indicator. This is the "without the factor" model.
- Treatment: baseline + one venue factor at a time, then all together.
- Estimator: multinomial logistic regression (sklearn), standardized features.
- Validation: temporal walk-forward — sort by date, expanding-window folds,
  always predict matches strictly after the training cut. Report out-of-sample
  multiclass Brier and log-loss, delta vs baseline.
- Verdict per factor against the promotion-gate spirit (#HARNESS-1): a factor is
  PROMOTE-eligible only if it improves OOS Brier beyond the gate tolerance
  (>= 0.002) AND log-loss also improves AND the coefficient sign is sensible.
  Otherwise BOCCIA.

Usage:  ./.venv/bin/python scripts/backtest_venue_factors.py
"""
from __future__ import annotations

import csv
import sys
from collections import defaultdict
from datetime import date
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from core.world_cup_venue_context import TEAM_HOME  # noqa: E402

CSV = ROOT / "data" / "national_teams" / "international_results_raw.csv"
EARTH_KM = 6371.0


# City -> (lat, lon, altitude_m). Focused on the Americas + the documented
# high-altitude venues, which is where travel/altitude actually vary. Verified
# city-centre figures (2026-06-07). Keys lowercased/stripped on lookup.
CITY_GEO: dict[str, tuple[float, float, int]] = {
    # High-altitude (the signal-bearing venues)
    "mexico city": (19.43, -99.13, 2240),
    "toluca": (19.29, -99.66, 2660),
    "puebla": (19.04, -98.21, 2135),
    "guadalajara": (20.67, -103.35, 1566),
    "la paz": (-16.5, -68.15, 3640),
    "quito": (-0.18, -78.47, 2850),
    "bogota": (4.71, -74.07, 2640),
    "bogotá": (4.71, -74.07, 2640),
    "cusco": (-13.53, -71.97, 3399),
    "cochabamba": (-17.39, -66.16, 2558),
    "sucre": (-19.03, -65.26, 2810),
    "san josé": (9.93, -84.08, 1170),
    "san jose": (9.93, -84.08, 1170),   # Costa Rica capital (ambiguous w/ CA below; handled by country)
    "addis ababa": (9.03, 38.74, 2355),
    "johannesburg": (-26.2, 28.04, 1753),
    "pretoria": (-25.75, 28.19, 1339),
    # Americas low-altitude venues
    "houston": (29.76, -95.37, 15),
    "miami": (25.76, -80.19, 2),
    "miami gardens": (25.96, -80.24, 2),
    "fort lauderdale": (26.12, -80.14, 3),
    "east rutherford": (40.81, -74.07, 3),
    "harrison": (40.74, -74.16, 3),
    "los angeles": (34.05, -118.24, 30),
    "carson": (33.83, -118.28, 12),
    "inglewood": (33.96, -118.35, 30),
    "pasadena": (34.15, -118.14, 263),
    "foxborough": (42.09, -71.26, 43),
    "washington, d.c.": (38.9, -77.04, 25),
    "chicago": (41.88, -87.63, 181),
    "bridgeview": (41.75, -87.8, 180),
    "arlington": (32.74, -97.09, 140),
    "frisco": (33.15, -96.82, 200),
    "dallas": (32.78, -96.8, 130),
    "glendale": (33.53, -112.19, 340),
    "san diego": (32.72, -117.16, 19),
    "seattle": (47.61, -122.33, 50),
    "atlanta": (33.75, -84.39, 320),
    "kansas city": (39.1, -94.58, 270),
    "philadelphia": (39.95, -75.16, 12),
    "chester": (39.85, -75.36, 8),
    "santa clara": (37.35, -121.95, 3),
    "columbus": (39.96, -82.99, 275),
    "nashville": (36.16, -86.78, 169),
    "charlotte": (35.23, -80.84, 229),
    "denver": (39.74, -104.99, 1609),
    "commerce city": (39.81, -104.89, 1580),
    "tampa": (27.95, -82.46, 14),
    "orlando": (28.54, -81.38, 32),
    "austin": (30.27, -97.74, 149),
    "san antonio": (29.42, -98.49, 198),
    "salt lake city": (40.76, -111.89, 1288),
    "sandy": (40.57, -111.84, 1340),
    "phoenix": (33.45, -112.07, 331),
    "las vegas": (36.17, -115.14, 610),
    "st. louis": (38.63, -90.2, 142),
    "saint louis": (38.63, -90.2, 142),
    "cincinnati": (39.1, -84.51, 147),
    "cleveland": (41.5, -81.69, 199),
    "new york": (40.71, -74.01, 10),
    "toronto": (43.65, -79.38, 76),
    "vancouver": (49.28, -123.12, 2),
    "montreal": (45.5, -73.57, 36),
    "edmonton": (53.55, -113.49, 668),
    "monterrey": (25.67, -100.31, 540),
    "guadalupe": (25.68, -100.26, 540),
    "san pedro sula": (15.5, -88.03, 60),
    "tegucigalpa": (14.07, -87.19, 990),
    "panama city": (8.98, -79.52, 2),
    "panamá": (8.98, -79.52, 2),
    "kingston": (18.02, -76.8, 9),
    "buenos aires": (-34.6, -58.38, 25),
    "rio de janeiro": (-22.91, -43.17, 2),
    "sao paulo": (-23.55, -46.63, 760),
    "são paulo": (-23.55, -46.63, 760),
    "montevideo": (-34.9, -56.16, 43),
    "asuncion": (-25.26, -57.58, 140),
    "asunción": (-25.26, -57.58, 140),
    "lima": (-12.05, -77.04, 154),
    "santiago": (-33.45, -70.67, 520),
    "barranquilla": (10.96, -74.8, 18),
    "guayaquil": (-2.19, -79.89, 4),
    "caracas": (10.49, -66.88, 909),
    "maracaibo": (10.65, -71.65, 6),
}

# San José disambiguation: in the dataset, USA "San Jose" (CA, sea level) vs
# Costa Rica "San José" (1170 m). Resolve by country at lookup time.
SAN_JOSE_US = (37.34, -121.89, 26)


def _haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    (la1, lo1), (la2, lo2) = a, b
    la1, lo1, la2, lo2 = map(radians, (la1, lo1, la2, lo2))
    h = sin((la2 - la1) / 2) ** 2 + cos(la1) * cos(la2) * sin((lo2 - lo1) / 2) ** 2
    return 2 * EARTH_KM * asin(sqrt(h))


# Home altitude per team, reusing the venue table where the team's home city is
# a known geo key; else a curated value. None -> drop altitude_delta for that row.
_TEAM_ALT: dict[str, int] = {
    "Mexico": 2240, "Bolivia": 3640, "Ecuador": 2850, "Colombia": 2640,
    "Peru": 154, "Chile": 520, "Argentina": 25, "Brazil": 760, "Uruguay": 43,
    "Paraguay": 140, "Venezuela": 909, "United States": 25, "Canada": 76,
    "Costa Rica": 1170, "Honduras": 990, "Panama": 2, "Jamaica": 9,
    "El Salvador": 658, "Guatemala": 1500, "Ethiopia": 2355,
    "South Africa": 1753, "France": 35, "England": 35, "Spain": 667,
    "Portugal": 10, "Germany": 34, "Netherlands": 0, "Belgium": 13,
    "Italy": 21, "Croatia": 122, "Morocco": 75, "Senegal": 22, "Japan": 40,
    "South Korea": 38, "Australia": 6, "Nigeria": 156, "Ghana": 61,
}


def _city_geo(city: str, country: str) -> tuple[float, float, int] | None:
    key = " ".join((city or "").strip().lower().split())
    if key in ("san jose", "san josé") and country.strip().lower() == "united states":
        return SAN_JOSE_US
    return CITY_GEO.get(key)


def load_rows() -> list[dict]:
    rows = []
    with open(CSV) as fh:
        for r in csv.DictReader(fh):
            try:
                d = date.fromisoformat(r["date"])
                hg, ag = int(r["home_score"]), int(r["away_score"])
            except (ValueError, KeyError):
                continue
            rows.append({
                "date": d, "home": r["home_team"].strip(), "away": r["away_team"].strip(),
                "hg": hg, "ag": ag, "city": r["city"].strip(),
                "country": r["country"].strip(),
                "neutral": str(r["neutral"]).strip().upper() in ("TRUE", "1"),
            })
    rows.sort(key=lambda m: m["date"])
    return rows


def build_dataset(rows: list[dict]) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[str]]:
    """Return X (raw features), y (0/1/2), dates, feature_names. Only rows where
    every venue factor is resolvable for BOTH teams are kept (no imputation)."""
    # leakage-free rolling strength: mean goal difference over last K matches.
    K = 10
    last_dates: dict[str, date] = {}
    gd_hist: dict[str, list[int]] = defaultdict(list)

    feats, ys, dts = [], [], []
    feature_names = ["strength_gap", "host", "travel_diff_km", "rest_diff", "alt_delta_diff"]

    for m in rows:
        home, away = m["home"], m["away"]
        geo = _city_geo(m["city"], m["country"])
        h_home = TEAM_HOME.get(home)
        a_home = TEAM_HOME.get(away)
        h_alt = _TEAM_ALT.get(home)
        a_alt = _TEAM_ALT.get(away)

        resolvable = (
            m["date"] >= date(2002, 1, 1)
            and geo is not None and h_home is not None and a_home is not None
            and h_alt is not None and a_alt is not None
            and len(gd_hist[home]) >= 3 and len(gd_hist[away]) >= 3
        )
        if resolvable:
            vlat, vlon, valt = geo
            travel_h = _haversine(h_home[0], (vlat, vlon))
            travel_a = _haversine(a_home[0], (vlat, vlon))
            rest_h = (m["date"] - last_dates[home]).days if home in last_dates else 14
            rest_a = (m["date"] - last_dates[away]).days if away in last_dates else 14
            rest_h, rest_a = min(rest_h, 30), min(rest_a, 30)
            strength = float(np.mean(gd_hist[home][-K:]) - np.mean(gd_hist[away][-K:]))
            host = 0.0 if m["neutral"] else 1.0
            alt_delta_diff = (valt - h_alt) - (valt - a_alt)  # = a_alt - h_alt
            feats.append([
                strength, host,
                travel_h - travel_a,
                float(rest_h - rest_a),
                float(alt_delta_diff),
            ])
            ys.append(0 if m["hg"] > m["ag"] else 1 if m["hg"] == m["ag"] else 2)
            dts.append(m["date"])

        gd = m["hg"] - m["ag"]
        gd_hist[home].append(gd)
        gd_hist[away].append(-gd)
        last_dates[home] = m["date"]
        last_dates[away] = m["date"]

    return np.array(feats), np.array(ys), np.array(dts), feature_names


def walk_forward(X: np.ndarray, y: np.ndarray, dts: np.ndarray, cols: list[int],
                 n_folds: int = 5) -> tuple[float, float, int]:
    """Expanding-window temporal CV. Returns (brier, logloss, n_eval)."""
    order = np.argsort(dts)
    X, y, dts = X[order], y[order], dts[order]
    n = len(y)
    start = n // (n_folds + 1)
    briers, lls, total = [], [], 0
    for f in range(1, n_folds + 1):
        cut = start * f
        end = start * (f + 1) if f < n_folds else n
        tr, te = slice(0, cut), slice(cut, end)
        if te.stop - te.start < 20 or len(np.unique(y[tr])) < 3:
            continue
        Xt = X[:, cols]
        sc = StandardScaler().fit(Xt[tr])
        clf = LogisticRegression(max_iter=2000, C=1.0)
        clf.fit(sc.transform(Xt[tr]), y[tr])
        p = clf.predict_proba(sc.transform(Xt[te]))
        # align to 3 classes
        proba = np.zeros((len(p), 3))
        for j, c in enumerate(clf.classes_):
            proba[:, c] = p[:, j]
        proba = np.clip(proba, 1e-9, 1)
        proba /= proba.sum(axis=1, keepdims=True)
        onehot = np.eye(3)[y[te]]
        briers.append(np.mean(np.sum((proba - onehot) ** 2, axis=1)))
        lls.append(-np.mean(np.log(proba[np.arange(len(y[te])), y[te]])))
        total += len(y[te])
    return float(np.mean(briers)), float(np.mean(lls)), total


def fit_coeffs(X: np.ndarray, y: np.ndarray, cols: list[int], names: list[str]):
    sc = StandardScaler().fit(X[:, cols])
    clf = LogisticRegression(max_iter=2000, C=1.0).fit(sc.transform(X[:, cols]), y)
    # away-win class coefficients (index of class 2) — interpretable as "factor
    # raises away-win odds". Bootstrap SE.
    cls = list(clf.classes_)
    if 2 not in cls:
        return {}
    ai = cls.index(2)
    base = clf.coef_[ai]
    rng = np.random.default_rng(7)
    boots = []
    Xc = X[:, cols]
    for _ in range(200):
        idx = rng.integers(0, len(y), len(y))
        scb = StandardScaler().fit(Xc[idx])
        cb = LogisticRegression(max_iter=1000, C=1.0).fit(scb.transform(Xc[idx]), y[idx])
        if 2 in list(cb.classes_):
            boots.append(cb.coef_[list(cb.classes_).index(2)])
    se = np.std(np.array(boots), axis=0) if boots else np.full(len(base), np.nan)
    return {names[cols[i]]: (float(base[i]), float(se[i])) for i in range(len(cols))}


def main() -> None:
    rows = load_rows()
    X, y, dts, names = build_dataset(rows)
    print(f"# sample: {len(y)} matches (2002+, venue+travel+altitude resolvable for both teams)")
    if len(y) < 200:
        print("BOCCIA ALL: sample too small for a credible out-of-sample verdict.")
        return
    dist = np.bincount(y, minlength=3)
    print(f"# outcomes: home={dist[0]} draw={dist[1]} away={dist[2]}\n")

    base_cols = [0, 1]  # strength_gap, host
    b_brier, b_ll, b_n = walk_forward(X, y, dts, base_cols)
    print(f"BASELINE (strength_gap + host): Brier={b_brier:.4f} logloss={b_ll:.4f} n_oos={b_n}\n")

    factors = {
        "travel_diff_km": 2,
        "rest_diff": 3,
        "alt_delta_diff": 4,
    }
    print(f"{'factor':16s} {'Brier':>8s} {'dBrier':>9s} {'logloss':>9s} {'dLL':>9s}  verdict")
    coeff_all = fit_coeffs(X, y, [0, 1] + list(factors.values()), names)
    for fname, ci in factors.items():
        br, ll, _ = walk_forward(X, y, dts, base_cols + [ci])
        d_br = br - b_brier
        d_ll = ll - b_ll
        improves = (-d_br) >= 0.002 and d_ll < 0
        verdict = "PROMUOVI*" if improves else "BOCCIA"
        print(f"{fname:16s} {br:8.4f} {d_br:+9.4f} {ll:9.4f} {d_ll:+9.4f}  {verdict}")

    print("\n# coefficients (multinomial logit, away-win class; standardized; bootstrap SE n=200)")
    for fname in ["strength_gap", "host", "travel_diff_km", "rest_diff", "alt_delta_diff"]:
        if fname in coeff_all:
            c, se = coeff_all[fname]
            z = c / se if se else float("nan")
            print(f"  {fname:16s} coef={c:+.4f}  se={se:.4f}  z={z:+.2f}")

    full_br, full_ll, _ = walk_forward(X, y, dts, base_cols + list(factors.values()))
    print(f"\nALL FACTORS together: Brier={full_br:.4f} (Δ{full_br - b_brier:+.4f}) "
          f"logloss={full_ll:.4f} (Δ{full_ll - b_ll:+.4f})")
    print("\n* PROMUOVI is gate-eligibility only (OOS Brier improvement >= gate tol 0.002 "
          "AND logloss improves). Final promotion still needs promotion_gate.py green on the "
          "SERVED model + human APPROVE.")


if __name__ == "__main__":
    main()
