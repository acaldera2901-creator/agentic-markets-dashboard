# All-football expansion lab — clubs 10y vs the market + WC2026 tournament simulator

Date: 2026-06-07 · Author: michele-claude (lab analysis, read-only — no served code touched)
Mandate: Michele — "integrare la nostra logica a tutto il calcio che esiste" (all leagues, cups,
divisions) + "probabilità statistica su chi vince la World Cup". Reference architecture: Opta
Power Rankings / The Analyst supercomputer. Execution Andrea-side per ownership split.
Companion to: `2026-06-07-wc-elo-model-lab.md` (internationals lab → wc-elo-logit-v2, approved
2026-06-07 in deploy-gate, shadow A/B).

Reproduce:
- `PYTHONUTF8=1 python scripts/lab_backtest_clubs_10y.py` (data auto-cached in
  `data/football_data_uk_10y/` — 176 CSVs from football-data.co.uk, 11 seasons × 16 divisions)
- `PYTHONUTF8=1 python scripts/lab_wc_simulator.py 100000 60` (full tournament Monte Carlo)

---

## 1. Clubs, 10 years, vs the MARKET (61,090 matches, 11 countries, 16 divisions)

Walk-forward by season 2017-18 → 2025-26; eval on the 47,871 OOS matches with odds
(closing Pinnacle preferred, fallback chain). For the first time the models are scored
against real bookmaker prices.

| model | Brier | LL | acc | note |
|---|---|---|---|---|
| **market** (closing de-vig) | **0.5875** | 0.9850 | 0.516 | the ceiling, as literature predicts |
| goalrate (prod-WC recipe) | 0.6235 | 1.0379 | 0.464 | confirms the strength-signal flaw on clubs too |
| **elo_logit** (same recipe as v2) | 0.6023 | 1.0068 | 0.499 | within 0.015 of market, stable in ALL 11 countries (+0.010..+0.019) |
| blend 0.3·elo+0.7·market | 0.5893 | 0.9877 | 0.513 | ≈market |

Per tier: top flights market 0.5668 / elo 0.5819 · second divisions market 0.6239 / elo 0.6381
(everything is harder in tier 2: 28.7% draws; no, the softer-market hypothesis does NOT show an
edge at this resolution — the market stays ahead everywhere).

**Conclusions for the product**
1. ONE recipe scales to all football: per-pool club Elo (K=20·MOV, +65 home in updates, tier-2
   init 1400) → logit [Δelo, |Δelo|] → isotonic → market blend. Same architecture as the
   approved wc-elo-logit-v2 — one engine, every competition.
2. On clubs the market is the ceiling: the model's job is coverage (matches without odds,
   lower divisions), coherence (same probability language everywhere) and the why-layer —
   not beating closing prices.
3. The goalrate recipe should not be extended anywhere; elo_logit dominates it by ~0.021
   Brier on clubs, mirroring the internationals result (−0.035).

## 2. Architecture for "tutto il calcio" (Opta-style, from research with sources)

Opta Power Rankings: ~13,500 clubs, 413 leagues, 183 countries, **hierarchical Elo**
(team→league→country→confederation), MOV-damped, daily; cross-league anchoring happens ONLY
through inter-group matches (continental cups); tournament sims = 25,000 Monte Carlo runs.
ClubElo: K=20, home advantage, inter-league adjustments, **free no-key CSV API**
(`api.clubelo.com/YYYY-MM-DD`, `/Fixtures` even ships ready match probabilities).

Recommended stack (build order):
1. **Phase 1 (now, free)**: extend the v2 Elo engine to clubs on football-data.co.uk's ~26
   countries (the lab already does it: `lab_backtest_clubs_10y.py`); ClubElo API as cross-league
   anchor/validation for European top flights. Covers the major product surface.
2. **Phase 2 (paid, decision AM-API-002?)**: api-football as world backbone (>1,200
   competitions — fixtures/results for everything else); our Odds API 100K plan already covers
   live odds for majors. Rating pools per country + continental-cup anchoring like Opta.
3. **Phase 3**: per-competition reliability scoring (the model must know where to trust itself
   less — second divisions, exotic leagues), publication tiers reuse the existing quality gates.

Risks (from research): cross-league anchoring is weak where inter-league matches are rare
(shrink to league priors); heterogeneous data quality ("all football" inherits the worst
source); paid-source dependency (mitigate with source abstraction + local caching).

## 3. WC2026 winner probabilities — our first tournament-level product number

`scripts/lab_wc_simulator.py`: simulates the REAL 104-match tournament (12 groups, best-thirds
R32 via candidate-set backtracking, ESPN-id bracket chaining, +100 Elo host bonus in own-country
venues, KO draw-collapse) with the lab v2 match model. 100,000 sims, Elo as of 2026-06-07,
team-strength noise σ=60 (point-Elo compounds into overconfidence over 7 rounds — 538-style fix).

| team | WIN% (σ=60) | WIN% (raw) | Opta (25k sims) | Groll RF | market antepost ~ |
|---|---|---|---|---|---|
| Spain | **26.7** | 30.1 | 16.1 | 14.5 | ~18 |
| Argentina | **18.3** | 19.9 | 10.4 | — | ~11 |
| France | **13.6** | 14.6 | 13.0 | 12.4 | ~15 |
| England | 6.0 | 6.0 | 11.2 | 12.4 | ~14 |
| Brazil | 5.1 | 4.9 | 6.6 | — | ~11 |
| Colombia | 4.3 | 3.9 | 2.1 | — | — |
| Ecuador | 3.2 | 2.9 | — | — | — |
| Portugal | 3.1 | 2.7 | 7.0 | — | ~11 |
| Netherlands | 2.8 | 2.6 | 3.6 | — | — |
| Germany | 2.2 | 1.9 | 5.1 | 11.2 | — |

Reading: same favorite set as Opta/Groll/market (Spain clear #1 — consensus), but our pure-Elo
sim concentrates more probability on top ratings (Spain 26.7 vs Opta 16.1) and likes CONMEBOL
form (Argentina, Colombia, Ecuador) while England/Portugal/Germany rate lower than the market
view. Both deviations have one root: **no market blend at tournament level yet**. Opta blends
bookmaker odds into the supercomputer; the production version should do the same — de-vig the
outright antepost market and blend (the same α-philosophy as match level), or at minimum
publish "model view vs market view" side by side, which is itself a premium-grade content
piece.

Known sim approximations (flagged): bracket "Round of 32 N" numbering assumed = ESPN event-id
order; group tiebreaks pts→GD→GF→random (no head-to-head/fair-play); scorelines for GD drawn
from coarse empirical tables; no squad-news/injury layer; ESPN feed quirks handled (2 MD3
games mislabelled round32; R32 #16 mislabelled round16).

## 4. Proposed next steps (Andrea's call, post-review)

1. **Ship the WC winner table as content** (paper tier / The Analyst-style article surface):
   it is ready, reproducible, and the WC starts in 4 days. Optionally blended with antepost.
2. **Clubs v2 engine** behind the same shadow-A/B harness as wc-elo-logit-v2 once WC settles —
   one engine, all football, market-anchored.
3. **Data acquisitions**: api-football for world coverage (cost decision), ClubElo as free
   anchor, historical antepost odds for tournament-blend calibration.
