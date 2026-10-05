# v3c data API — read-only endpoints (F2)

Contracts: `lib/v3c/contracts.ts` (shared TS types). Formulas: `lib/v3c/*.ts`, tested in
`lib/v3c/v3c.test.ts` with fictitious data (no DB). SQL: `lib/v3c/queries.ts` (SELECT only).

**Access.** Every `/api/v3/*` route answers 404 unless `NEXT_PUBLIC_REDESIGN=1` or the caller is
admin (`lib/v3c/guard.ts`). Reason: the board exposes estimate and edge for every match, which
today is gated per plan (`lib/access-projection.ts`). The Free/Pro projection of v3 is F8 (gated).

**Coherence.** market% comes from one function (`market1x2`, proportional margin removal) in
board and line movement; the record and calibration read the same scored population, and the
football calibration buckets are asserted equal to the record reliability in the tests.

## 1. `GET /api/v3/board` — `v3.board.2` (tennis in `tennis[]`, §5)
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
Not verified / limits: friendly (11), nations (18) published rows are excluded —
no model/market split stored for them (counted in `coverage.excluded`). Tennis: §5. 42 matches have no
market: estimate = model, edge null. Some estimates are 2 days old (`estimate_as_of`).

## 2. `GET /api/v3/match/{id}/line-movement` — `v3.line_movement.2` (tennis ids → `ML` series, §5)
Every stored capture, no interpolation: 1X2 per feed book from `partner_price_history`, AH from
`ah_odds_history` (line for our home side). `coverage` per series: n points, first/last,
median and max interval.
Verified: Chicago Fire–Vancouver → FortunePlay 24 points (SQL count: 24), YBets 22, median
interval 120 min. Measured frequency: `partner_price_history` is written every 2 hours (runs at
:01 of even hours), since 11/09; `ah_odds_history` since 24/09, ~500 points per match but only
96 fixtures, mostly big European leagues — on our board AH is usually empty.
Not verified: no AH series checked end-to-end on a board match. The first point is the first
capture we hold, not the book's opening price.

## 3. `GET /api/v3/record` — `v3.record.2` (tennis groups in `tennis.groups`, §5)
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

## 4. `GET /api/v3/calibration` — `v3.calibration.2`
Football: 10 pp buckets on all three 1X2 probabilities of the record population, estimate and
(paired) market. Tennis: sealed probability of the picked player vs won, per model, status
`sufficient` only if a model has ≥3 buckets with n ≥ 30.
Verified: football bucket 0.6–0.7 n 205, observed 0.6976 (SQL 205 / 0.69756).
**Correction (v3c-tennis, 05/10):** the v1 figure «tennis Elo v4 n 305, status sufficient» was wrong
in substance: 71 of those 305 sealed numbers are the tempered MARKET (Elo rows that had a price),
and partner-market-v1 is the market too. v2 groups tennis by what the sealed number is (§5) and
judges `status` on our model groups only → today **insufficient** (Elo n 234, only 2 buckets ≥ 30).

## 5. Tennis (branch `betredge/v3c-tennis`)

**What is stored (prod, SELECT only, 05/10 ~22 UTC).**
| Source | What | n | Since |
|---|---|---|---|
| `tennis_predictions` | ONE row per match (upsert, no history): served p1/p2, odds pair, edge, model_version | Elo v4 3,289 · partner-market-v1 5,202 · Elo v3 120 | Elo v4 04/06, partner 11/09 |
| `pick_ledger` (non-backfill) | served p of the pick, whole %; pick-side price only | Elo v4 384 · partner 2,544 | 22/09 |
| `pick_settlement_current` | won/lost/void | Elo v4 305 won/lost · partner 2,172 | — |
| `prediction_log` (`tennis-market-blend-shadow`) | raw Elo (model_p) + de-vigged market + served, per change, **client clock** | 42,742 rows / 3,154 matches | 09/06 |
| `partner_price_history` (sport tennis) | FortunePlay 33,959 / YBets 21,654 captures, every 2 h, DB clock | 5,333 / 3,441 matches | 11/09 |
| `odds_snapshots` | not used: 16 M rows, unindexed on source (query timed out) | — | — |

