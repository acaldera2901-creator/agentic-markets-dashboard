"""
LAB — 10-year walk-forward SEGMENT/PATTERN backtest on club football vs the market.

Builds on the proven recipe of scripts/lab_backtest_clubs_10y.py (Elo K=20*MOV,
+65 home, season-refit logit on [elo_diff,|elo_diff|], blend 0.3*elo+0.7*market,
Pinnacle-closing de-vig). SAME leak-free walk-forward (elo stored pre-match, logit
trained only on prior seasons, goal-rate windows strictly in the past).

What this script ADDS — to answer "where do we actually have an edge, and on what
KIND of match":
  * per-segment metrics: Brier, accuracy(blend argmax), model-vs-market Brier delta
  * segments: favourite-strength bucket, derby vs not, season phase, country, tier
  * CALIBRATION (ECE) of the blended probabilities per segment
  * CONFIDENCE-FLOOR sweep (today's friendlies finding) overall + per favourite bucket
  * FLAT-STAKE ROI betting the blend's top pick at the REAL closing odds (with vig)
    -> the honest test of whether a segment beats the market in money terms
  * outcome base rates (H/D/A) per league -> "how matches unfold" where

Michele-side analysis only; reads the local lab data, touches no served code.
Run:  PYTHONUTF8=1 .venv/Scripts/python.exe C:/Users/bragh/am-lab/lab_segment_patterns_10y.py
"""
from __future__ import annotations
import csv, io, math
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "football_data_uk_10y"  # same dataset as lab_backtest_clubs_10y.py
FIRST_TEST_SEASON = 2017
MAX_GOALS = 10
EPS = 1e-12

COUNTRY = {"E0":"ENG","E1":"ENG","I1":"ITA","I2":"ITA","SP1":"ESP","SP2":"ESP",
           "D1":"GER","D2":"GER","F1":"FRA","F2":"FRA","P1":"POR","N1":"NED",
           "B1":"BEL","T1":"TUR","G1":"GRE","SC0":"SCO"}
TIER2 = {"E1","I2","SP2","D2","F2"}
ELO_INIT_T1, ELO_INIT_T2, ELO_HOME, ELO_K = 1500.0, 1400.0, 65.0, 20.0
ODDS_PREF = [("PSCH","PSCD","PSCA"),("PSH","PSD","PSA"),
             ("B365CH","B365CD","B365CA"),("B365H","B365D","B365A"),
             ("AvgCH","AvgCD","AvgCA"),("AvgH","AvgD","AvgA")]

# Curated same-city / historic rivalries, EXACT football-data.co.uk spellings.
DERBIES = [
    # England
    ("ENG","Man United","Man City"),("ENG","Arsenal","Tottenham"),
    ("ENG","Liverpool","Everton"),("ENG","Chelsea","Tottenham"),
    ("ENG","Arsenal","Chelsea"),("ENG","Newcastle","Sunderland"),
    # Italy
    ("ITA","Inter","Milan"),("ITA","Roma","Lazio"),("ITA","Juventus","Torino"),
    ("ITA","Genoa","Sampdoria"),("ITA","Napoli","Roma"),
    # Spain
    ("ESP","Real Madrid","Barcelona"),("ESP","Real Madrid","Ath Madrid"),
    ("ESP","Sevilla","Betis"),("ESP","Ath Bilbao","Sociedad"),("ESP","Valencia","Levante"),
    # Germany
    ("GER","Bayern Munich","Dortmund"),("GER","Dortmund","Schalke 04"),
    ("GER","M'gladbach","FC Koln"),
    # France
    ("FRA","Paris SG","Marseille"),("FRA","Lyon","St Etienne"),("FRA","Nice","Monaco"),
    # Portugal
    ("POR","Porto","Benfica"),("POR","Benfica","Sp Lisbon"),("POR","Porto","Sp Lisbon"),
    # Netherlands
    ("NED","Ajax","Feyenoord"),("NED","Ajax","PSV Eindhoven"),("NED","Feyenoord","PSV Eindhoven"),
    # Scotland
    ("SCO","Celtic","Rangers"),("SCO","Hearts","Hibernian"),("SCO","Dundee","Dundee United"),
    # Turkey
    ("TUR","Galatasaray","Fenerbahce"),("TUR","Galatasaray","Besiktas"),("TUR","Fenerbahce","Besiktas"),
    # Greece
    ("GRE","Olympiakos","Panathinaikos"),("GRE","PAOK","AEK"),("GRE","Olympiakos","AEK"),
    # Belgium
    ("BEL","Club Brugge","Anderlecht"),("BEL","Club Brugge","Cercle Brugge"),("BEL","Standard","Anderlecht"),
]
DERBY_SET = {frozenset((f"{c}:{a}", f"{c}:{b}")) for c, a, b in DERBIES}


