# Squad Condition Watch — player availability/condition factor: lab + live agent design

Date: 2026-06-07 · Author: michele-claude (lab analysis, read-only — no served code touched)
Mandate: Michele — "creiamo un agente che guarda costantemente lo stato psico-fisico dei
giocatori" + "vediamo come far salire ancora la % di precisione". Execution Andrea-side per
ownership split.
Companion to: `2026-06-07-wc-elo-model-lab.md` (v2 served), `2026-06-07-all-football-expansion-lab.md`.

Reproduce:
- `PYTHONUTF8=1 python scripts/lab_squad_condition_10y.py`
  (data auto-expected in `data/transfermarkt/` — 8 tables from dcaribou/transfermarkt-datasets,
  public R2 CDN `https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/<table>.csv.gz`:
  games, game_lineups, appearances, player_valuations, competitions, clubs, players, national_teams)

---

## 1. The hypothesis, made falsifiable

"Psycho-physical state of the players" is not directly observable from public data (no GPS,
no wellness questionnaires). What IS observable, pre-kickoff, and what the market is known to
price with delay, is the **composition and condition of the actual XI**:

| latent state | observable proxy | available… |
|---|---|---|
| injuries/suspensions/illness | missing names vs best-XI (lineup or callup diff) | T-1h (lineups), days before (news) |
| fatigue / load | minutes played last 14 days, days of rest | always (history) |
| rotation / coach priorities | XI market value vs club's best-11 value | T-1h |
| form/morale | (weakest proxy — value updates, recent results) | partial |

P3 discipline applies (travel/rest/altitude all FAILED the venue backtest on 2026-06-07):
**no factor enters the served path without a walk-forward backtest that promotes it.**

Nationals have no usable lineup history (Transfermarkt: 670 tournament games only), so the
statistical test runs on CLUBS — ~80k games 2013→2026 with real starting XIs, point-in-time
player market values (507k valuations) and per-player minutes (1.6M appearances). If the
factor adds signal over Elo on clubs, that is the evidence base for the live agent on
WC/friendlies, where the same quantities are observable but not backtestable.

## 2. Lab design (zero leakage)

Features per match — all strictly point-in-time (valuations looked up at last date ≤ match
date; roster window and minutes strictly past):

- `d_elo, |d_elo|` — the served v2 recipe (baseline to beat)
- `d_logxi` — log ratio of starting-XI total market value (static "money" signal — expected
  to overlap heavily with Elo)
- `d_avail` — **the Squad-Condition signal**: XI value ÷ value of club's best-11 among players
  seen in the last 365 days. < 1.0 = key players missing TODAY. Orthogonal to long-run strength.
- `d_cong` — congestion: avg minutes per XI player, last 14 days
- `d_rest` — days since previous club game (clipped 14)

Models: logit per feature-set, walk-forward by season (train < season, test = season),
2016-17 → 2025-26. Verdict criteria (same bar as the venue backtest): ΔBrier vs elo baseline,
coefficient direction/stability, and the subgroup where the factor must matter
(|d_avail| ≥ 0.10/0.15/0.20 — heavy-rotation games).

## 3. Lab verdict — PROMOTES (run of 2026-06-07)

55,183 games with full features (of 88,137 club games; skipped: 7,931 no lineup, 23,002 XI
under-valued — early seasons/minor comps —, 2,021 thin roster). OOS eval n=41,956.

| model | Brier | LL | acc | ΔBrier vs elo |
|---|---|---|---|---|
| elo (v2 recipe baseline) | 0.5802 | 0.9761 | 0.533 | — |
| value_only (XI value, no Elo) | 0.5799 | 0.9753 | 0.533 | −0.0004 |
| elo+value | 0.5755 | 0.9690 | 0.538 | −0.0047 |
| elo+avail | 0.5793 | 0.9748 | 0.534 | −0.0009 |
| elo+cond (avail+cong+rest) | 0.5793 | 0.9747 | 0.533 | −0.0010 |
| **elo+all** | **0.5752** | **0.9687** | **0.538** | **−0.0050** |

