# v3c data API — read-only endpoints (F2)

Contracts: `lib/v3c/contracts.ts` (shared TS types). Formulas: `lib/v3c/*.ts`, tested in
`lib/v3c/v3c.test.ts` with fictitious data (no DB). SQL: `lib/v3c/queries.ts` (SELECT only).

**Access.** Every `/api/v3/*` route answers 404 unless `NEXT_PUBLIC_REDESIGN=1` or the caller is
admin (`lib/v3c/guard.ts`). Reason: the board exposes estimate and edge for every match, which
today is gated per plan (`lib/access-projection.ts`). The Free/Pro projection of v3 is F8 (gated).

**Coherence.** market% comes from one function (`market1x2`, proportional margin removal) in
board and line movement; the record and calibration read the same scored population, and the
football calibration buckets are asserted equal to the record reliability in the tests.

## 1. `GET /api/v3/board` — `v3.board.1`
Published football matches of the live window (same filters as `/api/v2/predictions`,
`source_table = match_predictions`), numbers from the latest `prediction_log` row:
`market_p` (de-vigged composite), `margin_removed`, `model_p` (raw), `estimate_p`
(served, = 0.3·model + 0.7·market), `edge_pp` (estimate − market, signed pp), `sealed_at`
(`pick_ledger.captured_at`), `book_prices` / `best_price` from FortunePlay and YBets only — live
BetConstruct feed first, last `partner_price_history` capture (≤150 min) if a feed is down.

Verified on real data (05/10 ~21:20 UTC): 214 matches, 172 with market, 214 sealed, 103 with
FortunePlay+YBets prices. Chicago Fire–Vancouver: market_p home 0.3276, edge −0.69 pp, margin
0.0175 — independent SQL on `prediction_log` gives 0.32759, −0.6866, 0.017532. Also verified on
prod: `prediction_log.market_p_*` = proportional de-vig of its odds (max diff 0 on 172 rows) and
`p = 0.3·model + 0.7·market` (0 mismatches).
Not verified / limits: tennis (214), friendly (11), nations (18) published rows are excluded —
no model/market split stored for them (counted in `coverage.excluded`). 42 matches have no
market: estimate = model, edge null. Some estimates are 2 days old (`estimate_as_of`).

## 2. `GET /api/v3/match/{id}/line-movement` — `v3.line_movement.1`
Every stored capture, no interpolation: 1X2 per feed book from `partner_price_history`, AH from
`ah_odds_history` (line for our home side). `coverage` per series: n points, first/last,
median and max interval.
Verified: Chicago Fire–Vancouver → FortunePlay 24 points (SQL count: 24), YBets 22, median
interval 120 min. Measured frequency: `partner_price_history` is written every 2 hours (runs at
:01 of even hours), since 11/09; `ah_odds_history` since 24/09, ~500 points per match but only
96 fixtures, mostly big European leagues — on our board AH is usually empty.
Not verified: no AH series checked end-to-end on a board match. The first point is the first
capture we hold, not the book's opening price.

## 3. `GET /api/v3/record` — `v3.record.1`
Only `pick_ledger` + `pick_settlement_current` (football, `football-v4-xg-model`, non-backfill).
Market at seal time = the `prediction_log` row whose served probabilities equal the sealed ones,
computed at or before the seal (verified: sealed p = log p, MAD 2.5e-16 on 2,179 rows).
Brier (3-outcome) estimate vs market on paired rows, paired difference with 95% CI, weekly
expected vs observed for the estimate's top outcome, reliability with Wilson 95% and
`limited_sample` under n=30. No ROI, CLV or hit-rate field exists (asserted by a test).

Verified (independent SQL): sealed 2,179 · scored 1,886 · paired 1,731 · Brier estimate 0.6129
vs market 0.6103 (SQL 0.612901 / 0.610333) · outcomes home 799 / draw 485 · orphans 11 (SQL 11).
Since 2026-06-14 (paper rows included: 373; first non-paper seal 2026-06-25).
Reading: difference +0.0026, CI [+0.0002, +0.0049] — the estimate is slightly LESS accurate than
the market on this sample. This is the number the record would publish.

## 4. `GET /api/v3/calibration` — `v3.calibration.1`
Football: 10 pp buckets on all three 1X2 probabilities of the record population, estimate and
(paired) market. Tennis: sealed probability of the picked player vs won, per model, status
`sufficient` only if a model has ≥3 buckets with n ≥ 30.
Verified: football bucket 0.6–0.7 n 205, observed 0.6976 (SQL 205 / 0.69756); tennis Elo v4
n 305 (SQL 305), bucket 0.6–0.7 observed 0.7576 (SQL 0.75758). Tennis status = sufficient
(partner-market-v1 n 2,172; Elo v4 n 305 with buckets 0.5/0.6/0.7 at n 205/66/31).
Not verified: whether `partner-market-v1` should be published as «our» tennis calibration — it
is the market-anchored served probability, not an independent model (decision for F6).