def parse_date(s):
    for fmt in ("%d/%m/%Y","%d/%m/%y"):
        try: return datetime.strptime(s.strip(), fmt).date()
        except ValueError: continue
    return None

def season_of(d): return d.year if d.month >= 7 else d.year - 1

def phase_of(d):
    m = d.month
    if m in (8,9): return "opening"
    if m in (3,4,5): return "run-in"
    return "mid"

def fav_bucket(p):
    mx = max(p)
    if mx < 0.45: return "tossup(<45)"
    if mx < 0.55: return "slight(45-55)"
    if mx < 0.70: return "clear(55-70)"
    return "heavy(>70)"


def load_rows():
    rows = []
    for f in sorted(DATA.glob("*.csv")):
        season, div = f.stem.split("_", 1)
        if div not in COUNTRY: continue
        with io.open(f, encoding="utf-8", errors="replace") as fh:
            for r in csv.DictReader(fh):
                if not r.get("HomeTeam") or not r.get("AwayTeam"): continue
                d = parse_date(r.get("Date") or "")
                try: hg, ag = int(float(r["FTHG"])), int(float(r["FTAG"]))
                except (KeyError, TypeError, ValueError): continue
                if d is None: continue
                odds = None
                for ch, cd, ca in ODDS_PREF:
                    try:
                        oh, od, oa = float(r[ch]), float(r[cd]), float(r[ca])
                        if oh > 1 and od > 1 and oa > 1: odds = (oh, od, oa); break
                    except (KeyError, TypeError, ValueError): continue
                c = COUNTRY[div]
                rows.append({"date": d, "div": div, "country": c, "tier2": div in TIER2,
                             "home": f"{c}:{r['HomeTeam'].strip()}", "away": f"{c}:{r['AwayTeam'].strip()}",
                             "hg": hg, "ag": ag, "odds": odds})
    rows.sort(key=lambda r: r["date"])
    return rows


def mov_mult(m): return 1.0 if m <= 1 else (1.5 if m == 2 else 1.75 + max(0, m-3)/8.0)
def brier3(p, y):
    t = [0.0,0.0,0.0]; t[y] = 1.0
    return sum((pi-ti)**2 for pi, ti in zip(p, t))


def ece(recs, bins=10):
    """Expected Calibration Error on the predicted-winner probability."""
    if not recs: return float("nan")
    buckets = defaultdict(lambda: [0,0,0.0])  # n, hits, conf_sum
    for r in recs:
        k = max(range(3), key=lambda i: r["p"][i])
        conf = r["p"][k]; hit = 1 if k == r["y"] else 0
        b = min(int(conf*bins), bins-1)
        buckets[b][0]+=1; buckets[b][1]+=hit; buckets[b][2]+=conf
    n = sum(v[0] for v in buckets.values())
    return sum(v[0]/n*abs(v[1]/v[0]-v[2]/v[0]) for v in buckets.values() if v[0])


def roi(recs):
    """Flat 1u on the blend's argmax pick at REAL closing odds (with vig)."""
    if not recs: return float("nan"), 0
    ret = 0.0; n = 0
    for r in recs:
        if "odds" not in r: continue
        k = max(range(3), key=lambda i: r["p"][i]); n += 1
        if k == r["y"]: ret += r["odds"][k]
    return ((ret-n)/n*100 if n else float("nan")), n


def acc(recs): return sum(1 for r in recs if max(range(3), key=lambda k: r["p"][k]) == r["y"]) / len(recs)
def hitrate_floor(recs, t):
    sel = [r for r in recs if max(r["p"]) >= t]
    if not sel: return None
    return acc(sel), len(sel)


