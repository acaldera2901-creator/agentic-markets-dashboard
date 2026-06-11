"""
LAB — Football COMMERCIAL VOLUME vs the confidence floor (walk-forward).

Question (Michele 2026-06-11): with the floor 56 the football board surfaces too
few picks to be commercial. Quantify, held-out:
  A) CLUBS (49.8k, football-data.co.uk closing odds, blend 0.3 elo + 0.7 market):
     - floor sweep 0.50..0.62: picks/season + hit-rate
     - the "LEAN band" 0.50-0.56: what hit-rate would a second, softer tier have?
     - lean band RESTRICTED to top-flight + non-derby + big-5 (the calibrated core)
  B) INTERNATIONALS / WC (49k, served v2-elo recipe: K-by-tournament Elo + logit):
     - same sweep + lean band on the WC-like subset (neutral/final tournaments),
       qualifiers, friendlies (live friendly floor = 61).

Same leak-free recipes as lab_segment_patterns_10y.py / lab_confederation_prior.py.
Held-out: clubs seasons 2022+, internationals 2022+ (includes WC2022, Euro/Copa 2024).

Run: PYTHONUTF8=1 <clone>/.venv/Scripts/python.exe C:/Users/bragh/am-lab/lab_football_commercial_tiers.py
"""
from __future__ import annotations
import csv, io, math
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression

BASE = Path(r"C:\Users\bragh\Desktop\_Desktop_Organizzato_\01_Progetti_Agentic_Markets\agentic-markets\agentic-markets-dashboard-production\data")
CLUB_DATA = BASE / "football_data_uk_10y"
INTL_CSV = BASE / "national_teams" / "international_results_raw.csv"

FIRST_TEST_SEASON = 2017
HELD_OUT_SEASON = 2022
FLOORS = [0.45, 0.48, 0.50, 0.52, 0.54, 0.56, 0.58, 0.60, 0.62]
LIVE_FLOOR = 0.56
LEAN_LO, LEAN_HI = 0.50, 0.56

COUNTRY = {"E0": "ENG", "E1": "ENG", "I1": "ITA", "I2": "ITA", "SP1": "ESP", "SP2": "ESP",
           "D1": "GER", "D2": "GER", "F1": "FRA", "F2": "FRA", "P1": "POR", "N1": "NED",
           "B1": "BEL", "T1": "TUR", "G1": "GRE", "SC0": "SCO"}
TIER2 = {"E1", "I2", "SP2", "D2", "F2"}
BIG5 = {"ENG", "ITA", "ESP", "GER", "FRA"}
ELO_INIT_T1, ELO_INIT_T2, ELO_HOME, ELO_K = 1500.0, 1400.0, 65.0, 20.0
ODDS_PREF = [("PSCH", "PSCD", "PSCA"), ("PSH", "PSD", "PSA"),
             ("B365CH", "B365CD", "B365CA"), ("B365H", "B365D", "B365A"),
             ("AvgCH", "AvgCD", "AvgCA"), ("AvgH", "AvgD", "AvgA")]
DERBIES = [
    ("ENG", "Man United", "Man City"), ("ENG", "Arsenal", "Tottenham"),
    ("ENG", "Liverpool", "Everton"), ("ENG", "Chelsea", "Tottenham"),
    ("ENG", "Arsenal", "Chelsea"), ("ENG", "Newcastle", "Sunderland"),
    ("ITA", "Inter", "Milan"), ("ITA", "Roma", "Lazio"), ("ITA", "Juventus", "Torino"),
    ("ITA", "Genoa", "Sampdoria"), ("ITA", "Napoli", "Roma"),
    ("ESP", "Real Madrid", "Barcelona"), ("ESP", "Real Madrid", "Ath Madrid"),
    ("ESP", "Sevilla", "Betis"), ("ESP", "Ath Bilbao", "Sociedad"), ("ESP", "Valencia", "Levante"),
    ("GER", "Bayern Munich", "Dortmund"), ("GER", "Dortmund", "Schalke 04"),
    ("GER", "M'gladbach", "FC Koln"),
    ("FRA", "Paris SG", "Marseille"), ("FRA", "Lyon", "St Etienne"), ("FRA", "Nice", "Monaco"),
    ("POR", "Porto", "Benfica"), ("POR", "Benfica", "Sp Lisbon"), ("POR", "Porto", "Sp Lisbon"),
    ("NED", "Ajax", "Feyenoord"), ("NED", "Ajax", "PSV Eindhoven"), ("NED", "Feyenoord", "PSV Eindhoven"),
    ("SCO", "Celtic", "Rangers"), ("SCO", "Hearts", "Hibernian"), ("SCO", "Dundee", "Dundee United"),
    ("TUR", "Galatasaray", "Fenerbahce"), ("TUR", "Galatasaray", "Besiktas"), ("TUR", "Fenerbahce", "Besiktas"),
    ("GRE", "Olympiakos", "Panathinaikos"), ("GRE", "PAOK", "AEK"), ("GRE", "Olympiakos", "AEK"),
    ("BEL", "Club Brugge", "Anderlecht"), ("BEL", "Club Brugge", "Cercle Brugge"), ("BEL", "Standard", "Anderlecht"),
]
DERBY_SET = {frozenset((f"{c}:{a}", f"{c}:{b}")) for c, a, b in DERBIES}


