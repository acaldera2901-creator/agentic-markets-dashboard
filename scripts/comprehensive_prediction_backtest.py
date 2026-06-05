"""Comprehensive local prediction backtest.

Uses every reliable local dataset currently present:
- Football-data.co.uk cached CSVs: 1X2 results + closing odds for PL/BL1/SA/PD/FL1
- Understat cached CSVs: xG/npxG/PPDA for the same top leagues
- Jeff Sackmann ATP/WTA cached CSVs: tennis match history + ranks + serve stats

The goal is prediction accuracy/calibration, not bankroll or drawdown.

Run:
  .venv/bin/python -m scripts.comprehensive_prediction_backtest
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from math import log
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import DIVISION_MAP, FDMatch, implied_probs, parse_csv  # noqa: E402
from core.tennis_data import TennisMatch, parse_csv as parse_tennis_csv  # noqa: E402
from core.understat_data import load as load_understat  # noqa: E402
from models.match_features import PiRating, form_ppg, result_char  # noqa: E402
from models.tennis_elo import SurfaceElo  # noqa: E402
from scripts.backtest_clv import brier_1x2, poisson_v1_predict  # noqa: E402
from scripts.backtest_tennis import Running  # noqa: E402
from scripts.backtest_xg import XGForm  # noqa: E402

OUTCOMES = ("H", "D", "A")
FOOTBALL_LEAGUES = ["PL", "BL1", "SA", "PD", "FL1"]
FOOTBALL_WARMUP = 60
TENNIS_WARMUP = 800


def pct(x: float | None) -> float | None:
    return None if x is None else round(float(x) * 100, 2)


def wilson(successes: int, n: int, z: float = 1.96) -> dict[str, float | None]:
    if n <= 0:
        return {"low_pct": None, "high_pct": None}
    phat = successes / n
    denom = 1 + (z * z) / n
    center = (phat + (z * z) / (2 * n)) / denom
    margin = (z * np.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) / denom
    return {"low_pct": pct(max(0.0, center - margin)), "high_pct": pct(min(1.0, center + margin))}


def ece(confs: np.ndarray, hits: np.ndarray, bins: int = 10) -> float:
    confs = np.asarray(confs, dtype=float)
    hits = np.asarray(hits, dtype=float)
    err = 0.0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        mask = (confs > lo) & (confs <= hi)
        if mask.any():
            err += float(mask.mean() * abs(hits[mask].mean() - confs[mask].mean()))
    return err


def logloss_1x2(probs: tuple[float, float, float], outcome: str) -> float:
    return -log(max(probs[OUTCOMES.index(outcome)], 1e-12))


def load_football_data_uk() -> dict[str, list[FDMatch]]:
    cache = ROOT / "data" / "football_data_uk"
    by_league: dict[str, list[FDMatch]] = {}
    for league in FOOTBALL_LEAGUES:
        matches: list[FDMatch] = []
        for fp in sorted(cache.glob(f"{league}_{DIVISION_MAP[league]}_*.csv")):
            matches.extend(parse_csv(fp.read_text(encoding="utf-8", errors="replace"), league))
        matches.sort(key=lambda m: m.date)
        by_league[league] = matches
    return by_league


def football_data_uk_backtest() -> dict[str, Any]:
    by_league = load_football_data_uk()
    rows: list[dict[str, Any]] = []

    for league, matches in by_league.items():
        train: list[dict[str, Any]] = []
        for idx, match in enumerate(matches):
            if idx >= FOOTBALL_WARMUP:
                model = poisson_v1_predict(train, match.home_team, match.away_team)
                market = implied_probs(match.closing_home, match.closing_draw, match.closing_away)
                outcome = match.result if match.result in OUTCOMES else (
                    "H" if match.home_goals > match.away_goals else "A" if match.away_goals > match.home_goals else "D"
                )
                if model and market:
                    model_pick = OUTCOMES[int(np.argmax(model))]
                    market_pick = OUTCOMES[int(np.argmax(market))]
                    rows.append({
                        "league": league,
                        "outcome": outcome,
                        "model": model,
                        "market": market,
                        "model_pick": model_pick,
                        "market_pick": market_pick,
                        "model_conf": max(model),
                        "market_conf": max(market),
                    })
            train.append(match.as_model_match())

    def summarize(subset: list[dict[str, Any]]) -> dict[str, Any]:
        n = len(subset)
        if not n:
            return {"n": 0}
        model_hits = [r["model_pick"] == r["outcome"] for r in subset]
        market_hits = [r["market_pick"] == r["outcome"] for r in subset]
        model_correct = int(sum(model_hits))
        market_correct = int(sum(market_hits))
        return {
            "n": n,
            "model_argmax_accuracy_pct": pct(model_correct / n),
            "model_argmax_ci_95": wilson(model_correct, n),
            "market_favorite_accuracy_pct": pct(market_correct / n),
            "market_favorite_ci_95": wilson(market_correct, n),
            "model_brier": round(float(np.mean([brier_1x2(r["model"], r["outcome"]) for r in subset])), 5),
            "market_brier": round(float(np.mean([brier_1x2(r["market"], r["outcome"]) for r in subset])), 5),
            "model_logloss": round(float(np.mean([logloss_1x2(r["model"], r["outcome"]) for r in subset])), 5),
            "market_logloss": round(float(np.mean([logloss_1x2(r["market"], r["outcome"]) for r in subset])), 5),
            "model_ece": round(ece(np.array([r["model_conf"] for r in subset]), np.array(model_hits)), 5),
            "market_ece": round(ece(np.array([r["market_conf"] for r in subset]), np.array(market_hits)), 5),
        }

    by_pick = {}
    for pick in OUTCOMES:
        subset = [r for r in rows if r["model_pick"] == pick]
        summary = summarize(subset)
        summary["pick"] = pick
        by_pick[pick] = summary

    by_league_summary = {league: summarize([r for r in rows if r["league"] == league]) for league in FOOTBALL_LEAGUES}
    return {
        "dataset": "football-data.co.uk cached seasons, closing odds, walk-forward Poisson v1",
        "overall": summarize(rows),
        "by_model_pick": by_pick,
        "by_league": by_league_summary,
    }


def understat_xg_backtest() -> dict[str, Any]:
    matches = load_understat()
    by_league: dict[str, list[Any]] = defaultdict(list)
    for match in matches:
        by_league[match.league].append(match)

    X_base: list[list[float]] = []
    X_xg: list[list[float]] = []
    X_adv: list[list[float]] = []
    poisson_probs: list[tuple[float, float, float]] = []
    y: list[int] = []

    for league, league_matches in by_league.items():
        league_matches.sort(key=lambda m: m.date)
        train: list[dict[str, Any]] = []
        pi = PiRating()
        xg = XGForm()
        form: dict[str, list[str]] = defaultdict(list)
        for idx, match in enumerate(league_matches):
            if idx >= FOOTBALL_WARMUP:
                poi = poisson_v1_predict(train, match.home_team, match.away_team)
                if poi:
                    base = [
                        poi[0], poi[1], poi[2],
                        pi.rating_diff(match.home_team, match.away_team),
                        form_ppg(form[match.home_team]) - form_ppg(form[match.away_team]),
                    ]
                    xg_features = [
                        xg.attack(match.home_team) - xg.attack(match.away_team),
                        xg.defense(match.away_team) - xg.defense(match.home_team),
                    ]
                    adv = [
                        xg.np_attack(match.home_team) - xg.np_attack(match.away_team),
                        xg.np_defense(match.away_team) - xg.np_defense(match.home_team),
                        xg.ppda(match.away_team) - xg.ppda(match.home_team),
                    ]
                    X_base.append(base)
                    X_xg.append(base + xg_features)
                    X_adv.append(base + xg_features + adv)
                    poisson_probs.append(poi)
                    y.append(OUTCOMES.index(match.result))
            train.append(match.as_model_match())
            pi.update(match.home_team, match.away_team, match.home_goals, match.away_goals)
            xg.update(match)
            form[match.home_team].append(result_char(match.home_goals, match.away_goals))
            form[match.away_team].append(result_char(match.away_goals, match.home_goals))

    ya = np.asarray(y, dtype=int)
    split = len(ya) // 2

    def fit_predict(X: list[list[float]]) -> np.ndarray:
        Xa = np.asarray(X, dtype=float)
        scaler = StandardScaler().fit(Xa[:split])
        clf = LogisticRegression(max_iter=2000).fit(scaler.transform(Xa[:split]), ya[:split])
        return clf.predict_proba(scaler.transform(Xa[split:]))

    pred_base = fit_predict(X_base)
    pred_xg = fit_predict(X_xg)
    pred_adv = fit_predict(X_adv)
    eval_y = ya[split:]

    def metrics(name: str, probs: np.ndarray | list[tuple[float, float, float]]) -> dict[str, Any]:
        pa = np.asarray(probs, dtype=float)
        if pa.shape[0] != len(eval_y):
            pa = pa[split:]
        picks = pa.argmax(axis=1)
        hits = picks == eval_y
        return {
            "model": name,
            "n": int(len(eval_y)),
            "accuracy_pct": pct(float(hits.mean())),
            "brier": round(float(np.mean([sum((pa[i][k] - (1 if eval_y[i] == k else 0)) ** 2 for k in range(3)) for i in range(len(eval_y))])), 5),
            "logloss": round(float(np.mean([-log(max(pa[i][eval_y[i]], 1e-12)) for i in range(len(eval_y))])), 5),
            "ece": round(ece(pa.max(axis=1), hits), 5),
        }

    return {
        "dataset": "Understat top leagues 2021-2024, walk-forward; second half held out",
        "models": [
            metrics("poisson_only", poisson_probs),
            metrics("poisson_plus_pi_form", pred_base),
            metrics("poisson_plus_pi_form_xg", pred_xg),
            metrics("poisson_plus_pi_form_xg_npxg_ppda", pred_adv),
        ],
    }


def load_tennis_by_tour() -> dict[str, list[TennisMatch]]:
    cache = ROOT / "data" / "tennis"
    by_tour: dict[str, list[TennisMatch]] = {}
    for fp in sorted(cache.glob("*_*.csv")):
        tour = fp.stem.split("_", 1)[0].lower()
        if tour not in {"atp", "wta"}:
            continue
        by_tour.setdefault(tour, []).extend(
            parse_tennis_csv(fp.read_text(encoding="utf-8", errors="replace"), tour)
        )
    for matches in by_tour.values():
        matches.sort(key=lambda m: m.date)
    return by_tour


def tennis_tour_backtest(tour: str, matches: list[TennisMatch]) -> dict[str, Any]:
    if len(matches) <= TENNIS_WARMUP + 200:
        return {
            "dataset": f"Jeff Sackmann {tour.upper()} cached CSVs",
            "n_matches": len(matches),
            "models": [],
            "warning": "Not enough matches for warmup + held-out evaluation.",
        }

    elo = SurfaceElo()
    running = Running()
    last_dates: dict[str, list[Any]] = defaultdict(list)
    h2h: dict[tuple[str, str], int] = defaultdict(int)

    X: list[list[float]] = []
    elo_probs: list[float] = []
    rank_picks: list[int] = []
    y: list[int] = []

    for idx, match in enumerate(matches):
        p1, p2 = sorted([match.winner, match.loser])
        label = 1 if p1 == match.winner else 0
        r1 = match.winner_rank if p1 == match.winner else match.loser_rank
        r2 = match.loser_rank if p1 == match.winner else match.winner_rank

        if idx >= TENNIS_WARMUP:
            elo_prob = elo.expected(p1, p2, match.surface)
            X.append([
                elo.rating(p1, match.surface) - elo.rating(p2, match.surface),
                ((r2 or 500) - (r1 or 500)),
                running.serve(p1) - running.serve(p2),
                running.ret(p1) - running.ret(p2),
                sum(1 for d in last_dates[p1] if 0 < (match.date - d).days <= 14)
                - sum(1 for d in last_dates[p2] if 0 < (match.date - d).days <= 14),
                h2h[(p1, p2)] - h2h[(p2, p1)],
            ])
            elo_probs.append(elo_prob)
            rank_picks.append(1 if (r1 or 500) < (r2 or 500) else 0)
            y.append(label)

        elo.update(match.winner, match.loser, match.surface)
        running.update(match)
        last_dates[match.winner].append(match.date)
        last_dates[match.loser].append(match.date)
        h2h[(match.winner, match.loser)] += 1

    Xa = np.asarray(X, dtype=float)
    ya = np.asarray(y, dtype=int)
    split = len(Xa) // 2
    scaler = StandardScaler().fit(Xa[:split])
    clf = LogisticRegression(max_iter=2000).fit(scaler.transform(Xa[:split]), ya[:split])
    stack_probs = clf.predict_proba(scaler.transform(Xa[split:]))[:, 1]

    eval_y = ya[split:]
    eval_elo = np.asarray(elo_probs[split:], dtype=float)
    eval_rank = np.asarray(rank_picks[split:], dtype=int)

    def binary_metrics(name: str, probs: np.ndarray | None, picks: np.ndarray | None = None) -> dict[str, Any]:
        if probs is not None:
            pred = (probs > 0.5).astype(int)
            brier = float(np.mean((probs - eval_y) ** 2))
            conf = np.where(probs > 0.5, probs, 1 - probs)
        else:
            pred = picks if picks is not None else np.zeros_like(eval_y)
            brier = None
            conf = np.full_like(eval_y, 0.5, dtype=float)
        hits = pred == eval_y
        return {
            "model": name,
            "n": int(len(eval_y)),
            "accuracy_pct": pct(float(hits.mean())),
            "ci_95": wilson(int(hits.sum()), int(len(eval_y))),
            "brier": None if brier is None else round(brier, 5),
            "ece": round(ece(conf, hits), 5) if probs is not None else None,
        }

    return {
        "dataset": f"Jeff Sackmann {tour.upper()} cached CSVs, walk-forward; second half held out",
        "n_matches": len(matches),
        "models": [
            binary_metrics("rank_baseline", None, eval_rank),
            binary_metrics("surface_elo", eval_elo),
            binary_metrics("elo_rank_serve_return_fatigue_h2h", stack_probs),
        ],
        "feature_coeff_abs": dict(zip(
            ["elo_diff", "rank_diff", "serve_diff", "return_diff", "fatigue_14d", "h2h"],
            [float(x) for x in np.round(np.abs(clf.coef_[0]), 4)],
        )),
    }


def tennis_backtest() -> dict[str, Any]:
    by_tour = load_tennis_by_tour()
    tours = {tour: tennis_tour_backtest(tour, matches) for tour, matches in sorted(by_tour.items())}
    return {
        "dataset": "Jeff Sackmann ATP/WTA cached CSVs, evaluated per tour to avoid mixing player pools",
        "tours": tours,
    }


def main() -> None:
    report = {
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").UTC).isoformat(),
        "football_data_uk": football_data_uk_backtest(),
        "football_understat_xg": understat_xg_backtest(),
        "tennis": tennis_backtest(),
        "interpretation": {
            "accuracy_note": "Argmax accuracy answers: if the model says HOME/AWAY/DRAW is most likely, how often does that side actually win?",
            "calibration_note": "Brier/log-loss/ECE answer whether probability levels are honest; a 60% pick should win near 60% over many cases.",
        },
    }
    out_dir = ROOT / "reports"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / "prediction_backtest_latest.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"\nSaved: {out}")


if __name__ == "__main__":
    main()