def main():
    rows = load_rows()
    wodds = sum(1 for r in rows if r["odds"])
    print(f"# {len(rows)} club matches, {wodds} with odds, "
          f"{len(set(r['div'] for r in rows))} divisions, "
          f"{rows[0]['date']}..{rows[-1]['date']}")

    # incremental Elo (pre-match ratings stored) — leak-free
    elo = {}
    for r in rows:
        for team in (r["home"], r["away"]):
            elo.setdefault(team, ELO_INIT_T2 if r["tier2"] else ELO_INIT_T1)
        ra, rb = elo[r["home"]], elo[r["away"]]
        r["elo_h_pre"], r["elo_a_pre"] = ra, rb
        dr = ra - rb + ELO_HOME
        we = 1.0/(10**(-dr/400)+1)
        res = 1.0 if r["hg"]>r["ag"] else (0.5 if r["hg"]==r["ag"] else 0.0)
        delta = ELO_K*mov_mult(abs(r["hg"]-r["ag"]))*(res-we)
        elo[r["home"]] = ra+delta; elo[r["away"]] = rb-delta

    recs = []  # one per test match: blended probs + market + meta
    for ts in range(FIRST_TEST_SEASON, 2027):
        X, Y = [], []
        for r in rows:
            if season_of(r["date"]) < ts:
                d = r["elo_h_pre"]-r["elo_a_pre"]; X.append([d, abs(d)])
                Y.append(0 if r["hg"]>r["ag"] else (1 if r["hg"]==r["ag"] else 2))
        if len(X) < 2000: continue
        logit = LogisticRegression(max_iter=1000)
        logit.fit(np.array(X), np.array(Y)); order = list(logit.classes_)
        for r in rows:
            if season_of(r["date"]) != ts or not r["odds"]: continue
            y = 0 if r["hg"]>r["ag"] else (1 if r["hg"]==r["ag"] else 2)
            inv = [1/o for o in r["odds"]]; s = sum(inv); p_mkt = [x/s for x in inv]
            d = r["elo_h_pre"]-r["elo_a_pre"]
            pe = logit.predict_proba(np.array([[d, abs(d)]]))[0]
            p_elo = [float(pe[order.index(k)]) for k in range(3)]
            p_bl = [0.3*a+0.7*b for a, b in zip(p_elo, p_mkt)]
            recs.append({"y": y, "country": r["country"], "div": r["div"],
                         "tier2": r["tier2"], "odds": r["odds"], "p": p_bl,
                         "p_mkt": p_mkt, "p_elo": p_elo,
                         "derby": frozenset((r["home"], r["away"])) in DERBY_SET,
                         "phase": phase_of(r["date"]), "fav": fav_bucket(p_mkt)})
    print(f"# test sample: {len(recs)} matches (2017-18 -> now)\n")

    def line(label, sel):
        if len(sel) < 60:
            print(f"  {label:22s} n={len(sel):5d}  (too few)"); return
        bm = sum(brier3(r["p_mkt"], r["y"]) for r in sel)/len(sel)
        bb = sum(brier3(r["p"], r["y"]) for r in sel)/len(sel)
        be = sum(brier3(r["p_elo"], r["y"]) for r in sel)/len(sel)
        r_roi, nb = roi(sel)
        print(f"  {label:22s} n={len(sel):5d}  acc={acc(sel):.3f}  "
              f"Brier mkt/blend/elo={bm:.4f}/{bb:.4f}/{be:.4f}  "
              f"d(blend-mkt)={bb-bm:+.4f}  ECE={ece(sel):.3f}  ROI={r_roi:+.1f}%")

    print("=== OVERALL ==="); line("all", recs)
    print("\n=== BY FAVOURITE STRENGTH (market max prob) ===")
    for b in ["tossup(<45)","slight(45-55)","clear(55-70)","heavy(>70)"]:
        line(b, [r for r in recs if r["fav"] == b])
    print("\n=== DERBY vs NORMAL ===")
    line("derby", [r for r in recs if r["derby"]]); line("non-derby", [r for r in recs if not r["derby"]])
    print("\n=== BY SEASON PHASE ===")
    for ph in ["opening","mid","run-in"]: line(ph, [r for r in recs if r["phase"] == ph])
    print("\n=== BY TIER ===")
    line("top flight", [r for r in recs if not r["tier2"]]); line("second div", [r for r in recs if r["tier2"]])
    print("\n=== BY COUNTRY ===")
    for c in sorted(set(r["country"] for r in recs)): line(c, [r for r in recs if r["country"] == c])

    print("\n=== CONFIDENCE FLOOR (blend argmax) — overall ===")
    print("  floor | kept | acc")
    for t in [0.0,0.45,0.50,0.55,0.60,0.65,0.70,0.75,0.80]:
        hf = hitrate_floor(recs, t)
        if hf: print(f"  {t:4.2f}  | {hf[1]:5d} | {hf[0]:.3f}")

    print("\n=== OUTCOME BASE RATES (how matches resolve) by country ===")
    print("  country |  H%   D%   A%")
    for c in sorted(set(r["country"] for r in recs)):
        sel = [r for r in recs if r["country"] == c]; n = len(sel)
        h = sum(1 for r in sel if r["y"]==0)/n; dr_=sum(1 for r in sel if r["y"]==1)/n; a=sum(1 for r in sel if r["y"]==2)/n
        print(f"  {c:5s}   | {h*100:4.1f} {dr_*100:4.1f} {a*100:4.1f}   (n={n})")


if __name__ == "__main__":
    main()
