# LAB — 10-Year Segment/Pattern Backtest (club football vs market)

**Date:** 2026-06-08 · Michele-side analysis · reads local lab data, touches no served code.
**Script:** `C:\Users\bragh\am-lab\lab_segment_patterns_10y.py`
**Sample:** 61,090 club matches (2015-16 → 2025-26, 16 divisions / 11 countries, football-data.co.uk with closing odds). Walk-forward test sample: **49,808 matches** (2017-18 → now).
**Recipe (identical to `scripts/lab_backtest_clubs_10y.py`):** Elo K=20·MOV, +65 home; season-refit logit on [Δelo, |Δelo|]; blend 0.3·elo + 0.7·market; market = Pinnacle-closing de-vig. Leak-free (pre-match Elo stored, logit trained on prior seasons only).

## Headline findings

1. **We do NOT beat the closing market on probability quality — anywhere.** Blend Brier 0.5902 vs market 0.5884; market wins in every segment (Δ always positive). Flat-stake ROI on the blend's top pick at real closing odds ≈ **−2.6%** (≈ the bookmaker margin). Tiny positive ROIs (heavy favs +0.3%, POR +0.9%, TUR +1.7%) are noise within the margin, NOT edge. → Never claim "beat the book".

2. **Our real asset is calibration + selectivity.** ECE 0.008 overall (excellent). Accuracy is strongly monotonic with confidence:
   | floor | kept | acc |
   |---|---|---|
   | none | 49,808 | 51.2% |
   | ≥0.50 | 21,131 | 63.9% |
   | ≥0.60 | 10,493 | 72.7% |
   | ≥0.70 | 4,889 | 80.1% |
   | ≥0.80 | 1,600 | 86.8% |
   When the model says 70%+, it is right ~80% of the time, over 10 years. This generalizes the 2026-06-08 friendlies finding: **publish convinced picks, suppress flat picks.**

## Match-type patterns (with the stories, measured)
- **Favourite strength:** heavy(>70%) 80.6% acc · clear(55-70) 63.1% · slight(45-55) 49.5% · tossup(<45) 39.3%.
- **Derbies (n=735): less predictable AND less calibrated** — acc 48.0% vs 51.2%, ECE 0.033 (4× normal), ROI −6.0%. Form levels out under rivalry tension. → flag as high-variance, never a "confident pick".
- **Tier:** top flight 54.2% vs second division 46.1%. Lower divisions = more chaos.
- **Season phase:** run-in (Mar-May) 52.4% vs opening (Aug-Sep) 50.6% — late season marginally more predictable.
- **Per-league calibration (ECE):** best ENG 0.007, FRA 0.008, BEL 0.010; worst GRE 0.039, TUR 0.027, SCO 0.024, POR 0.022, ESP 0.021. → trust picks more in big-5, less in GRE/TUR.

## How matches resolve (base rates H/D/A) — "the physics" by league
- **Italy** most draw-heavy: 41.2/29.1/29.7 (catenaccio is in the numbers).
- **Spain** draw-heavy: 45.0/28.4/26.6.
- **Netherlands/Turkey/Portugal** strong home edge: ~45% home, ~24% draw.
→ In draw-heavy leagues the draw must be called more, and that fact is genuine insight for the "why".

## Actionable conclusions
1. **Edge = calibrated confidence, not beating the line.** Surface picks above a confidence floor; ~0.60 → 72.7% hit-rate at 21% volume; ~0.70 → 80% at 10% volume. Volume vs hit-rate is a product decision.
2. **Concentrate confident picks** on top-flight, big-league, non-derby, clear/heavy-favourite matches. De-emphasize derbies, second divisions, toss-ups, GRE/TUR.
3. **Respect the draw** in Italy/Spain.
4. **Honesty:** no monetary edge over closing line. Product = calibrated probabilities + selective high-confidence picks + human insight.

## Limitations / next
- This run is **domestic leagues only** (no cups/finals, no internationals/WC). For the launch focus (WC/friendlies) extend with `scripts/lab_backtest_10y.py` (internationals: friendly vs competitive vs neutral) and Transfermarkt `games.csv` (competition_type=cup, round=final/semi, club table positions, attendance) for true competition-type segmentation.
- Confidence floor must be fixed walk-forward (this curve is in-sample-aggregate guidance, directionally robust given n).

---

## ADDENDUM — Internationals by competition type (lab_backtest_10y.py, ~10k matches 2016→2026)

Raw prod-baseline accuracy & calibration by competition type:
| segment | n | acc | Brier | ECE |
|---|---|---|---|---|
| friendly | 2633 | 49.6% | 0.6093 | **0.0555** (worst) |
| qualifier | 3675 | **60.2%** | 0.5120 | 0.0708 |
| final tournament | 2759 | 51.8% | 0.5990 | 0.0376 |
| neutral (WC case) | 2636 | 50.4% | 0.6007 | 0.0234 |

Confidence buckets (internationals): maxp 0.33-0.45 → 40.2% · 0.45-0.60 → 53.7% · 0.60-0.75 → 68.2% · 0.75+ → **84.8%**. Same monotone law as clubs.

**v2-elo confirmed:** on neutral-venue (the WC case) elo2 acc 55.6% vs prod 50.4%, Brier 0.5576 vs 0.6007, and beats prod every single year 2016-2026. Validates the served v2 promotion.

Stories: **friendlies are the hardest AND worst-calibrated** (teams rotate/experiment) — exactly why the 2026-06-08 friendly misses happened, and why a confidence floor matters most there. **Qualifiers** are accurate (clear favourites vs minnows) but overconfident (ECE 0.07). **Final tournaments** are tighter (better teams, neutral).

## ADDENDUM — Cup vs league (Transfermarkt games.csv, 73.7k games 2015→)
Base rates H/D/A: domestic_league 44.1/25.1/30.8 · domestic_cup 45.5/**5.7**/48.8 · international_cup 47.3/20.8/31.9.
→ **Cups have almost no "draws"** (knockouts resolve to a winner via ET/pens) — the draw outcome is structurally different in cups; 1X2 handling must account for it.
Table-position gap predictability (league): close (<4 places) favourite-wins 43.3% (draws 32.2%) · mid (4-9) 59.3% · big gap (≥10) **77.4%** (draws 15.8%). Clean human pattern: small table gap → tight game / high draw chance; big gap → the better side usually wins.