- **Wins 10/10 seasons** (delta −0.0027…−0.0075, never positive). ~2.5× the promotion-gate
  tolerance — comfortably promotes, though an order of magnitude smaller than the Elo jump
  itself (−0.0345): this is a *refinement* factor, not a new engine.
- **Where it matters most**: big availability gap |d_avail|≥0.20 → −0.0061; and above all
  **international_cup −0.0238, supercups/'other' −0.0301** — cross-pool, rotation-heavy
  contexts, i.e. exactly the WC/friendlies shape (the friendlies rotation problem the v2
  clamp only patches cosmetically).
- Decomposition is honest: the lion's share is **XI market value** (−0.0047); pure
  availability adds −0.0009 alone but keeps a clean, correctly-signed coefficient in the
  full model (last fold: +0.174 home-win / −0.156 away-win per availability-gap unit).
  Congestion/rest ≈ noise on clubs (and congestion is selection-confounded: regulars play
  more); drop them from any served feature set.
- Both deployable signals — XI value and availability — **require knowing who plays**:
  the Squad Condition Watch data layer is the prerequisite either way. Pre-lineup, expected-XI
  from callups+injury news (Track A diff) is the fallback; T-1h confirmed lineups sharpen it.
- value_only ≈ elo is itself notable: money alone carries as much signal as 10 years of Elo —
  but the two combined beat either, confirming partial orthogonality.

## 4. Live agent design — Squad Condition Watch (execution Andrea-side, gated)

Regardless of the model-feature verdict, the agent has a second, already-approved consumer:
the **why-layer and quality gates** (same pattern as P1 altitude / P2 heat: probability-neutral
context first, probabilities only behind the promotion gate).

Architecture (extends Track A, which already persists WC squads with append-only snapshots+diff):

1. **`core/squad_condition.py`** — pure functions:
   `xi_value(lineup, valuations)`, `availability_index(lineup, best11)`,
   `congestion(minutes_14d)`, `condition_report(team, date) -> dict` (fail-soft: None fields
   when sources missing, never blocks the pipeline).
2. **Data sources** (in cost order):
   - ESPN injuries/news per team — free, already in the stack (espn_client); cache 6h like squads
   - Track A `wc_squad_snapshots` diff — callup changes = availability events (LIVE already)
   - Transfermarkt weekly refresh (dcaribou CDN, free) — player values for XI/best-11 math
   - lineups T-1h: ESPN event summary (free) → late "confirmed XI" condition update
   - (AM-API-002, only if needed) api-football injuries endpoint for systematic coverage
3. **Storage**: `squad_condition_reports` append-only (team, date, xi_value, availability,
   congestion, missing_players jsonb, source, model_consumed bool) — same insert-on-change
   pattern as prediction_log.
4. **Consumers**:
   - **why-layer** (immediate, probability-neutral): "Spain rotates: XI worth 62% of best-11,
     3 starters rested" — premium-grade content, zero model risk → can ship pre-WC like P1/P2
   - **quality gate** (immediate): availability unknown → cap tier (like missing_context_fields)
   - **model adjustment** (ONLY if §3 promotes + promotion_gate green + APPROVE): availability
     delta as logit feature on the v2 path, coefficients frozen from the lab's last fold,
     shadow A/B first — identical chain to wc-elo-logit-v2's own promotion.
5. **Cadence**: piggyback on DataCollector cycles (zero extra HTTP for squads/ESPN, weekly CDN
   pull for values); no new daemon — "constantly watching" = every collector cycle.

Risks: lineup T-1h arrives after some odds move (the agent's edge window is news → lineup);
Transfermarkt values are club-oriented (national XI values still computable per player);
WC fatigue dynamics (short tournament, 3 host countries) differ from club season — coefficients
from clubs must NOT be transplanted blindly, only the *availability* feature shape.

Ownership: spec+lab michele-side (this doc) · review/merge/deploy Andrea · promotion gated
(#HARNESS-1) + human APPROVE in deploy-gate.
