# PROPOSAL — seal model and market separately for tennis (v3c-tennis)

**Status: PROPOSAL, not executed.** Serve OK da: **Andrea** (touches the prod DB schema — shared
with staging — and the tennis writer). Owner esecuzione: programmatore-andrea on a branch + PR.
Measures behind every claim: `docs/v3c-data-api.md` §5 (prod, SELECT only, 05/10).

## Task
Make «all the tennis data» on the v3 board real: for every sealed tennis match, our model's
probability and the market's must be sealed **side by side, independently, before kickoff**, so
gap, paired Brier and calibration of OUR model can be published on the whole sample — not only on
the 77 rows where a partner price happened to be captured before the seal.

## Why it is missing today (measured)
1. `tennis_predictions` keeps one row per match and overwrites `p1/p2`: when a price exists the
   served `p1/p2` ARE the de-vigged market (#TENNIS-MARKET-ANCHOR-0821) and the raw Elo is lost.
   It survives only in `prediction_log` (shadow, client clock, not append-only by grant).
2. `pick_ledger` seals one number — the served probability of the pick, whole %, after τ=1.68 —
   and only the pick-side price. For 77/77 Elo rows with a price that number is the market.
3. So for 2,544 + 77 sealed rows there is no model at all at seal time, and for 307 there is a
   model but no market sealed with it (77 recoverable from `partner_price_history`).

## Approach chosen
Additive and nullable only. No backfill (the ledger is insert-only by REVOKE, and back-dating a
seal would be exactly the look-ahead the ledger exists to prevent). Records start «from day X».

## COSA CAMBIERÀ ESATTAMENTE

### 1. Migration `supabase/migrations/20261007000000_tennis_model_market_seal.sql`
```sql
-- tennis_predictions: keep the raw Elo next to the served pair
ALTER TABLE tennis_predictions
  ADD COLUMN IF NOT EXISTS model_p1 double precision,
  ADD COLUMN IF NOT EXISTS model_p2 double precision;

-- pick_ledger: model and market sealed separately (NULL for football and old rows)
ALTER TABLE pick_ledger
  ADD COLUMN IF NOT EXISTS model_p_home        double precision,  -- raw model of OUR model, null = no model
  ADD COLUMN IF NOT EXISTS model_p_away        double precision,
  ADD COLUMN IF NOT EXISTS market_p_home       double precision,  -- de-vigged, proportional
  ADD COLUMN IF NOT EXISTS market_p_away       double precision,
  ADD COLUMN IF NOT EXISTS market_odds_home    double precision,  -- the pair it came from
  ADD COLUMN IF NOT EXISTS market_odds_away    double precision,
  ADD COLUMN IF NOT EXISTS market_source       text,              -- 'tennis_fixtures:<book>' | 'partner:<book>'
  ADD COLUMN IF NOT EXISTS served_p_exact      double precision,  -- served p of the pick, unrounded
  ADD COLUMN IF NOT EXISTS probability_kind    text;              -- model | model_tempered | market_tempered
```
Metadata-only `ADD COLUMN` (no default, nullable): no table rewrite, no long lock. The REVOKE on
UPDATE/DELETE is untouched.

### 2. `agents/tennis_model_agent.py`
- `_score_fixture`: return `model_p1 = round(p1_raw, 4)`, `model_p2 = round(p2_raw, 4)` (the
  pre-anchor Elo that today lives only in `_p1_raw`).
- `_PREDICTION_COLS`: add `model_p1`, `model_p2`.
- Prima → dopo: `tennis_predictions.p1/p2` unchanged (served); new columns carry the Elo.

### 3. `lib/partner-fixtures.ts`
- Insert `model_p1/model_p2 = NULL` explicitly (no model for partner players). No other change.

### 4. `lib/tennis-adapter.ts` — the `pick_ledger` INSERT
Read `tennis_predictions` (`model_p1/2`, `odds_p1/2`, `edge`, `model_version`,
`feature_snapshot->>'odds_bookmaker'`) in the same statement and write:
- `model_p_home/away` = `model_p1/2` (null for partner-market-v1);
- `market_p_home/away` = proportional de-vig of `odds_p1/2` when both > 1, else null;
- `market_odds_home/away`, `market_source`;
- `served_p_exact` = the unrounded `probabilitaMostrata` value of the pick;
- `probability_kind` = the same rule as `servedTennisKind` (lib/v3c/tennis.ts).
The existing columns (`p_home`, `confidence`, `odds`, …) keep their exact current values.

### 5. `lib/v3c` (read side, after 48 h of data)
- `ledgerTennisKind`: prefer `probability_kind` when not null (fallback = today's rule).
- Gap / paired Brier: use sealed `model_p_*` vs sealed `market_p_*` when both present; keep the
  `partner_price_history` pairing for older rows. Contract fields already exist (`gap_pp`,
  `n_paired`, `brier_market`) — no contract break.

## Ordine di esecuzione (vincolante)
1. Migration (step 1) **before** any writer change. The Python writer posts through PostgREST:
   a payload key without its column makes PostgREST reject the WHOLE batch → the tennis board
   would starve silently (already happened: #ELO-FIX-1, «empty Best Bets» 05/06).
2. Deploy Python agent (step 2) and `partner-fixtures` (step 3).
3. Deploy adapter (step 4). The ledger INSERT is inside a non-fatal try/catch: a bug there loses
   seals, it does not break the board — the verification below must catch it within one cycle.
4. After ≥48 h, read side (step 5).

## Reversibilità / rollback
- Code: revert the PR(s); writers go back to not filling the columns (they are nullable).
- Schema: `ALTER TABLE … DROP COLUMN …` for the ten columns — only after the code revert is live.
  Sealed values written in the meantime are lost on DROP: export them first
  (`COPY (SELECT id, model_p_home, … FROM pick_ledger WHERE probability_kind IS NOT NULL) TO STDOUT`).
- No existing value is modified at any step.

## Blast radius
- `pick_ledger` is read by football record/history, track record, settlement: new nullable
  columns are invisible to every `SELECT col, …` (checked: no `SELECT *` consumer is needed for the
  plan; to re-check with `grep -rn "FROM pick_ledger"` before executing).
- `tennis_predictions` is read by the adapter, `/api/tennis`, settlement: additive columns only.
- Prod and staging share the same Supabase: the migration hits both at once.
- Football is untouched (columns stay NULL).

## Piano di verifica
1. After migration: `SELECT column_name FROM information_schema.columns WHERE table_name IN ('pick_ledger','tennis_predictions') AND column_name LIKE ANY('{model_p%,market_%,served_p_exact,probability_kind}')` → 10 rows.
2. After step 2, one cycle: `SELECT count(*) FILTER (WHERE model_p1 IS NOT NULL) FROM tennis_predictions WHERE model_version='elo_surface_v4_features_odds' AND computed_at > now()-interval '1 hour'` > 0, and
   `model_p1` = the shadow `prediction_log.model_p_home` of the same cycle (|diff| < 1e-4).
3. Board still populated: tennis rows in the live window ≥ the count before deploy (today 213).
4. After step 4, 24 h: new tennis ledger rows have `probability_kind` 100% non-null; for
   `market_tempered` rows round(100·τ(market_p of pick)) = confidence; for `model_tempered`
   round(100·τ(model_p of pick)) = confidence (today's checks: 77/77 and 297/307).
5. vitest `lib/v3c` green with the new read path; `/api/v3/board` on a preview: `with_gap` > 0 on
   Elo rows that had a price at seal.

## Cosa NON risolve (da dire prima, non dopo)
- **partner-market-v1 (2,544 sealed, 182 of 213 board rows today) resta senza modello.** The Elo
  agent scores only `tennis_fixtures`; partner players are not scored. A gap for them needs our
  model to score partner fixtures — a separate product decision (coverage of the Elo on
  Challenger/ITF/UTR players is unmeasured), not a schema change.
- The τ=1.68 applied to Elo rows **without** a market (see data-api §5) is unchanged here; whether
  it should apply is a calibration decision for ml-engineer-agentic.
- Elo rows served «without market» while FortunePlay/YBets do quote them (e.g. Buyukakcay–
  Klimovicova, 14 captures per book): feeding those prices to the Elo row would switch it to
  market-anchored, i.e. change what users see — product decision, not in this proposal.
