"""
LAB — Tennis SEGMENT-AWARE confidence floors (walk-forward, ATP+WTA 2016-2026).

Question (Michele 2026-06-11): live tennis hit-rate is 58.1% even with the uniform
floor 62 — the weak segment (low-tier grass swing) drags it down. Quantify a
segment-aware gate: per-segment floors chosen on train (2018-2022), validated on
2023+ held-out, vs the live uniform 62.

Segments = tier x surface:
  hi = G(Slam), M(Masters), F(Finals), PM/P/1000 (WTA Premier+), O(lympics)
  lo = A (ATP 250/500), I (WTA International), D (Davis/BJK), everything else
  x  Grass / non-Grass  (the June grass swing is the live pain)

Replicates the served EloSurface (0.7 surface + 0.3 overall, K=32), walk-forward,
same recipe as lab_tennis_10y.py. Confidence = max(p, 1-p) (conf_score = 100x).

Run: PYTHONUTF8=1 <clone>/.venv/Scripts/python.exe C:/Users/bragh/am-lab/lab_tennis_segment_floors.py
"""
from __future__ import annotations
import csv, io
from collections import defaultdict
from pathlib import Path

DATA = Path(r"C:\Users\bragh\am-lab\tennis10y")
K = 32.0
SURF_W, OVER_W = 0.7, 0.3
FIRST_TEST_YEAR = 2018
HELD_OUT_YEAR = 2023          # train = 2018-2022, validate = 2023+
LIVE_FLOOR = 0.62             # SURFACE_FLOOR_TENNIS=62 in prod
TARGETS = (0.70, 0.72)        # train hit-rate targets for per-segment floor pick
GRID = [round(0.55 + i * 0.01, 2) for i in range(26)]   # 0.55..0.80
MIN_TRAIN_KEPT = 200          # stability: a floor must keep >=200 train matches
SURFACES = {"Hard", "Clay", "Grass", "Carpet"}
HI_LEVELS = {"G", "M", "F", "PM", "P", "O", "1000"}


def load():
    rows = []
    for f in sorted(DATA.glob("*.csv")):
        tour = "atp" if f.stem.startswith("atp") else "wta"
        with io.open(f, encoding="utf-8", errors="replace") as fh:
            for r in csv.DictReader(fh):
                w, l = (r.get("winner_name") or "").strip(), (r.get("loser_name") or "").strip()
                if not w or not l:
                    continue
                d = (r.get("tourney_date") or "").strip()
                if len(d) != 8 or not d.isdigit():
                    continue
                surf = (r.get("surface") or "").strip().title()
                if surf not in SURFACES:
                    surf = "Hard"
                rows.append({
                    "date": d, "year": int(d[:4]), "tour": tour, "surf": surf,
                    "level": (r.get("tourney_level") or "?").strip().upper(),
                    "w": f"{tour}:{w}", "l": f"{tour}:{l}",
                    "mnum": int(float(r.get("match_num") or 0)),
                })
    rows.sort(key=lambda r: (r["date"], r["mnum"]))
    return rows


def exp(ra, rb):
    return 1.0 / (1.0 + 10 ** ((rb - ra) / 400.0))


def seg_of(r):
    tier = "hi" if r["level"] in HI_LEVELS else "lo"
    return f"{tier}-{'grass' if r['surf'] == 'Grass' else 'nongrass'}"


