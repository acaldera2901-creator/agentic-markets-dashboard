"""
LAB — Squad Condition / availability factor, 10-year walk-forward (clubs).

Michele-side analysis only — no served code touched. Companion to
scripts/lab_backtest_10y.py and lab_backtest_clubs_10y.py. Question under test
(the "Squad Condition Watch" hypothesis): does the *condition* of the squad —
who actually plays, how much they are worth, how rested they are — add signal
on top of the Elo strength baseline that v2 serves?

Nationals have no usable lineup history (Transfermarkt covers 670 tournament
games only), so the statistical test runs on CLUBS (~80k games with real
starting XIs, 2013→today) and, if the factor promotes, it backs the live
agent design for WC/friendlies where the same quantities are observable
pre-kickoff (callups, injuries, lineups ~1h before).

Data: data/transfermarkt/<table>.csv.gz — dcaribou/transfermarkt-datasets,
public R2 CDN (https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/),
tables: games, game_lineups, appearances, player_valuations, competitions.

Features per match (all strictly point-in-time, valuations looked up at the
last date <= match date; rosters/minutes from a strictly-past window):
  d_elo, |d_elo|   — baseline (the v2 recipe)
  d_logxi          — log(XI market value home / away): static money signal
  d_avail          — availability index gap. avail = XI value / value of the
                     club's best-11 among players seen in the last 365 days.
                     <1.0 = key players missing/rested THAT day. The core
                     Squad-Condition signal, orthogonal to long-run strength.
  d_cong           — congestion gap: avg minutes per XI player, last 14 days
  d_rest           — rest-days gap (club's previous game), clipped to 14
Models (walk-forward by season, logit refit on all prior seasons):
  elo            [d_elo, |d_elo|]
  value_only     [d_logxi, |d_logxi|]
  elo+value      elo + d_logxi
  elo+avail      elo + d_avail
  elo+cond       elo + d_avail + d_cong + d_rest
  elo+all        elo + d_logxi + d_avail + d_cong + d_rest

Run:  PYTHONUTF8=1 python scripts/lab_squad_condition_10y.py
"""
from __future__ import annotations

import csv
import gzip
import math
import sys
from bisect import bisect_left, bisect_right
from collections import Counter, defaultdict, deque
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "transfermarkt"

FIRST_TEST_SEASON = 2016          # 2013-14..2015-16 warm-up, test 2016-17 →
ELO_INIT, ELO_HOME, ELO_K = 1500.0, 65.0, 20.0
ROSTER_WINDOW_DAYS = 365
CONGESTION_DAYS = 14
MIN_XI_VALUED = 9                 # of 11 starters must have a valuation
MIN_ROSTER_VALUED = 15
EPS = 1e-12

NATIONAL_COMPS = frozenset()      # filled from competitions.csv.gz


def parse_d(s: str) -> date | None:
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def season_of(d: date) -> int:
    return d.year if d.month >= 7 else d.year - 1


def mov_mult(m: int) -> float:
    if m <= 1:
        return 1.0
    if m == 2:
        return 1.5
    return 1.75 + max(0, m - 3) / 8.0


def brier3(p, y) -> float:
    t = [0.0, 0.0, 0.0]
    t[y] = 1.0
    return sum((pi - ti) ** 2 for pi, ti in zip(p, t))


def gz_rows(table: str):
    with gzip.open(DATA / f"{table}.csv.gz", "rt", encoding="utf-8") as fh:
        yield from csv.DictReader(fh)


# ── point-in-time player valuations ──────────────────────────────────────────
class Valuations:
    def __init__(self):
        self.by_player: dict[int, tuple[list[date], list[float]]] = {}

    @classmethod
    def load(cls):
        raw = defaultdict(list)
        for r in gz_rows("player_valuations"):
            d = parse_d(r["date"])
            try:
                v = float(r["market_value_in_eur"])
            except (TypeError, ValueError):
                continue
            if d and v > 0:
                raw[int(r["player_id"])].append((d, v))
        self = cls()
        for pid, rows in raw.items():
            rows.sort()
            self.by_player[pid] = ([d for d, _ in rows], [v for _, v in rows])
        return self

    def at(self, pid: int, when: date) -> float | None:
        e = self.by_player.get(pid)
        if not e:
            return None
        i = bisect_right(e[0], when) - 1
        return e[1][i] if i >= 0 else None


