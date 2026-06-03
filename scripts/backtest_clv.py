"""CLV/ROI backtest: do our models beat the Pinnacle closing line?

Brier alone says how calibrated we are; it does NOT say whether we beat the market.
This backtest loads football-data.co.uk (results + closing odds), runs Dixon-Coles
and Poisson v1 walk-forward per league, and measures:

  - Brier (DC, Poisson, Market)  -> calibration vs the closing line as baseline
  - ROI of flat-staking model value picks AT the closing odds -> the real bar

Beating the closing line on ROI is the honest test of edge. Data is cached under
data/football_data_uk/ so reruns are offline.

Run:  venv/bin/python -m scripts.backtest_clv
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import (  # noqa: E402
    DIVISION_MAP,
    FDMatch,
    download_csv,
    implied_probs,
    parse_csv,
)
from models.dixon_coles import DixonColesModel  # noqa: E402

CACHE = ROOT / "data" / "football_data_uk"
LEAGUES = ["PL", "BL1", "SA", "PD", "FL1"]
START_YEARS = [2021, 2022, 2023, 2024]

WARMUP = 60          # matches used as initial training before we start predicting
DC_REFIT_EVERY = 20  # refit Dixon-Coles every N predictions (warm-started)
DC_HALF_LIFE_DAYS = 120.0  # Dixon-Coles time weighting (0 disables); mirrors settings default
EDGE_MARGIN = 0.0    # require model_p * odds > 1 + EDGE_MARGIN to bet
SHRINKAGE_PRIOR = 4  # parity with lib/poisson-model.ts P0 #3 guard

OUTCOMES = ("H", "D", "A")


# ── data load (cached) ────────────────────────────────────────────────────────
def load_cached(league: str, year: int) -> list[FDMatch]:
    CACHE.mkdir(parents=True, exist_ok=True)
    fp = CACHE / f"{league}_{DIVISION_MAP[league]}_{year}.csv"
    if fp.exists():
        return parse_csv(fp.read_text(encoding="utf-8", errors="replace"), league)
    try:
        text = download_csv(league, year)
    except Exception as e:  # noqa: BLE001
        print(f"  ! skip {league} {year}: {e}")
        return []
    fp.write_text(text, encoding="utf-8")
    return parse_csv(text, league)


# ── Poisson v1 (parity with the TS model served to clients today) ─────────────
def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 1.0


def _shrink(raw: float, n: int) -> float:
    return (raw * n + 1.0 * SHRINKAGE_PRIOR) / (n + SHRINKAGE_PRIOR)


def poisson_v1_predict(train: list[dict], home: str, away: str) -> tuple[float, float, float] | None:
    hg = [m["home_goals"] for m in train]
    ag = [m["away_goals"] for m in train]
    if not hg:
        return None
    avg_home, avg_away = _mean(hg), _mean(ag)
    if avg_home <= 0 or avg_away <= 0:
        return None

    def strength(team: str) -> dict | None:
        h = [m for m in train if m["home_team"] == team]
        a = [m for m in train if m["away_team"] == team]
        if not h and not a:
            return None
        atk_h = _shrink(_mean([m["home_goals"] for m in h]) / avg_home if h else 1.0, len(h))
        def_h = _shrink(_mean([m["away_goals"] for m in h]) / avg_away if h else 1.0, len(h))
        atk_a = _shrink(_mean([m["away_goals"] for m in a]) / avg_away if a else 1.0, len(a))
        def_a = _shrink(_mean([m["home_goals"] for m in a]) / avg_home if a else 1.0, len(a))
        return {"atk_h": atk_h, "def_h": def_h, "atk_a": atk_a, "def_a": def_a}

    sh, sa = strength(home), strength(away)
    if not sh or not sa:
        return None
    lam = avg_home * sh["atk_h"] * sa["def_a"]
    mu = avg_away * sa["atk_a"] * sh["def_h"]

    from math import exp

    def pois(k: int, l: float) -> float:
        p = exp(-l)
        for i in range(1, k + 1):
            p *= l / i
        return p

    ph = pd = pa = 0.0
    for i in range(9):
        for j in range(9):
            p = pois(i, lam) * pois(j, mu)
            if i > j:
                ph += p
            elif i == j:
                pd += p
            else:
                pa += p
    tot = ph + pd + pa
    return (ph / tot, pd / tot, pa / tot)


# ── metrics ───────────────────────────────────────────────────────────────────
def brier_1x2(p: tuple[float, float, float], outcome: str) -> float:
    target = {o: (1.0 if o == outcome else 0.0) for o in OUTCOMES}
    return sum((p[i] - target[o]) ** 2 for i, o in enumerate(OUTCOMES))


def roi_bets(p: tuple[float, float, float], odds: tuple[float, float, float], outcome: str):
    """Flat-stake 1u on every selection with positive model EV at the closing odds."""
    staked = 0.0
    profit = 0.0
    n = 0
    for i, o in enumerate(OUTCOMES):
        if odds[i] and p[i] * odds[i] > 1.0 + EDGE_MARGIN:
            staked += 1.0
            n += 1
            profit += (odds[i] - 1.0) if outcome == o else -1.0
    return staked, profit, n


def run() -> None:
    print("Loading football-data.co.uk (cached)…")
    by_league: dict[str, list[FDMatch]] = {}
    for lg in LEAGUES:
        ms: list[FDMatch] = []
        for yr in START_YEARS:
            ms.extend(load_cached(lg, yr))
        ms.sort(key=lambda m: m.date)
        by_league[lg] = ms
        print(f"  {lg}: {len(ms)} matches")

    dc_brier, poi_brier, mkt_brier = [], [], []
    dc_staked = dc_profit = poi_staked = poi_profit = 0.0
    dc_nbets = poi_nbets = 0
    n_pred = 0

    for lg, matches in by_league.items():
        if len(matches) <= WARMUP:
            continue
        dc = DixonColesModel()
        train_dicts: list[dict] = [m.as_model_match() for m in matches[:WARMUP]]
        dc.fit(train_dicts, half_life_days=DC_HALF_LIFE_DAYS)
        since_refit = 0

        for m in matches[WARMUP:]:
            outcome = m.result if m.result in OUTCOMES else (
                "H" if m.home_goals > m.away_goals else "A" if m.away_goals > m.home_goals else "D"
            )
            mkt = implied_probs(m.closing_home, m.closing_draw, m.closing_away)

            # Dixon-Coles
            try:
                dcp = dc.predict(m.home_team, m.away_team)
            except (KeyError, Exception):  # noqa: BLE001 — unseen team before refit
                dcp = None
            poi = poisson_v1_predict(train_dicts, m.home_team, m.away_team)

            if dcp and poi and mkt:
                n_pred += 1
                dc_brier.append(brier_1x2(dcp, outcome))
                poi_brier.append(brier_1x2(poi, outcome))
                mkt_brier.append(brier_1x2(mkt, outcome))
                odds = (m.closing_home, m.closing_draw, m.closing_away)
                s, pr, nb = roi_bets(dcp, odds, outcome)
                dc_staked += s; dc_profit += pr; dc_nbets += nb
                s, pr, nb = roi_bets(poi, odds, outcome)
                poi_staked += s; poi_profit += pr; poi_nbets += nb

            train_dicts.append(m.as_model_match())
            since_refit += 1
            if since_refit >= DC_REFIT_EVERY:
                prev = dc
                dc = DixonColesModel()
                dc.fit(train_dicts, warm_start=prev, half_life_days=DC_HALF_LIFE_DAYS)
                since_refit = 0

    def mean(xs: list[float]) -> float:
        return sum(xs) / len(xs) if xs else float("nan")

    print("\n" + "=" * 60)
    print(f"Predicted matches: {n_pred}")
    print(f"{'Metric':<26}{'Dixon-Coles':>14}{'Poisson v1':>14}{'Market':>10}")
    print("-" * 64)
    print(f"{'Brier (lower=better)':<26}{mean(dc_brier):>14.5f}{mean(poi_brier):>14.5f}{mean(mkt_brier):>10.5f}")
    print("-" * 64)
    print("ROI @ Pinnacle closing (value picks, flat 1u):")
    dc_roi = (dc_profit / dc_staked * 100) if dc_staked else float("nan")
    poi_roi = (poi_profit / poi_staked * 100) if poi_staked else float("nan")
    print(f"  Dixon-Coles : {dc_nbets:>5} bets  profit {dc_profit:>+8.1f}u  ROI {dc_roi:>+6.2f}%")
    print(f"  Poisson v1  : {poi_nbets:>5} bets  profit {poi_profit:>+8.1f}u  ROI {poi_roi:>+6.2f}%")
    print("=" * 64)
    print("Note: closing line is ~efficient; positive ROI here = genuine edge.")


if __name__ == "__main__":
    run()
