"""Does adding the features WE ALREADY HAVE beat the goals-only Poisson?

Stacks a multinomial logistic on top of the Poisson probabilities plus the
results+dates-derived features (pi-rating diff, rest diff, congestion diff, form
diff). Walk-forward; trained on the first half of predictions, evaluated on the
second half. Answers honestly how much of the gap to the market our existing
data can close — before we spend effort ingesting xG/lineups.

Run:  venv/bin/python -m scripts.backtest_features
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import FDMatch, implied_probs  # noqa: E402
from models.match_features import (  # noqa: E402
    PiRating,
    congestion,
    form_ppg,
    rest_days,
    result_char,
)
from scripts.backtest_clv import (  # noqa: E402
    LEAGUES,
    START_YEARS,
    WARMUP,
    brier_1x2,
    load_cached,
    poisson_v1_predict,
)

OUTCOMES = ("H", "D", "A")


def run() -> None:
    print("Loading football-data.co.uk (cached)…")
    by_league: dict[str, list[FDMatch]] = {}
    for lg in LEAGUES:
        ms: list[FDMatch] = []
        for yr in START_YEARS:
            ms.extend(load_cached(lg, yr))
        ms.sort(key=lambda m: m.date)
        by_league[lg] = ms

    X: list[list[float]] = []
    moves: list[list[float]] = []  # market line-movement features (open -> close)
    poi_probs: list[tuple] = []
    mkt_probs: list[tuple] = []
    y: list[int] = []
    odds_list: list[tuple] = []

    for lg, matches in by_league.items():
        if len(matches) <= WARMUP:
            continue
        train: list[dict] = []
        pi = PiRating()
        last_date: dict[str, object] = {}
        played: dict[str, list] = {}
        results_log: dict[str, list] = {}

        for idx, m in enumerate(matches):
            h, a, d = m.home_team, m.away_team, m.date
            if idx >= WARMUP:
                poi = poisson_v1_predict(train, h, a)
                mkt = implied_probs(m.closing_home, m.closing_draw, m.closing_away)
                if poi and mkt:
                    pi_diff = pi.rating_diff(h, a)
                    rest_diff = rest_days(last_date.get(h), d) - rest_days(last_date.get(a), d)
                    cong_diff = congestion(played.get(h, []), d) - congestion(played.get(a, []), d)
                    form_diff = form_ppg(results_log.get(h, [])) - form_ppg(results_log.get(a, []))
                    X.append([poi[0], poi[1], poi[2], pi_diff, rest_diff, cong_diff, form_diff])
                    opn = implied_probs(m.open_h, m.open_d, m.open_a)
                    moves.append([mkt[0] - opn[0], mkt[2] - opn[2]] if opn else [0.0, 0.0])
                    poi_probs.append(poi)
                    mkt_probs.append(mkt)
                    y.append(OUTCOMES.index(
                        m.result if m.result in OUTCOMES else result_char(m.home_goals, m.away_goals)
                    ))
                    odds_list.append((m.closing_home, m.closing_draw, m.closing_away))

            # update state with the actual result (after recording -> no leakage)
            train.append(m.as_model_match())
            pi.update(h, a, m.home_goals, m.away_goals)
            last_date[h] = d; last_date[a] = d
            played.setdefault(h, []).append(d); played.setdefault(a, []).append(d)
            results_log.setdefault(h, []).append(result_char(m.home_goals, m.away_goals))
            results_log.setdefault(a, []).append(result_char(m.away_goals, m.home_goals))

    Xa = np.asarray(X, dtype=float)
    Xm = np.hstack([Xa, np.asarray(moves, dtype=float)])  # + market line-movement
    ya = np.asarray(y, dtype=int)
    split = len(Xa) // 2

    def fit_eval(features: np.ndarray):
        scaler = StandardScaler().fit(features[:split])
        clf = LogisticRegression(max_iter=2000, C=1.0)
        clf.fit(scaler.transform(features[:split]), ya[:split])
        return clf, clf.predict_proba(scaler.transform(features[split:]))

    clf_nm, probs_nm = fit_eval(Xa)            # non-market features only
    clf_mk, probs_mk = fit_eval(Xm)            # + market line movement

    def brier_mean(probs_seq, outcomes_idx) -> float:
        xs = [brier_1x2(tuple(p), OUTCOMES[o]) for p, o in zip(probs_seq, outcomes_idx)]
        return sum(xs) / len(xs) if xs else float("nan")

    eval_y = ya[split:]
    b_poi = brier_mean(poi_probs[split:], eval_y)
    b_nm = brier_mean(probs_nm, eval_y)
    b_mk = brier_mean(probs_mk, eval_y)
    b_mkt = brier_mean(mkt_probs[split:], eval_y)

    print("\n" + "=" * 64)
    print(f"Eval matches (2nd half): {len(eval_y)}   (trained on first {split})")
    print(f"{'Model':<40}{'Brier':>12}")
    print("-" * 64)
    print(f"{'Poisson v1 (base)':<40}{b_poi:>12.5f}")
    print(f"{'+ non-market features (pi/form/rest/cong)':<40}{b_nm:>12.5f}")
    print(f"{'+ market line-movement (open->close)':<40}{b_mk:>12.5f}")
    print(f"{'Market (Pinnacle, reference)':<40}{b_mkt:>12.5f}")
    print("=" * 64)
    gap = b_poi - b_mkt
    print(f"non-market closes {(b_poi - b_nm) / gap * 100:+.1f}% of the gap; "
          f"+movement closes {(b_poi - b_mk) / gap * 100:+.1f}%")
    print("CAVEAT: market-movement features mirror the bookmaker — gains there are "
          "not independent edge, just copying the line.")
    coefs = dict(zip(["pH", "pD", "pA", "pi_diff", "rest_diff", "cong_diff", "form_diff", "move_h", "move_a"],
                     np.round(np.abs(clf_mk.coef_).mean(axis=0), 3)))
    print(f"mean |coef|: {coefs}")


if __name__ == "__main__":
    run()
