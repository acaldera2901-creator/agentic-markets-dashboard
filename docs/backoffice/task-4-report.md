# Task 4 implementation report

Branch: `feat/backoffice-tracking-1016`. Base: production `26fdd583`. Scope includes the controller's already-prepared selective tracking changes and the additional session/business/email/counter/retention implementation. This is a prepared branch, not an activated production integration.

Implemented production/admin/preview gates, coarse classification and bounded metadata scrubbing, consent-aware entry/session behavior, 50% viewability versioning, signed server session linkage, transactional session revocation and event insertion, three idempotent business event types, Resend signed delivery/unsubscribe ingestion, optional aggregate counters and coordinated retention. Shared BO foundation tables remain compatible. The product migration has not been applied.

All four initial review findings were corrected and tested:

1. Bounded nested decoding and fail-closed redaction applies to every allowlisted text dimension, including path, UTM and surface values.
2. Initial consenting page measurement waits for cookie bootstrap and dedupes StrictMode. Advanced mode defers undecided measurement and preserves only entry context in memory; it measures the current page after a choice. This is an explicit rollout consent-mode decision.
3. `br_insert_browser_event` checks/latches the session under the same row lock as withdrawal. Fixtures cover both deterministic insert-before-revoke and revoke-before-insert orderings; neither leaves a linked event SID after withdrawal.
4. Historical Shopify reconcile emits null amount/currency rather than inventing USD.

The subsequent same-page consent finding was corrected too: consent synchronization and new session anchoring run independently of page-view deduplication. Refusal→acceptance and withdrawal→reacceptance retain one aggregate page view and establish the appropriate fresh anchor.

Verification commands:

- `./scripts/test-backoffice-tracking.sh` — 31 focused test files, 299 passing synthetic tests at final verification. Includes auth/payment/affiliate/redirect regressions, actual route failure tests and in-memory PGlite migration replay/RLS/retention tests.
- `npx tsc --noEmit` — passed.
- `npx next build --webpack` — passed, 173 static pages and all dynamic routes compiled. Default `npm run build` is blocked by Turbopack rejecting the checkout's external node_modules symlink; no configuration workaround was committed.
- ESLint against all changed/new TS/TSX files — no errors; three pre-existing HouseBanner image optimization warnings.
- Local built privacy-page browser smoke with all new collection flags off and preview write gate: withdrawal confirmation and reopening cookie choices verified. No authenticated production collection test or provider send was run.

Classic source comparison is bound to PR #534 head `3930728ba47ac8dba56eaebe20c72fd5ea7db56e`. Only touched source overlap is the privacy page; Classic chrome and consent changes must both be preserved. A complete unapplied overlay for Classic banner viewability/clicks and lobby filters is provided and component-tested against that exact source. No Classic merge or rebase occurred. The dedicated overlay test requires that source object and skips if it is absent from a shallow checkout.

**Outstanding activation and coverage boundaries:** expiry/refund business-event hooks are not implemented; business delivery has no durable outbox; withdrawal DB-failure cleanup has no durable targeted retry queue; engagement needs a separately approved per-message consent flow; the Classic overlay is not integrated/built in the production-based branch; product schema, flags, privacy mode, retention periods and provider webhook configuration need separate approval/cutover. Existing primary profile/order/refund sources stay authoritative. No complete T1–T10 operational claim is made.

See [tracking-1016-rollout.md](tracking-1016-rollout.md) for all named flags, schema ownership, deployment ordering, rollback and exact limitations. No DB writes outside isolated PGlite fixtures, real email, provider configuration, deploy, merge or push was performed by this task.
