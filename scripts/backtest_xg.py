"""Does xG actually move the needle? Measured on the Understat dataset.

Walk-forward on Understat (goals + xG). Compares a base model (Poisson + pi-rating
+ form) against the same model PLUS running xG form (attack/defence xG per team).
Isolates xG's marginal contribution to Brier. Market reference (~0.575) comes from
the separate football-data.co.uk CLV backtest (same leagues/seasons).

Run:  venv/bin/python -m scripts.backtest_xg
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.understat_data import XGMatch, load  # noqa: E402
from models.match_features import PiRating, form_ppg, result_char  # noqa: E402
from scripts.backtest_clv import brier_1x2, poisson_v1_predict  # noqa: E402

OUTCOMES = ("H", "D", "A")
WARMUP = 60
XG_PRIOR = 1.40  # league-average xG per match (neutral prior before a team has history)
PPDA_PRIOR = 10.0  # neutral pressing (passes allowed per defensive action)
MARKET_BRIER = 0.575  # reference from football-data.co.uk Pinnacle closing


class XGForm:
    """Running mean xG created / conceded per team."""

    def __init__(self) -> None:
        self.for_sum = defaultdict(float); self.for_n = defaultdict(int)
        self.against_sum = defaultdict(float); self.against_n = defaultdict(int)
        self.np_for = defaultdict(float); self.np_fn = defaultdict(int)
        self.np_ag = defaultdict(float); self.np_an = defaultdict(int)
        self.ppda_sum = defaultdict(float); self.ppda_n = defaultdict(int)

    def attack(self, team: str) -> float:
        return self.for_sum[team] / self.for_n[team] if self.for_n[team] >= 3 else XG_PRIOR

    def defense(self, team: str) -> float:
        return self.against_sum[team] / self.against_n[team] if self.against_n[team] >= 3 else XG_PRIOR

    def np_attack(self, team: str) -> float:
        return self.np_for[team] / self.np_fn[team] if self.np_fn[team] >= 3 else XG_PRIOR

    def np_defense(self, team: str) -> float:
        return self.np_ag[team] / self.np_an[team] if self.np_an[team] >= 3 else XG_PRIOR

    def ppda(self, team: str) -> float:
        return self.ppda_sum[team] / self.ppda_n[team] if self.ppda_n[team] >= 3 else PPDA_PRIOR

    def update(self, m: XGMatch) -> None:
        self.for_sum[m.home_team] += m.home_xg; self.for_n[m.home_team] += 1
        self.against_sum[m.home_team] += m.away_xg; self.against_n[m.home_team] += 1
        self.for_sum[m.away_team] += m.away_xg; self.for_n[m.away_team] += 1
        self.against_sum[m.away_team] += m.home_xg; self.against_n[m.away_team] += 1
        if m.home_npxg is not None and m.away_npxg is not None:
            self.np_for[m.home_team] += m.home_npxg; self.np_fn[m.home_team] += 1
            self.np_ag[m.home_team] += m.away_npxg; self.np_an[m.home_team] += 1
            self.np_for[m.away_team] += m.away_npxg; self.np_fn[m.away_team] += 1
            self.np_ag[m.away_team] += m.home_npxg; self.np_an[m.away_team] += 1
        if m.home_ppda is not None:
            self.ppda_sum[m.home_team] += m.home_ppda; self.ppda_n[m.home_team] += 1
        if m.away_ppda is not None:
            self.ppda_sum[m.away_team] += m.away_ppda; self.ppda_n[m.away_team] += 1


def run() -> None:
    matches = load()
    by_league: dict[str, list[XGMatch]] = defaultdict(list)
    for m in matches:
        by_league[m.league].append(m)
    print(f"Understat matches: {len(matches)} across {len(by_league)} leagues")

    Xb: list[list[float]] = []   # base features
    xg_extra: list[list[float]] = []  # xG features
    adv_extra: list[list[float]] = []  # npxG + pressing features
    poi_probs: list[tuple] = []
    y: list[int] = []

    for lg, ms in by_league.items():
        ms.sort(key=lambda m: m.date)
        train: list[dict] = []
        pi = PiRating()
        xg = XGForm()
        results_log: dict[str, list] = defaultdict(list)
        for idx, m in enumerate(ms):
            if idx >= WARMUP:
                poi = poisson_v1_predict(train, m.home_team, m.away_team)
                if poi:
                    pi_diff = pi.rating_diff(m.home_team, m.away_team)
                    form_diff = form_ppg(results_log[m.home_team]) - form_ppg(results_log[m.away_team])
                    xg_off = xg.attack(m.home_team) - xg.attack(m.away_team)
                    xg_def = xg.defense(m.away_team) - xg.defense(m.home_team)  # +ve favours home
                    npxg_off = xg.np_attack(m.home_team) - xg.np_attack(m.away_team)
                    npxg_def = xg.np_defense(m.away_team) - xg.np_defense(m.home_team)
                    ppda_diff = xg.ppda(m.away_team) - xg.ppda(m.home_team)  # +ve = home presses more
                    Xb.append([poi[0], poi[1], poi[2], pi_diff, form_diff])
                    xg_extra.append([xg_off, xg_def])
                    adv_extra.append([npxg_off, npxg_def, ppda_diff])
                    poi_probs.append(poi)
                    y.append(OUTCOMES.index(m.result))
            train.append(m.as_model_match())
            pi.update(m.home_team, m.away_team, m.home_goals, m.away_goals)
            xg.update(m)
            results_log[m.home_team].append(result_char(m.home_goals, m.away_goals))
            results_log[m.away_team].append(result_char(m.away_goals, m.home_goals))

    Xb_a = np.asarray(Xb, dtype=float)
    Xx_a = np.hstack([Xb_a, np.asarray(xg_extra, dtype=float)])
    Xadv_a = np.hstack([Xb_a, np.asarray(xg_extra, dtype=float), np.asarray(adv_extra, dtype=float)])
    ya = np.asarray(y, dtype=int)
    split = len(Xb_a) // 2

    def fit_eval(feats):
        sc = StandardScaler().fit(feats[:split])
        clf = LogisticRegression(max_iter=2000).fit(sc.transform(feats[:split]), ya[:split])
        return clf, clf.predict_proba(sc.transform(feats[split:]))

    clf_b, pb = fit_eval(Xb_a)
    clf_x, px = fit_eval(Xx_a)
    clf_adv, padv = fit_eval(Xadv_a)

    def bmean(seq) -> float:
        return float(np.mean([brier_1x2(tuple(p), OUTCOMES[o]) for p, o in zip(seq, ya[split:])]))

    b_poi = bmean(poi_probs[split:])
    b_base = bmean(pb)
    b_xg = bmean(px)
    b_adv = bmean(padv)

    print("\n" + "=" * 60)
    print(f"Eval matches (2nd half): {len(ya) - split}")
    print(f"{'Model':<40}{'Brier':>12}")
    print("-" * 60)
    print(f"{'Poisson only':<40}{b_poi:>12.5f}")
    print(f"{'+ pi + form (base, no xG)':<40}{b_base:>12.5f}")
    print(f"{'+ xG form':<40}{b_xg:>12.5f}")
    print(f"{'+ xG + npxG + pressing (ppda)':<40}{b_adv:>12.5f}")
    print(f"{'Market (Pinnacle, reference)':<40}{MARKET_BRIER:>12.5f}")
    print("=" * 60)
    gap = b_poi - MARKET_BRIER
    print(f"base closes {(b_poi - b_base) / gap * 100:+.1f}%; "
          f"+xG {(b_poi - b_xg) / gap * 100:+.1f}%; "
          f"+npxG/ppda {(b_poi - b_adv) / gap * 100:+.1f}% of the gap")
    coefs = dict(zip(["pH", "pD", "pA", "pi_diff", "form_diff", "xg_off", "xg_def", "npxg_off", "npxg_def", "ppda"],
                     np.round(np.abs(clf_adv.coef_).mean(axis=0), 3)))
    print(f"mean |coef|: {coefs}")


if __name__ == "__main__":
    run()