def parse_date(s):
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None


def season_of(d):
    return d.year if d.month >= 7 else d.year - 1


def mov_mult(m):
    return 1.0 if m <= 1 else (1.5 if m == 2 else 1.75 + max(0, m - 3) / 8.0)


def hit(rec):
    return max(range(3), key=lambda k: rec["p"][k]) == rec["y"]


def band(recs, lo, hi):
    sel = [r for r in recs if lo <= max(r["p"]) < hi]
    if not sel:
        return None
    return sum(hit(r) for r in sel) / len(sel), len(sel)


def sweep(label, recs, n_seasons):
    print(f"  [{label}] n={len(recs)}  (~{len(recs)/n_seasons:.0f} matches/season)")
    print("    floor | kept%  picks/season | hit")
    for f in FLOORS:
        sel = [r for r in recs if max(r["p"]) >= f]
        if not sel:
            continue
        a = sum(hit(r) for r in sel) / len(sel)
        mark = " <- LIVE" if abs(f - LIVE_FLOOR) < 1e-9 else ""
        print(f"    {f:.2f}  | {100*len(sel)/len(recs):5.1f}  {len(sel)/n_seasons:6.0f}       | {a:.3f}{mark}")
    b = band(recs, LEAN_LO, LEAN_HI)
    if b:
        print(f"    LEAN band [{LEAN_LO:.2f},{LEAN_HI:.2f}): hit={b[0]:.3f}  n={b[1]} "
              f"(+{100*b[1]/max(1,len([r for r in recs if max(r['p'])>=LIVE_FLOOR])):.0f}% extra picks vs floor {LIVE_FLOOR:.2f})")


# ───────────────────────────── A) CLUBS ─────────────────────────────
def clubs():
    rows = []
    for f in sorted(CLUB_DATA.glob("*.csv")):
        _, div = f.stem.split("_", 1)
        if div not in COUNTRY:
            continue
        with io.open(f, encoding="utf-8", errors="replace") as fh:
            for r in csv.DictReader(fh):
                if not r.get("HomeTeam") or not r.get("AwayTeam"):
                    continue
                d = parse_date(r.get("Date") or "")
                try:
                    hg, ag = int(float(r["FTHG"])), int(float(r["FTAG"]))
                except (KeyError, TypeError, ValueError):
                    continue
                if d is None:
                    continue
                odds = None
                for ch, cd, ca in ODDS_PREF:
                    try:
                        oh, od, oa = float(r[ch]), float(r[cd]), float(r[ca])
                        if oh > 1 and od > 1 and oa > 1:
                            odds = (oh, od, oa)
                            break
                    except (KeyError, TypeError, ValueError):
                        continue
                c = COUNTRY[div]
                rows.append({"date": d, "div": div, "country": c, "tier2": div in TIER2,
                             "home": f"{c}:{r['HomeTeam'].strip()}", "away": f"{c}:{r['AwayTeam'].strip()}",
                             "hg": hg, "ag": ag, "odds": odds})
    rows.sort(key=lambda r: r["date"])

    elo = {}
    for r in rows:
        for team in (r["home"], r["away"]):
            elo.setdefault(team, ELO_INIT_T2 if r["tier2"] else ELO_INIT_T1)
        ra, rb = elo[r["home"]], elo[r["away"]]
        r["elo_h_pre"], r["elo_a_pre"] = ra, rb
        dr = ra - rb + ELO_HOME
        we = 1.0 / (10 ** (-dr / 400) + 1)
        res = 1.0 if r["hg"] > r["ag"] else (0.5 if r["hg"] == r["ag"] else 0.0)
        delta = ELO_K * mov_mult(abs(r["hg"] - r["ag"])) * (res - we)
        elo[r["home"]] = ra + delta
        elo[r["away"]] = rb - delta

    recs = []
    for ts in range(FIRST_TEST_SEASON, 2027):
        X, Y = [], []
        for r in rows:
            if season_of(r["date"]) < ts:
                d = r["elo_h_pre"] - r["elo_a_pre"]
                X.append([d, abs(d)])
                Y.append(0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2))
        if len(X) < 2000:
            continue
        logit = LogisticRegression(max_iter=1000).fit(np.array(X), np.array(Y))
        order = list(logit.classes_)
        for r in rows:
            if season_of(r["date"]) != ts or not r["odds"]:
                continue
            y = 0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2)
            inv = [1 / o for o in r["odds"]]
            s = sum(inv)
            p_mkt = [x / s for x in inv]
            d = r["elo_h_pre"] - r["elo_a_pre"]
            pe = logit.predict_proba(np.array([[d, abs(d)]]))[0]
            p_elo = [float(pe[order.index(k)]) for k in range(3)]
            recs.append({"y": y, "season": ts, "country": r["country"], "tier2": r["tier2"],
                         "p": [0.3 * a + 0.7 * b for a, b in zip(p_elo, p_mkt)],
                         "derby": frozenset((r["home"], r["away"])) in DERBY_SET})

    held = [r for r in recs if r["season"] >= HELD_OUT_SEASON]
    n_seasons = len(set(r["season"] for r in held))
    print(f"\n================ A) CLUBS — held-out seasons {HELD_OUT_SEASON}+ ({n_seasons} seasons) ================")
    sweep("all clubs", held, n_seasons)
    core = [r for r in held if not r["tier2"] and not r["derby"] and r["country"] in BIG5]
    print(f"\n  CORE = top-flight big-5 non-derby (the well-calibrated cut)")
    sweep("core", core, n_seasons)
    b = band(core, LEAN_LO, LEAN_HI)
    full = band(held, LEAN_LO, LEAN_HI)
    if b and full:
        print(f"\n  LEAN band restricted to CORE: hit {full[0]:.3f} -> {b[0]:.3f} "
              f"(n {full[1]} -> {b[1]})")


