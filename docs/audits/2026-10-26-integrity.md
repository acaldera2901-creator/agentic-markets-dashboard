# Integrity audit — 26 October 2026

This change reconciles public descriptions with implemented behavior and fixes reproduced ingestion, settlement, provenance and freshness failures. It is not a certification of every historical prediction or payment.

## Reproduced production evidence

- The tennis settlement cron returned48HTTP500responses in the bounded24-hour log sample. Its500-ID source lookup generated36,334encoded characters and returned Bad Request. The same identifiers read in50-ID batches succeeded. No production settlement was invoked during diagnosis.
- Among7,535candidate verified, settled tennis rows before UI deduplication,1,641had no valid forward seal and190had published_at at/after starts_at. These are not headline counts. Historical results were not selectively rewritten.
-263tennis source rows had market provenance metadata under an Elo model-version name. Source classification must use persisted metadata, not the version name alone.
-51future football rows were older than six hours. A recent odds-less calculation intentionally preserves an older priced record. UI freshness must therefore use each record's timestamp, not the newest timestamp across the board.
-DataHub fixture writes failed because the payload included provider, absent from fixtures_enriched. The table was empty at inspection. providers_used is the existing canonical provenance field.
-The leaderboard had zero entries and no discovered automatic database writer. A test reproduced250% from a zero-win bets sample mixed with unrelated leaderboard wins.

## Implemented behavior

- Form uses overall recent matches and the union of the six already-fetched football-data histories; other leagues use their available league histories. This is not universal all-competition coverage.
- The refreshed training snapshot and partial-refresh/freshness checks incorporate the pending Claude work. The original backfill SQL was inconsistent with the cross-competition implementation and is not used.
- Odds requests use supported core markets, one bounded429retry and a10-second timeout per attempt. Stale priced football rows cannot produce current market-gap claims. Provider-origin quote age remains a separate limitation.
- Tennis settlement performs bounded source reads, rejects mismatched winners and preserves diagnostic fields. A batch read failure occurs before any tennis settlement writes.
- Backfilled/post-start seals are excluded by the sealed-ledger reader. Existing cohort rules otherwise remain unchanged; provenance and capped-history notices are explicit.
- Unknown tennis provenance does not silently become an Elo estimate. Market, model and unknown classifications propagate through API, history, desk, embed and CLASSIC cards.
- Public methodology, FAQ, community and affiliate payout copy reflect current behavior. User-submitted community probabilities are not model-verified. No affiliate payout service is activated by this change.
- Next.js and runtime transitive dependencies are updated for published security advisories. Vitest4.1.12 also removes the remaining development-tool advisories; the full test suite is rerun after the upgrade.

## Release boundaries

Site deployment, worker rollout and the separate backoffice migrations are distinct actions. The Python worker runs from its own checkout and needs an explicit reviewed rollout; changing the web deployment does not update that process.

`scripts/backfill-recent-form.ts` is offline-only. It requires fresh normalized sources and a fresh DB export, produces a backup and guarded apply/rollback SQL, and never connects to a database. Review affected rows, apply only after approval and refresh expired plans. Its rollback protects subsequent writes and elapsed kickoffs rather than blindly restoring old values.

Outstanding operational evidence: historical tennis backlog without source winners; independent provider-refund reconciliation; real payment lifecycle; company payout wallet; provider-origin odds timestamps. Never turn missing evidence into a verified state.
