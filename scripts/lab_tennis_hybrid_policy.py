"""
LAB — Tennis HYBRID gate policies, held-out 2023+ (follow-up to lab_tennis_segment_floors.py).

Idea: at the live uniform 62 the HI segments are strong (hi-grass .767, hi-nongrass .731)
while the LO segments sit at .69-.70 — and the live June slate is exactly lo-grass.
Quality>volume (Michele): keep 62 on hi, RAISE the lo floors. Evaluate a small grid of
hybrid policies on the same held-out 2023+ set.

Run: PYTHONUTF8=1 <clone>/.venv/Scripts/python.exe C:/Users/bragh/am-lab/lab_tennis_hybrid_policy.py
"""
from __future__ import annotations
from lab_tennis_segment_floors import load, exp, seg_of, K, SURF_W, OVER_W, FIRST_TEST_YEAR, HELD_OUT_YEAR
from collections import defaultdict

POLICIES = {
    "LIVE uniform62":               {"hi-grass": 0.62, "hi-nongrass": 0.62, "lo-grass": 0.62, "lo-nongrass": 0.62},
    "hi62 / lo64":                  {"hi-grass": 0.62, "hi-nongrass": 0.62, "lo-grass": 0.64, "lo-nongrass": 0.64},
    "hi62 / lo-ng64 / lo-grass66":  {"hi-grass": 0.62, "hi-nongrass": 0.62, "lo-grass": 0.66, "lo-nongrass": 0.64},
    "hi62 / lo-ng65 / lo-grass68":  {"hi-grass": 0.62, "hi-nongrass": 0.62, "lo-grass": 0.68, "lo-nongrass": 0.65},
    "hi60 / lo65 (volume swap)":    {"hi-grass": 0.60, "hi-nongrass": 0.60, "lo-grass": 0.65, "lo-nongrass": 0.65},
    "hi62 / lo-grass SUPPRESS":     {"hi-grass": 0.62, "hi-nongrass": 0.62, "lo-grass": 1.01, "lo-nongrass": 0.62},
}


def main():
    rows = load()
    overall = defaultdict(lambda: 1500.0)
    surf = defaultdict(lambda: defaultdict(lambda: 1500.0))
    for r in rows:
        s = r["surf"]
        ro_w, ro_l = overall[r["w"]], overall[r["l"]]
        rs_w, rs_l = surf[s][r["w"]], surf[s][r["l"]]
        p = exp(SURF_W * rs_w + OVER_W * ro_w, SURF_W * rs_l + OVER_W * ro_l)
        r["conf"], r["hit"] = max(p, 1 - p), p > 0.5
        eo = exp(ro_w, ro_l)
        overall[r["w"]] = ro_w + K * (1 - eo); overall[r["l"]] = ro_l - K * (1 - eo)
        es = exp(rs_w, rs_l)
        surf[s][r["w"]] = rs_w + K * (1 - es); surf[s][r["l"]] = rs_l - K * (1 - es)

    te = [r for r in rows if r["year"] >= HELD_OUT_YEAR]
    for r in te:
        r["seg"] = seg_of(r)
    n = len(te)
    print(f"# held-out 2023+ n={n}\n")
    print(f"{'policy':32s} | hit   | picks  (% matches) | June-slate cell (lo-grass): hit/picks")
    for name, fl in POLICIES.items():
        keep = [r for r in te if r["conf"] >= fl[r["seg"]]]
        lg = [r for r in keep if r["seg"] == "lo-grass"]
        acc = sum(r["hit"] for r in keep) / len(keep)
        lg_txt = f"{(sum(r['hit'] for r in lg)/len(lg)):.3f}/{len(lg)}" if lg else "—/0"
        print(f"{name:32s} | {acc:.3f} | {len(keep):5d}  ({100*len(keep)/n:4.1f}%)     | {lg_txt}")


if __name__ == "__main__":
    main()