# ── per-player minutes with prefix sums (congestion) ─────────────────────────
class Minutes:
    def __init__(self):
        self.by_player: dict[int, tuple[list[date], list[float]]] = {}

    @classmethod
    def load(cls):
        raw = defaultdict(list)
        for r in gz_rows("appearances"):
            d = parse_d(r["date"])
            try:
                m = float(r["minutes_played"] or 0)
            except ValueError:
                m = 0.0
            if d:
                raw[int(r["player_id"])].append((d, m))
        self = cls()
        for pid, rows in raw.items():
            rows.sort()
            dates = [d for d, _ in rows]
            pref = [0.0]
            for _, m in rows:
                pref.append(pref[-1] + m)
            self.by_player[pid] = (dates, pref)
        return self

    def window(self, pid: int, start: date, end: date) -> float:
        """Total minutes in [start, end) — strictly before the match."""
        e = self.by_player.get(pid)
        if not e:
            return 0.0
        lo = bisect_left(e[0], start)
        hi = bisect_left(e[0], end)
        return e[1][hi] - e[1][lo]


# ── streaming 365-day roster window per club (two-pointer, O(n)) ─────────────
class RosterWindow:
    def __init__(self, events: dict[int, list[tuple[date, int]]]):
        self.events = events                       # club -> sorted (date, pid)
        self.ptr: dict[int, int] = defaultdict(int)
        self.win: dict[int, deque] = defaultdict(deque)
        self.cnt: dict[int, Counter] = defaultdict(Counter)

    def players(self, club: int, when: date) -> list[int]:
        ev, q, c = self.events.get(club, []), self.win[club], self.cnt[club]
        i = self.ptr[club]
        while i < len(ev) and ev[i][0] < when:      # strictly past only
            q.append(ev[i])
            c[ev[i][1]] += 1
            i += 1
        self.ptr[club] = i
        cutoff = when - timedelta(days=ROSTER_WINDOW_DAYS)
        while q and q[0][0] < cutoff:
            d, pid = q.popleft()
            c[pid] -= 1
            if not c[pid]:
                del c[pid]
        return list(c.keys())


