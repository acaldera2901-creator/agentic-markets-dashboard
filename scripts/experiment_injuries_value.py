"""MEASURE-2224: does injury/absence data improve the SERVED football model?

The honest test of the '40% of the gap = lineups/injuries' attribution, using
the API-Football FREE historical dataset (seasons 2022-2024, harvested into
data/api_football/ — 41k injury records, 5.3k fixtures, 5 leagues).

Protocol:
  1. absence counts per fixture per side from injuries_{LG}_{SEASON}.json
     (each record carries fixture.id; fixtures_{...}.json gives teams+date)
  2. join with the walk-forward replay of the served model
     (/tmp/served_predictions.csv from experiment-isotonic-export.ts,
     w=0.5 production) by (league, date, normalized home/away)
  3. incremental value: multinomial logistic stacking —
       baseline:  log-probs of the served model (3)
       candidate: + inj_home, inj_away, inj_diff
     train seasons 2022-2023, holdout season 2024. Brier/ECE compared.

Read-only vs prod. Run: ./venv/bin/python scripts/experiment_injuries_value.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "api_football"
PRED_CSV = "/tmp/served_predictions.csv"
LEAGUES = ("PL", "SA", "PD", "BL1", "FL1")
SEASONS = ("2022", "2023", "2024")

_SUFFIX = re.compile(
    r"\b(fc|cf|afc|ac|as|ssc|ss|us|rc|sc|sv|vfb|vfl|tsg|rb|1\.\s?fc|cd|ud|deportivo|club|calcio|hellas)\b"
)


def norm(name: str) -> str:
    n = name.lower().replace("&", "and")
    n = _SUFFIX.sub("", n)
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    return " ".join(n.split())


# understat ↔ api-football spellings that survive suffix-stripping differences
ALIASES = {
    # understat spelling -> canon(api-football spelling), verified against the
    # harvested fixtures files (MEASURE-2224)
    "wolverhampton wanderers": "wolves",
    "parma 1913": "parma",
    "fc cologne": "k ln",  # "1. FC Köln" -> suffix+accent-stripped
    "mainz 05": "fsv mainz 05",
    "rasenballsport leipzig": "leipzig",      # "RB Leipzig" -> suffix-stripped
    "hoffenheim": "1899 hoffenheim",
    "greuther fuerth": "spvgg greuther f rth",
    "brest": "stade brestois 29",
    "troyes": "estac troyes",
    "darmstadt": "sv darmstadt 98",
}


def canon(name: str) -> str:
    n = norm(name)
    return ALIASES.get(n, n)


def load_absences() -> dict[tuple[str, str, str, str], tuple[int, int]]:
    """(league, date, home_key, away_key) -> (inj_home, inj_away)."""
    out: dict[tuple[str, str, str, str], tuple[int, int]] = {}
    for lg in LEAGUES:
        for season in SEASONS:
            fx_path = DATA / f"fixtures_{lg}_{season}.json"
            inj_path = DATA / f"injuries_{lg}_{season}.json"
            if not fx_path.exists() or not inj_path.exists():
                continue
            fixtures = {}
            for f in json.load(open(fx_path)).get("response", []):
                fid = f["fixture"]["id"]
                fixtures[fid] = {
                    "date": str(f["fixture"]["date"])[:10],
                    "home": f["teams"]["home"]["name"],
                    "away": f["teams"]["away"]["name"],
                }
            counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
            for r in json.load(open(inj_path)).get("response", []):
                fid = (r.get("fixture") or {}).get("id")
                team = (r.get("team") or {}).get("name", "")
                if fid in fixtures and team:
                    counts[fid][canon(team)] += 1
            for fid, fx in fixtures.items():
                hk, ak = canon(fx["home"]), canon(fx["away"])
                c = counts.get(fid, {})
                out[(lg, fx["date"], hk, ak)] = (c.get(hk, 0), c.get(ak, 0))
    return out


def main() -> None:
    absences = load_absences()
    print(f"fixture con dato assenze: {len(absences)}")

    rows = list(csv.DictReader(open(PRED_CSV)))
    joined, missed = [], 0
    for r in rows:
        key = (r["league"], r["date"][:10], canon(r["home"]), canon(r["away"]))
        hit = absences.get(key)
        if hit is None:
            missed += 1
            continue
        joined.append((r, hit))
    print(f"predizioni: {len(rows)} | joinate: {len(joined)} ({len(joined)/len(rows)*100:.1f}%) | perse: {missed}")
    if len(joined) < 2000:
        print("⚠️ join rate basso — controllare alias nomi prima di trarre conclusioni")

    X_base, X_inj, y, seasons = [], [], [], []
    for r, (ih, ia) in joined:
        p = np.clip([float(r["pHome"]), float(r["pDraw"]), float(r["pAway"])], 1e-6, 1)
        lp = list(np.log(p))
        X_base.append(lp)
        X_inj.append(lp + [ih, ia, ih - ia])
        y.append(int(r["outcome"]))
        seasons.append(r["season"])
    X_base, X_inj, y = np.array(X_base), np.array(X_inj), np.array(y)
    seasons = np.array(seasons)

    tr = seasons != "2024"
    ho = seasons == "2024"
    print(f"train (2022-23): {tr.sum()} | holdout (2024): {ho.sum()}")

    def brier(p: np.ndarray, yy: np.ndarray) -> float:
        return float(np.mean(np.sum((p - np.eye(3)[yy]) ** 2, axis=1)))

    def ece(p: np.ndarray, yy: np.ndarray, bins: int = 10) -> float:
        tot = 0.0
        for k in range(3):
            conf, hit = p[:, k], (yy == k).astype(float)
            e = 0.0
            for b in range(bins):
                lo, hi = b / bins, (b + 1) / bins
                m = (conf >= lo) & (conf < hi if b < bins - 1 else conf <= hi)
                if m.sum():
                    e += (m.sum() / len(conf)) * abs(conf[m].mean() - hit[m].mean())
            tot += e
        return tot / 3

    # raw served probs on holdout (no stacking at all) — the true reference
    p_raw = np.exp(X_base[ho])
    p_raw = p_raw / p_raw.sum(axis=1, keepdims=True)
    print(f"\nHOLDOUT 2024 — servito puro:            Brier {brier(p_raw, y[ho]):.4f}  ECE {ece(p_raw, y[ho]):.4f}")

    base = LogisticRegression(max_iter=2000).fit(X_base[tr], y[tr])
    p_b = base.predict_proba(X_base[ho])
    print(f"HOLDOUT 2024 — stack log-probs (base):  Brier {brier(p_b, y[ho]):.4f}  ECE {ece(p_b, y[ho]):.4f}")

    cand = LogisticRegression(max_iter=2000).fit(X_inj[tr], y[tr])
    p_c = cand.predict_proba(X_inj[ho])
    print(f"HOLDOUT 2024 — stack + assenze:         Brier {brier(p_c, y[ho]):.4f}  ECE {ece(p_c, y[ho]):.4f}")
    delta = brier(p_c, y[ho]) - brier(p_b, y[ho])
    print(f"\nΔ Brier della feature assenze: {delta:+.4f} ({'MIGLIORA' if delta < -0.0005 else 'NEUTRA/PEGGIORA'})")

    # diagnostics: does absence asymmetry correlate with outcomes at all?
    inj_diff = X_inj[:, 5]
    home_win = (y == 0).astype(float)
    big = np.abs(inj_diff) >= 3
    if big.sum() > 50:
        adv_away = inj_diff >= 3  # home has 3+ more absences
        adv_home = inj_diff <= -3
        print(f"\nsanity: P(vittoria casa) quando casa ha 3+ assenti in più: {home_win[adv_away].mean():.3f} (n={int(adv_away.sum())})")
        print(f"        P(vittoria casa) quando ospite ha 3+ assenti in più: {home_win[adv_home].mean():.3f} (n={int(adv_home.sum())})")
        print(f"        P(vittoria casa) media: {home_win.mean():.3f}")


if __name__ == "__main__":
    main()
