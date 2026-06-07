"""
LAB — World Cup 2026 Monte Carlo tournament simulator (who wins the World Cup?).

Michele-side analysis only. Simulates the REAL 104-match tournament (12 groups,
R32 with best thirds, knockout bracket) N times using the wc-elo-logit-v2 match
model from scripts/lab_backtest_10y.py (Elo recomputed from the in-repo martj42
CSV + logit on [elo_diff, |elo_diff|], coefficients fitted walk-forward on the
last 10 years). Output: per-team probability of reaching R32/R16/QF/SF/Final and
of WINNING the World Cup — the Opta-supercomputer-style headline table.

Bracket source: the production /api/world-cup/fixtures (ESPN proxy), cached to
data/wc2026_fixtures_cache.json. Known feed quirks handled:
  - two group-MD3 games mislabelled round32 (real team names, June 28 02:00Z)
  - R32 #16 mislabelled round16 ("Group K Winner vs Third Place D/E/I/J/L")
  - "Round of 32 N" / "Round of 16 N" numbering assumed = ESPN event-id order
    (ids 760486..760501 for R32) — second-order effect on P(win), flagged in doc.

Host advantage: +100 Elo when MEX/USA/CAN play in their own country (group stage
only by schedule; KO too if the draw lands them at home).
Knockout draw collapse: p_through = p_win + p_draw * p_win/(p_win+p_loss).

Run:  PYTHONUTF8=1 python scripts/lab_wc_simulator.py [n_sims]
"""
from __future__ import annotations

import csv
import io
import json
import math
import random
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.world_cup_history import canonical_team_name  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "national_teams" / "international_results_raw.csv"
FIX_CACHE = ROOT / "data" / "wc2026_fixtures_cache.json"
FIX_URL = "https://agentic-markets-roan.vercel.app/api/world-cup/fixtures"

ELO_INIT, ELO_HOME = 1500.0, 100.0
N_SIMS = int(sys.argv[1]) if len(sys.argv) > 1 else 100_000
# per-sim team-strength noise (Elo points, sigma). Point-Elo treated as certain
# compounds over 7 rounds into overconfident tournament odds (538-style fix).
ELO_NOISE = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0

HOST_COUNTRY_CITIES = {
    "Mexico": {"mexico city", "guadalajara", "guadalupe", "monterrey"},
    "United States": {"inglewood", "santa clara", "seattle", "arlington",
                      "houston", "kansas city", "atlanta", "miami gardens",
                      "east rutherford", "philadelphia", "foxborough"},
    "Canada": {"toronto", "vancouver"},
}

# empirical scoreline distributions conditional on outcome (internationals,
# coarse — only used for goal-difference tiebreaks inside group standings)
SCORES_W = [((1, 0), .31), ((2, 0), .19), ((2, 1), .18), ((3, 0), .10),
            ((3, 1), .09), ((4, 0), .04), ((3, 2), .04), ((4, 1), .03), ((5, 0), .02)]
SCORES_D = [((0, 0), .33), ((1, 1), .46), ((2, 2), .16), ((3, 3), .05)]


def elo_k(t: str) -> float:
    tl = t.lower()
    if tl == "fifa world cup":
        return 60.0
    if any(s in tl for s in ("euro", "copa américa", "copa america", "african cup",
                             "afc asian cup", "gold cup", "confederations")) and "qualification" not in tl:
        return 50.0
    if "qualification" in tl or "nations league" in tl:
        return 40.0
    if tl == "friendly":
        return 20.0
    return 30.0


def mov(m: int) -> float:
    return 1.0 if m <= 1 else (1.5 if m == 2 else 1.75 + max(0, m - 3) / 8)