def main():
    rows = load()
    print(f"# {len(rows)} matches {rows[0]['date']}..{rows[-1]['date']}")
    lv = defaultdict(int)
    for r in rows:
        lv[r["level"]] += 1
    print("# levels:", dict(sorted(lv.items(), key=lambda kv: -kv[1])))

    overall = defaultdict(lambda: 1500.0)
    surf = defaultdict(lambda: defaultdict(lambda: 1500.0))
    for r in rows:
        s = r["surf"]
        ro_w, ro_l = overall[r["w"]], overall[r["l"]]
        rs_w, rs_l = surf[s][r["w"]], surf[s][r["l"]]
        rw = SURF_W * rs_w + OVER_W * ro_w
        rl = SURF_W * rs_l + OVER_W * ro_l
        p = exp(rw, rl)                       # served-recipe P(winner)
        r["p"] = p
        r["conf"] = max(p, 1.0 - p)
        r["hit"] = p > 0.5
        eo = exp(ro_w, ro_l)
        overall[r["w"]] = ro_w + K * (1 - eo); overall[r["l"]] = ro_l - K * (1 - eo)
        es = exp(rs_w, rs_l)
        surf[s][r["w"]] = rs_w + K * (1 - es); surf[s][r["l"]] = rs_l - K * (1 - es)

    test = [r for r in rows if r["year"] >= FIRST_TEST_YEAR]
    for r in test:
        r["seg"] = seg_of(r)
    tr = [r for r in test if r["year"] < HELD_OUT_YEAR]
    te = [r for r in test if r["year"] >= HELD_OUT_YEAR]
    segs = sorted(set(r["seg"] for r in test))
    print(f"# train 2018-2022 n={len(tr)}  held-out 2023+ n={len(te)}  segments={segs}\n")

    def stats(sel, floor):
        k = [r for r in sel if r["conf"] >= floor]
        if not k:
            return None
        return sum(r["hit"] for r in k) / len(k), len(k)

    # ── diagnostic: why uniform 62 leaks — per-segment held-out at the live floor ──
    print(f"=== DIAGNOSTIC — held-out 2023+ at the LIVE uniform floor {LIVE_FLOOR:.2f} ===")
    print("  segment       |  all-matches acc |  acc@62  kept@62 (% of seg)")
    for sg in segs:
        sel = [r for r in te if r["seg"] == sg]
        base = sum(r["hit"] for r in sel) / len(sel)
        st = stats(sel, LIVE_FLOOR)
        a, n = st if st else (float("nan"), 0)
        print(f"  {sg:13s} | n={len(sel):5d} {base:.3f}   |  {a:.3f}   {n:5d} ({100*n/len(sel):4.1f}%)")

    # ── per-segment floor selection on TRAIN, validated held-out ──
    for target in TARGETS:
        print(f"\n=== SEGMENT-AWARE floors — train target >= {target:.2f} (chosen 2018-22, validated 2023+) ===")
        floors = {}
        for sg in segs:
            sel = [r for r in tr if r["seg"] == sg]
            pick = None
            for f in GRID:
                st = stats(sel, f)
                if st and st[1] >= MIN_TRAIN_KEPT and st[0] >= target:
                    pick = f
                    break
            floors[sg] = pick   # None => suppress segment
        print("  segment       | floor | TRAIN acc/kept% | HELD-OUT acc/kept%")
        tot_kept, tot_hit = 0, 0
        for sg in segs:
            f = floors[sg]
            sel_tr = [r for r in tr if r["seg"] == sg]
            sel_te = [r for r in te if r["seg"] == sg]
            if f is None:
                print(f"  {sg:13s} | SUPPRESS (no floor reaches {target:.2f} on train)")
                continue
            st_tr, st_te = stats(sel_tr, f), stats(sel_te, f)
            a_te, n_te = st_te if st_te else (float("nan"), 0)
            tot_kept += n_te; tot_hit += sum(r["hit"] for r in sel_te if r["conf"] >= f)
            print(f"  {sg:13s} | {f:.2f}  | {st_tr[0]:.3f} {100*st_tr[1]/len(sel_tr):5.1f}%   | "
                  f"{a_te:.3f} {100*n_te/len(sel_te):5.1f}%  (n={n_te})")
        if tot_kept:
            print(f"  -> POLICY TOTAL held-out: acc={tot_hit/tot_kept:.3f}  "
                  f"picks={tot_kept} ({100*tot_kept/len(te):.1f}% of matches)")

    # ── live uniform-62 policy total for comparison ──
    st = stats(te, LIVE_FLOOR)
    print(f"\n=== LIVE POLICY (uniform {LIVE_FLOOR:.2f}) held-out total: "
          f"acc={st[0]:.3f}  picks={st[1]} ({100*st[1]/len(te):.1f}% of matches) ===")

    # uniform-62 but with lo-grass suppressed (cheapest possible change)
    keep = [r for r in te if r["conf"] >= LIVE_FLOOR and r["seg"] != "lo-grass"]
    a = sum(r["hit"] for r in keep) / len(keep)
    print(f"=== uniform 62 + SUPPRESS lo-grass: acc={a:.3f}  picks={len(keep)} "
          f"({100*len(keep)/len(te):.1f}% of matches) ===")


if __name__ == "__main__":
    main()
