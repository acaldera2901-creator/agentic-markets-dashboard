"""Tennis backtest: surface-Elo + serve/return + fatigue + H2H (walk-forward).

Validates the multi-sport pipeline on a second sport. Deterministic p1/p2 (by name,
independent of result -> no label leakage); label = 1 if p1 won. Compares a rank
baseline, surface-Elo alone, and a logistic stack over Elo + running serve/return,
fatigue and H2H features. Metric: Brier + accuracy on a held-out second half.

Run:  venv/bin/python -m scripts.backtest_tennis
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

from core.tennis_data import TennisMatch, download_csv, parse_csv  # noqa: E402
from models.tennis_elo import SurfaceElo  # noqa: E402

CACHE = ROOT / "data" / "tennis"
TOUR = "atp"
YEARS = [2021, 2022, 2023, 2024]
WARMUP = 800  # matches to let Elo/serve stats settle before recording


def load_cached(tour: str, year: int) -> list[TennisMatch]:
    CACHE.mkdir(parents=True, exist_ok=True)
    fp = CACHE / f"{tour}_{year}.csv"
    if fp.exists():
        return parse_csv(fp.read_text(encoding="utf-8", errors="replace"), tour)
    try:
        text = download_csv(tour, year)
    except Exception as e:  # noqa: BLE001
        print(f"  ! skip {tour} {year}: {e}")
        return []
    fp.write_text(text, encoding="utf-8")
    return parse_csv(text, tour)


class Running:
    """Running serve/return points-won pct per player (with a neutral prior)."""

    def __init__(self) -> None:
        self.sv_won = defaultdict(float); self.sv_pts = defaultdict(float)
        self.rt_won = defaultdict(float); self.rt_pts = defaultdict(float)

    def serve(self, p: str) -> float:
        return self.sv_won[p] / self.sv_pts[p] if self.sv_pts[p] >= 50 else 0.62

    def ret(self, p: str) -> float:
        return self.rt_won[p] / self.rt_pts[p] if self.rt_pts[p] >= 50 else 0.38

    def update(self, m: TennisMatch) -> None:
        ws = TennisMatch.serve_won_pct(m.w_1st_won, m.w_2nd_won, m.w_svpt)
        ls = TennisMatch.serve_won_pct(m.l_1st_won, m.l_2nd_won, m.l_svpt)
        if ws is not None and m.w_svpt:
            self.sv_won[m.winner] += m.w_1st_won + m.w_2nd_won; self.sv_pts[m.winner] += m.w_svpt
            self.rt_won[m.loser] += m.w_svpt - (m.w_1st_won + m.w_2nd_won); self.rt_pts[m.loser] += m.w_svpt
        if ls is not None and m.l_svpt:
            self.sv_won[m.loser] += m.l_1st_won + m.l_2nd_won; self.sv_pts[m.loser] += m.l_svpt
            self.rt_won[m.winner] += m.l_svpt - (m.l_1st_won + m.l_2nd_won); self.rt_pts[m.winner] += m.l_svpt


def run() -> None:
    print("Loading Sackmann tennis (cached)…")
    matches: list[TennisMatch] = []
    for yr in YEARS:
        matches.extend(load_cached(TOUR, yr))
    matches.sort(key=lambda m: m.date)
    print(f"  {TOUR.upper()}: {len(matches)} matches")

    elo = SurfaceElo()
    run_stats = Running()
    last_dates: dict[str, list] = defaultdict(list)
    h2h: dict[tuple, int] = defaultdict(int)

    X: list[list[float]] = []
    elo_p1: list[float] = []
    rank_pick: list[int] = []   # 1 if rank baseline picks p1
    y: list[int] = []

    for idx, m in enumerate(matches):
        p1, p2 = sorted([m.winner, m.loser])
        label = 1 if p1 == m.winner else 0
        r1 = m.winner_rank if p1 == m.winner else m.loser_rank
        r2 = m.loser_rank if p1 == m.winner else m.winner_rank

        if idx >= WARMUP:
            elo_prob = elo.expected(p1, p2, m.surface)
            rank_diff = ((r2 or 500) - (r1 or 500))  # positive favours p1 (lower rank #)
            serve_diff = run_stats.serve(p1) - run_stats.serve(p2)
            ret_diff = run_stats.ret(p1) - run_stats.ret(p2)
            fatigue_diff = (
                sum(1 for d in last_dates[p1] if 0 < (m.date - d).days <= 14)
                - sum(1 for d in last_dates[p2] if 0 < (m.date - d).days <= 14)
            )
            h2h_diff = h2h[(p1, p2)] - h2h[(p2, p1)]
            elo_diff = elo.rating(p1, m.surface) - elo.rating(p2, m.surface)
            X.append([elo_diff, rank_diff, serve_diff, ret_diff, fatigue_diff, h2h_diff])
            elo_p1.append(elo_prob)
            rank_pick.append(1 if (r1 or 500) < (r2 or 500) else 0)
            y.append(label)

        # update state (after recording)
        elo.update(m.winner, m.loser, m.surface)
        run_stats.update(m)
        last_dates[m.winner].append(m.date); last_dates[m.loser].append(m.date)
        h2h[(m.winner, m.loser)] += 1

    Xa = np.asarray(X, dtype=float)
    ya = np.asarray(y, dtype=int)
    split = len(Xa) // 2

    scaler = StandardScaler().fit(Xa[:split])
    clf = LogisticRegression(max_iter=2000).fit(scaler.transform(Xa[:split]), ya[:split])
    feat_prob = clf.predict_proba(scaler.transform(Xa[split:]))[:, 1]

    ey = ya[split:]
    ep = np.asarray(elo_p1[split:])
    rp = np.asarray(rank_pick[split:])

    def brier(p) -> float:
        return float(np.mean((np.asarray(p) - ey) ** 2))

    def acc(pick) -> float:
        return float(np.mean((np.asarray(pick) == ey)))

    print("\n" + "=" * 60)
    print(f"Eval matches (2nd half): {len(ey)}   (trained on first {split})")
    print(f"{'Model':<34}{'Brier':>10}{'Acc':>10}")
    print("-" * 60)
    print(f"{'Rank baseline':<34}{'—':>10}{acc(rp):>9.1%}")
    print(f"{'Surface-Elo only':<34}{brier(ep):>10.5f}{acc((ep > 0.5).astype(int)):>9.1%}")
    print(f"{'Elo + serve/return/fatigue/H2H':<34}{brier(feat_prob):>10.5f}{acc((feat_prob > 0.5).astype(int)):>9.1%}")
    print("=" * 60)
    coefs = dict(zip(["elo_diff", "rank_diff", "serve_diff", "ret_diff", "fatigue", "h2h"],
                     np.round(np.abs(clf.coef_[0]), 3)))
    print(f"feature influence |coef|: {coefs}")


if __name__ == "__main__":
    run()