def build_elo_and_logit():
    elo: dict[str, float] = defaultdict(lambda: ELO_INIT)
    X, Y = [], []
    cut = date(2016, 1, 1)
    with io.open(CSV_PATH, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            try:
                hg, ag = int(r["home_score"]), int(r["away_score"])
            except (TypeError, ValueError):
                continue
            d = date.fromisoformat(r["date"])
            h, a = r["home_team"], r["away_team"]
            neutral = (r["neutral"] or "").strip().upper() == "TRUE"
            ra, rb = elo[h], elo[a]
            dr = ra - rb + (0.0 if neutral else ELO_HOME)
            if d >= cut:
                X.append([dr, abs(dr)])
                Y.append(0 if hg > ag else (1 if hg == ag else 2))
            we = 1.0 / (10 ** (-dr / 400) + 1)
            res = 1.0 if hg > ag else (0.5 if hg == ag else 0.0)
            delta = elo_k(r["tournament"]) * mov(abs(hg - ag)) * (res - we)
            elo[h], elo[a] = ra + delta, rb - delta
    logit = LogisticRegression(max_iter=1000)
    logit.fit(np.array(X), np.array(Y))
    return dict(elo), logit


def prob_table(logit):
    """p(home win/draw/away win) lookup on integer elo-diff grid [-1200,1200]."""
    grid = np.arange(-1200, 1201)
    feats = np.column_stack([grid, np.abs(grid)])
    probs = logit.predict_proba(feats)
    order = list(logit.classes_)
    cols = [order.index(k) for k in range(3)]
    return {int(g): tuple(float(p[c]) for c in cols) for g, p in zip(grid, probs)}


def fetch_fixtures():
    if FIX_CACHE.exists():
        return json.loads(FIX_CACHE.read_text(encoding="utf-8"))
    with urllib.request.urlopen(FIX_URL, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    FIX_CACHE.write_text(json.dumps(data), encoding="utf-8")
    return data


def main():
    print(f"# building Elo from {CSV_PATH.name} + logit (10y) ...", file=sys.stderr)
    elo, logit = build_elo_and_logit()
    P = prob_table(logit)

    fx = fetch_fixtures()["fixtures"]
    groups: dict[str, set[str]] = defaultdict(set)
    group_matches: list[dict] = []
    placeholder = lambda s: any(k in s for k in ("Winner", "2nd Place", "Third Place", "Loser"))

    for f in fx:
        h, a = f["home_team"], f["away_team"]
        # quirk: group-MD3 games mislabelled round32 carry REAL team names
        is_group = f["stage"] == "group" or (f["stage"] == "round32"
                                             and not placeholder(h) and not placeholder(a))
        if is_group and f.get("group"):
            groups[f["group"]].add(h)
            groups[f["group"]].add(a)
            group_matches.append(f)
        elif is_group:  # mislabelled MD3: infer group from team membership later
            group_matches.append(f)

    # complete group membership for the 2 mislabelled MD3 fixtures
    for f in group_matches:
        if not f.get("group"):
            for g, teams in groups.items():
                if f["home_team"] in teams or f["away_team"] in teams:
                    f["group"] = g
                    teams.add(f["home_team"])
                    teams.add(f["away_team"])
                    break

    assert len(groups) == 12 and all(len(t) == 4 for t in groups.values()), \
        {g: len(t) for g, t in groups.items()}
    assert len(group_matches) == 72, len(group_matches)

    # knockout skeleton, ESPN id order (see module docstring)
    ko = sorted((f for f in fx if f["stage"] in ("round32", "round16", "quarter", "semi", "final")
                 and placeholder(f["home_team"] + f["away_team"])), key=lambda f: int(f["id"]))
    r32 = [f for f in ko if int(f["id"]) <= 760501]          # includes mislabelled #16
    r16 = [f for f in ko if 760502 <= int(f["id"]) <= 760509]
    qf = [f for f in ko if 760510 <= int(f["id"]) <= 760513]
    sf = [f for f in ko if int(f["id"]) in (760514, 760515)]
    final = [f for f in ko if int(f["id"]) == 760517]
    assert len(r32) == 16 and len(r16) == 8 and len(qf) == 4 and len(sf) == 2 and len(final) == 1

    # canonical name -> rating; ESPN name kept for display
    def rating(team: str) -> float:
        c = canonical_team_name(team)
        if c in elo:
            return elo[c]
        raise KeyError(f"no Elo for {team!r} -> {c!r}")

    def team_country(team: str) -> str:
        return canonical_team_name(team)

    def host_bonus(team: str, city: str) -> float:
        c = canonical_team_name(team)
        cities = HOST_COUNTRY_CITIES.get(c)
        base = (city or "").split(",")[0].strip().lower()
        return ELO_HOME if cities and base in cities else 0.0

    def base_dr(home: str, away: str, city: str) -> float:
        return rating(home) - rating(away) + host_bonus(home, city) - host_bonus(away, city)

    def probs_for(dr: float):
        return P[max(-1200, min(1200, int(round(dr))))]

    # pre-resolve group match base elo-diffs (static across sims)
    for f in group_matches:
        f["_dr"] = base_dr(f["home_team"], f["away_team"], f["city"])

    def sample_score(outcome: int):
        table = SCORES_D if outcome == 1 else SCORES_W
        x = random.random()
        acc = 0.0
        for (a, b), w in table:
            acc += w
            if x <= acc:
                return (a, b) if outcome != 2 else (b, a)
        return (1, 1) if outcome == 1 else ((1, 0) if outcome == 0 else (0, 1))

    def parse_slot(label: str):
        # "Group A Winner" | "Group B 2nd Place" | "Third Place Group A/B/C/D/F"
        if label.startswith("Third Place"):
            return ("third", label.split("Group ")[1].split("/"))
        g = label.split()[1]
        return ("first", g) if "Winner" in label else ("second", g)

    r32_slots = [(parse_slot(f["home_team"]), parse_slot(f["away_team"]), f["city"]) for f in r32]

    counts = {t: defaultdict(int) for g in groups.values() for t in g}

    all_teams = [t for g in groups.values() for t in g]
    for _ in range(N_SIMS):
        off = ({t: random.gauss(0.0, ELO_NOISE) for t in all_teams}
               if ELO_NOISE > 0 else None)

        def d_off(h, a):
            return (off[h] - off[a]) if off else 0.0

        # group stage
        stats = {t: [0, 0, 0] for g in groups.values() for t in g}  # pts, gd, gf
        for f in group_matches:
            p = probs_for(f["_dr"] + d_off(f["home_team"], f["away_team"]))
            x = random.random()
            out = 0 if x < p[0] else (1 if x < p[0] + p[1] else 2)
            hs, as_ = sample_score(out)
            for team, gf_, ga_ in ((f["home_team"], hs, as_), (f["away_team"], as_, hs)):
                s = stats[team]
                s[1] += gf_ - ga_
                s[2] += gf_
                if gf_ > ga_:
                    s[0] += 3
                elif gf_ == ga_:
                    s[0] += 1
        ranked = {}
        thirds = []
        for g, teams in groups.items():
            order = sorted(teams, key=lambda t: (stats[t][0], stats[t][1], stats[t][2], random.random()), reverse=True)
            ranked[g] = order
            thirds.append((g, order[2]))
        thirds.sort(key=lambda gt: (stats[gt[1]][0], stats[gt[1]][1], stats[gt[1]][2], random.random()), reverse=True)
        qual_thirds = dict(thirds[:8])   # group -> team

        # assign qualified thirds to third-slots (backtracking on candidate sets)
        third_slots = [i for i, (h, a, _) in enumerate(r32_slots)
                       for side in (h, a) if side[0] == "third"]
        slot_cands = []
        for i in third_slots:
            side = r32_slots[i][0] if r32_slots[i][0][0] == "third" else r32_slots[i][1]
            slot_cands.append([g for g in side[1] if g in qual_thirds])

        assign = {}
        def backtrack(k, used):
            if k == len(third_slots):
                return True
            for g in slot_cands[k]:
                if g not in used:
                    assign[third_slots[k]] = qual_thirds[g]
                    used.add(g)
                    if backtrack(k + 1, used):
                        return True
                    used.remove(g)
            return False
        if not backtrack(0, set()):     # rare unsolvable combo -> relaxed greedy
            used = set()
            for k, i in enumerate(third_slots):
                g = next((g for g in slot_cands[k] if g not in used),
                         next(g for g in qual_thirds if g not in used))
                assign[i] = qual_thirds[g]
                used.add(g)

        def resolve(slot, idx):
            kind = slot[0]
            if kind == "first":
                return ranked[slot[1]][0]
            if kind == "second":
                return ranked[slot[1]][1]
            return assign[idx]

        # knockout
        def ko_winner(home, away, city):
            ph, pd, pa = probs_for(base_dr(home, away, city) + d_off(home, away))
            pw = ph + (pd * ph / (ph + pa) if ph + pa > 0 else pd / 2)
            return home if random.random() < pw else away

        alive = []
        for i, (hs_, as_, city) in enumerate(r32_slots):
            h = resolve(hs_, i)
            a = resolve(as_, i)
            for t in (h, a):
                counts[t]["r32"] += 1
            alive.append(ko_winner(h, a, city))
        # R16: pairs by label "Round of 32 N Winner" — N = position in id order
        def n_of(label):
            return int(label.split()[3]) - 1
        cur = alive
        nxt = []
        for f in r16:
            h = cur[n_of(f["home_team"])]
            a = cur[n_of(f["away_team"])]
            for t in (h, a):
                counts[t]["r16"] += 1
            nxt.append(ko_winner(h, a, f["city"]))
        cur = nxt
        nxt = []
        for f in qf:
            h = cur[int(f["home_team"].split()[3]) - 1]
            a = cur[int(f["away_team"].split()[3]) - 1]
            for t in (h, a):
                counts[t]["qf"] += 1
            nxt.append(ko_winner(h, a, f["city"]))
        cur = nxt
        nxt = []
        for f in sf:
            h = cur[int(f["home_team"].split()[1]) - 1]
            a = cur[int(f["away_team"].split()[1]) - 1]
            for t in (h, a):
                counts[t]["sf"] += 1
            nxt.append(ko_winner(h, a, f["city"]))
        fteams = nxt
        for t in fteams:
            counts[t]["final"] += 1
        champ = ko_winner(fteams[0], fteams[1], final[0]["city"])
        counts[champ]["win"] += 1

    print(f"\n# WC2026 Monte Carlo — {N_SIMS:,} sims · model wc-elo-logit-v2 (lab) "
          f"· Elo as of {date.today().isoformat()} · elo-noise sigma={ELO_NOISE:g}")
    print(f"{'team':22s} {'elo':>5s} {'R32%':>6s} {'R16%':>6s} {'QF%':>6s} "
          f"{'SF%':>6s} {'Fin%':>6s} {'WIN%':>6s}")
    rows = sorted(counts.items(), key=lambda kv: kv[1]["win"], reverse=True)
    for team, c in rows:
        print(f"{team:22s} {rating(team):5.0f} "
              f"{100*c['r32']/N_SIMS:6.1f} {100*c['r16']/N_SIMS:6.1f} "
              f"{100*c['qf']/N_SIMS:6.1f} {100*c['sf']/N_SIMS:6.1f} "
              f"{100*c['final']/N_SIMS:6.1f} {100*c['win']/N_SIMS:6.2f}")


if __name__ == "__main__":
    main()