**What the sealed number IS** (`probability_kind`, measured, not assumed):
- `partner-market-v1`: de-vigged partner price × temperature 1.68. No model of ours exists for these players.
- Elo v4 **with** a price at serve time: de-vigged market × 1.68 (#TENNIS-MARKET-ANCHOR-0821) —
  77/77 sealed rows equal round(100·τ(market)). Not the Elo, despite the model_version.
- Elo v4 **without** a price: Elo × 1.68 — 297/307 sealed rows equal round(100·τ(raw Elo of the
  shadow log)), the other 10 are shadow lag. Note: τ is applied here too, although the adapter
  comment says it is for market-anchored rows only (`probabilitaMostrata(p, edge != null)` — an
  Elo row without a market has edge null). Reported, not changed.

**Board (`tennis[]`).** Per side: `market_p` (de-vigged stored pair, `market_source.as_of`),
`model_p` (raw Elo, latest shadow snapshot; null for partner rows), `estimate_p` (served, same
function as the adapter), `sealed_p`, `book_prices` (feed books, live first). `gap_pp` = sealed
Elo − de-vigged FortunePlay/YBets price captured ≤150 min **before** the seal (`gap_market`); only
for sealed rows of our model. Everything else null with `gap_null_reason` (market against itself,
Elo anchored to the price, not sealed, no price before the seal). The raw Elo is never subtracted
from the market: it is not sealed.
Verified on the live window (213 tennis rows): 182 market_tempered / 31 model_tempered / 0
model, 182 with market, 55 with raw Elo, 213 sealed — independent SQL: same five numbers.
Spot checks vs SQL: Snigur–Andreeva market_p 0.1638 (SQL 0.163842), margin 0.0310 (0.030988),
estimate 0.2748 (τ in SQL 0.274807), model_p 0.1955, sealed 0.28; Aoyama/Liang market_p 0.4405
(0.440541), margin 0.0966 (0.096589), estimate 0.4645 (0.464475); Buyukakcay estimate 0.5239
(0.523902), model_p 0.5401. Board gap today: 52 sealed Elo rows on the board, **0** with a feed
price before their seal (SQL 0) — the price arrives after the seal.

**Line movement.** `match/{tennis id}/line-movement` → one `ML` series per feed book from
`partner_price_history`, oriented to our player1/player2. Keys checked: the three matches above
have 18/18/14 captures per book.

**Record (`tennis.groups`).** One group per model_version × kind, binary Brier of the sealed p,
expected vs observed wins (Wilson 95%), `limited_sample` under n 30 (scored or paired). Our model
groups are paired with the feed price before the seal: `n_paired`, `brier_paired` vs
`brier_market`, paired difference with CI. Verified vs independent SQL (2,928 sealed rows):
- Elo v4 tempered (ours): sealed 307, scored 234, expected 133.51 vs observed 133, Brier 0.2319
  (SQL 0.231874); paired **n 77**: Brier 0.2418 vs market 0.2113, difference **+0.0305**, CI
  [+0.0018, +0.0591] (SQL 77 / 0.241765 / 0.211311 / 0.030454) — on this small sample our Elo is
  LESS accurate than the book.
- Elo v4 anchored (market, n 71) and partner-market-v1 (market, n 2,172): Brier 0.2193 / 0.2005,
  not paired (they are the market). partner: expected 1,343.43 vs observed 1,535 — the tempered
  market price under-states the favourite by ~8.8 pp on average.

**Calibration.** Same groups; status judged on our model groups only → insufficient (Elo
buckets 0.5–0.6 n 173 observed 0.4913; 0.6–0.7 n 43 observed 0.7209; 0.7–0.8 n 16).

**Not verified.** The routes were not run over HTTP: the builders ran on the rows returned by the
same SQL (via the Supabase connector, read-only) and were checked against independent SQL. A
real `GET` (preview with `NEXT_PUBLIC_REDESIGN=1`) is still to do. Name orientation of feed
prices relies on `canonicalPlayerKey`; on the 307 sealed Elo rows TS keys = SQL keys (307/307).

**Missing → PROPOSAL** `docs/v3c-tennis-proposal.md` (not executed).