def summarize(name, recs):
    n = len(recs)
    br = sum(brier3(r["p"], r["y"]) for r in recs) / n
    ll = sum(-math.log(max(r["p"][r["y"]], EPS)) for r in recs) / n
    acc = sum(1 for r in recs if max(range(3), key=lambda k: r["p"][k]) == r["y"]) / n
    print(f"{name:11s} n={n:6d}  Brier={br:.4f}  LL={ll:.4f}  acc={acc:.3f}")
    return br


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    national = {r["competition_id"] for r in gz_rows("competitions")
                if r["type"] == "national_team_competition"}

    print("# loading games…")
    games = []
    for r in gz_rows("games"):
        if r["competition_id"] in national:
            continue
        d = parse_d(r["date"])
        try:
            hg, ag = int(r["home_club_goals"]), int(r["away_club_goals"])
            h, a = int(r["home_club_id"]), int(r["away_club_id"])
        except (TypeError, ValueError):
            continue
        if d is None:
            continue
        games.append({"id": int(r["game_id"]), "date": d, "h": h, "a": a,
                      "hg": hg, "ag": ag, "comp": r["competition_id"],
                      "ctype": r["competition_type"]})
    games.sort(key=lambda g: (g["date"], g["id"]))
    print(f"# {len(games)} club games")

    print("# loading lineups…")
    xi: dict[int, dict[int, list[int]]] = defaultdict(dict)
    for r in gz_rows("game_lineups"):
        if r["type"] != "starting_lineup":
            continue
        gid, club, pid = int(r["game_id"]), int(r["club_id"]), int(r["player_id"])
        xi[gid].setdefault(club, []).append(pid)

    print("# loading valuations…")
    vals = Valuations.load()
    print("# loading appearances (minutes + roster events)…")
    minutes = Minutes.load()
    roster_events: dict[int, list[tuple[date, int]]] = defaultdict(list)
    for r in gz_rows("appearances"):
        d = parse_d(r["date"])
        if d:
            roster_events[int(r["player_club_id"])].append((d, int(r["player_id"])))
    for ev in roster_events.values():
        ev.sort()
    roster = RosterWindow(roster_events)

    # chronological pass: Elo + features (everything pre-match)
    elo: dict[int, float] = {}
    last_game: dict[int, date] = {}
    rows, skipped = [], Counter()
    for g in games:
        d = g["date"]
        ra = elo.setdefault(g["h"], ELO_INIT)
        rb = elo.setdefault(g["a"], ELO_INIT)

        feat = None
        lus = xi.get(g["id"], {})
        if g["h"] in lus and g["a"] in lus and len(lus[g["h"]]) == 11 == len(lus[g["a"]]):
            side = {}
            for club, tag in ((g["h"], "h"), (g["a"], "a")):
                xi_pids = lus[club]
                xi_vals = [v for p in xi_pids if (v := vals.at(p, d)) is not None]
                if len(xi_vals) < MIN_XI_VALUED:
                    skipped["xi_unvalued"] += 1
                    side = None
                    break
                pool = roster.players(club, d)
                pool_vals = sorted((v for p in pool if (v := vals.at(p, d)) is not None),
                                   reverse=True)
                if len(pool_vals) < MIN_ROSTER_VALUED:
                    skipped["roster_thin"] += 1
                    side = None
                    break
                xi_value = sum(xi_vals) * 11 / len(xi_vals)   # rescale partial
                best11 = sum(pool_vals[:11])
                cstart = d - timedelta(days=CONGESTION_DAYS)
                cong = sum(minutes.window(p, cstart, d) for p in xi_pids) / 11.0
                rest = min((d - last_game[club]).days, 14) if club in last_game else 14
                side[tag] = (xi_value, min(xi_value / best11, 1.2), cong, rest)
            if side:
                feat = {
                    "d_logxi": math.log(side["h"][0]) - math.log(side["a"][0]),
                    "d_avail": side["h"][1] - side["a"][1],
                    "d_cong": (side["h"][2] - side["a"][2]) / 90.0,
                    "d_rest": (side["h"][3] - side["a"][3]) / 7.0,
                }
        else:
            skipped["no_lineup"] += 1

        if feat is not None:
            rows.append({"date": d, "season": season_of(d), "ctype": g["ctype"],
                         "d_elo": (ra - rb) / 100.0, "feat": feat,
                         "avail_h": None,
                         "y": 0 if g["hg"] > g["ag"] else (1 if g["hg"] == g["ag"] else 2)})

        # Elo update (always, full universe)
        dr = ra - rb + ELO_HOME
        we = 1.0 / (10 ** (-dr / 400) + 1)
        res = 1.0 if g["hg"] > g["ag"] else (0.5 if g["hg"] == g["ag"] else 0.0)
        delta = ELO_K * mov_mult(abs(g["hg"] - g["ag"])) * (res - we)
        elo[g["h"]] = ra + delta
        elo[g["a"]] = rb - delta
        last_game[g["h"]] = d
        last_game[g["a"]] = d

    print(f"# {len(rows)} games with full features  |  skipped: {dict(skipped)}")

    FEATSETS = {
        "elo":        lambda r: [r["d_elo"], abs(r["d_elo"])],
        "value_only": lambda r: [r["feat"]["d_logxi"], abs(r["feat"]["d_logxi"])],
        "elo+value":  lambda r: [r["d_elo"], abs(r["d_elo"]), r["feat"]["d_logxi"]],
        "elo+avail":  lambda r: [r["d_elo"], abs(r["d_elo"]), r["feat"]["d_avail"]],
        "elo+cond":   lambda r: [r["d_elo"], abs(r["d_elo"]), r["feat"]["d_avail"],
                                 r["feat"]["d_cong"], r["feat"]["d_rest"]],
        "elo+all":    lambda r: [r["d_elo"], abs(r["d_elo"]), r["feat"]["d_logxi"],
                                 r["feat"]["d_avail"], r["feat"]["d_cong"],
                                 r["feat"]["d_rest"]],
    }
    results = {m: [] for m in FEATSETS}
    coefs_last = {}

    for ts in range(FIRST_TEST_SEASON, 2026):
        train = [r for r in rows if r["season"] < ts]
        test = [r for r in rows if r["season"] == ts]
        if len(train) < 5000 or not test:
            continue
        Y = np.array([r["y"] for r in train])
        for name, fx in FEATSETS.items():
            logit = LogisticRegression(max_iter=2000)
            logit.fit(np.array([fx(r) for r in train]), Y)
            order = list(logit.classes_)
            P = logit.predict_proba(np.array([fx(r) for r in test]))
            for r, p in zip(test, P):
                results[name].append({**r, "p": [float(p[order.index(k)]) for k in range(3)]})
            coefs_last[name] = logit

    print("\n=== OVERALL — walk-forward 2016-17 → 2025-26 ===")
    base = None
    for name, recs in results.items():
        br = summarize(name, recs)
        if name == "elo":
            base = br
    print("\n(Brier delta vs elo baseline — negative = factor helps)")
    for name, recs in results.items():
        if name == "elo" or not recs:
            continue
        br = sum(brier3(r["p"], r["y"]) for r in recs) / len(recs)
        print(f"  {name:11s} {br - base:+.4f}")

    print("\n=== PER SEASON (Brier, elo vs elo+all) ===")
    for ts in sorted(set(r["season"] for r in results["elo"])):
        e = [r for r in results["elo"] if r["season"] == ts]
        a = [r for r in results["elo+all"] if r["season"] == ts]
        be = sum(brier3(r["p"], r["y"]) for r in e) / len(e)
        ba = sum(brier3(r["p"], r["y"]) for r in a) / len(a)
        print(f"  {ts}-{str(ts+1)[2:]}: elo={be:.4f}  elo+all={ba:.4f}  "
              f"delta={ba-be:+.4f}  n={len(e)}  {'✓' if ba < be else '✗'}")

    print("\n=== WHERE CONDITION SHOULD MATTER — big availability gap ===")
    for thr in (0.10, 0.15, 0.20):
        sel_e = [r for r in results["elo"] if abs(r["feat"]["d_avail"]) >= thr]
        sel_a = [r for r in results["elo+all"] if abs(r["feat"]["d_avail"]) >= thr]
        if len(sel_e) > 300:
            be = sum(brier3(r["p"], r["y"]) for r in sel_e) / len(sel_e)
            ba = sum(brier3(r["p"], r["y"]) for r in sel_a) / len(sel_a)
            print(f"  |d_avail|>={thr:.2f}: n={len(sel_e):5d}  elo={be:.4f}  "
                  f"elo+all={ba:.4f}  delta={ba-be:+.4f}")

    print("\n=== PER COMPETITION TYPE (elo vs elo+all) ===")
    for ct in sorted(set(r["ctype"] for r in results["elo"])):
        e = [r for r in results["elo"] if r["ctype"] == ct]
        a = [r for r in results["elo+all"] if r["ctype"] == ct]
        if len(e) > 500:
            be = sum(brier3(r["p"], r["y"]) for r in e) / len(e)
            ba = sum(brier3(r["p"], r["y"]) for r in a) / len(a)
            print(f"  {ct:20s} n={len(e):6d}  elo={be:.4f}  elo+all={ba:.4f}  delta={ba-be:+.4f}")

    print("\n=== LAST-FOLD COEFFICIENTS (sanity / direction) ===")
    for name in ("elo+avail", "elo+cond", "elo+all"):
        m = coefs_last.get(name)
        if m is not None:
            print(f"  {name}: classes={list(m.classes_)}")
            for cls, row in zip(m.classes_, m.coef_):
                print(f"    y={cls}: " + "  ".join(f"{c:+.3f}" for c in row))


if __name__ == "__main__":
    main()