# ──────────────────────── B) INTERNATIONALS / WC ────────────────────────
def elo_k(t: str) -> float:
    t = t.lower()
    if t == "fifa world cup":
        return 60.0
    if any(s in t for s in ("euro", "copa américa", "copa america", "african cup",
                            "afc asian cup", "gold cup", "confederations")) and "qualification" not in t:
        return 50.0
    if "qualification" in t or "nations league" in t:
        return 40.0
    if t == "friendly":
        return 20.0
    return 30.0


def internationals():
    rows = []
    with io.open(INTL_CSV, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            try:
                hg, ag = int(r["home_score"]), int(r["away_score"])
            except (TypeError, ValueError):
                continue
            rows.append({"date": date.fromisoformat(r["date"]),
                         "home": r["home_team"], "away": r["away_team"], "hg": hg, "ag": ag,
                         "tournament": r["tournament"],
                         "neutral": (r["neutral"] or "").strip().upper() == "TRUE"})
    rows.sort(key=lambda r: r["date"])

    elo = defaultdict(lambda: 1500.0)
    for r in rows:
        ra, rb = elo[r["home"]], elo[r["away"]]
        dr = ra - rb + (0.0 if r["neutral"] else 100.0)
        we = 1.0 / (10 ** (-dr / 400) + 1)
        res = 1.0 if r["hg"] > r["ag"] else (0.5 if r["hg"] == r["ag"] else 0.0)
        k = elo_k(r["tournament"]) * mov_mult(abs(r["hg"] - r["ag"]))
        r["elo_h_pre"], r["elo_a_pre"] = ra, rb
        elo[r["home"]] = ra + k * (res - we)
        elo[r["away"]] = rb - k * (res - we)

    recs = []
    for ty in range(HELD_OUT_SEASON, 2027):
        cut, end = date(ty, 1, 1), date(ty + 1, 1, 1)
        train = [r for r in rows if date(ty - 10, 1, 1) <= r["date"] < cut]
        test = [r for r in rows if cut <= r["date"] < end]
        if not test or len(train) < 3000:
            continue
        X, Y = [], []
        for r in train:
            dr = r["elo_h_pre"] - r["elo_a_pre"] + (0.0 if r["neutral"] else 100.0)
            X.append([dr, abs(dr)])
            Y.append(0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2))
        m = LogisticRegression(max_iter=1000).fit(np.array(X), np.array(Y))
        order = list(m.classes_)
        for r in test:
            dr = r["elo_h_pre"] - r["elo_a_pre"] + (0.0 if r["neutral"] else 100.0)
            pe = m.predict_proba(np.array([[dr, abs(dr)]]))[0]
            t = r["tournament"].lower()
            recs.append({"y": 0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2),
                         "p": [float(pe[order.index(k)]) for k in range(3)],
                         "wc_like": r["neutral"] and elo_k(r["tournament"]) >= 50.0,
                         "friendly": t == "friendly",
                         "qualifier": "qualification" in t})

    n_years = 2026 - HELD_OUT_SEASON + 1
    print(f"\n============ B) INTERNATIONALS — held-out {HELD_OUT_SEASON}+ (v2-elo recipe) ============")
    sweep("WC-like (neutral finals)", [r for r in recs if r["wc_like"]], n_years)
    print()
    sweep("qualifiers", [r for r in recs if r["qualifier"]], n_years)
    print()
    sweep("friendlies (live floor 61)", [r for r in recs if r["friendly"]], n_years)


if __name__ == "__main__":
    clubs()
    internationals()
