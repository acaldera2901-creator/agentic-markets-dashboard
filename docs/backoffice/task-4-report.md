# Task 4 implementation report

Branch: `feat/backoffice-tracking-1016`. Original base: production `26fdd583`; now integrated locally with Classic/main `50580d5e`. Scope includes the controller's already-prepared selective tracking changes and the additional session/business/email/counter/retention implementation. This is a prepared branch, not an activated production integration.

Implemented production/admin/preview gates, coarse classification and bounded metadata scrubbing, consent-aware entry/session behavior, 50% viewability versioning, signed server session linkage, transactional session revocation and event insertion, three idempotent business event types, Resend signed delivery/unsubscribe ingestion, optional aggregate counters and coordinated retention. Shared BO foundation tables remain compatible. The product migration has not been applied.

All four initial review findings were corrected and tested:

1. Bounded nested decoding and fail-closed redaction applies to every allowlisted text dimension, including path, UTM and surface values.
2. Initial consenting page measurement waits for cookie bootstrap and dedupes StrictMode. Advanced mode defers undecided measurement and preserves only entry context in memory; it measures the current page after a choice. This is an explicit rollout consent-mode decision.
3. `br_insert_browser_event` checks/latches the session under the same row lock as withdrawal. Fixtures cover both deterministic insert-before-revoke and revoke-before-insert orderings; neither leaves a linked event SID after withdrawal.
4. Historical Shopify reconcile emits null amount/currency rather than inventing USD.

The subsequent same-page consent finding was corrected too: consent synchronization and new session anchoring run independently of page-view deduplication. Refusal→acceptance and withdrawal→reacceptance retain one aggregate page view and establish the appropriate fresh anchor.

Verification commands:

- `./scripts/test-backoffice-tracking.sh` — 32 focused test files, 310 passing synthetic tests at final verification. Includes auth/payment/affiliate/redirect regressions, actual route failure tests and in-memory PGlite migration replay/RLS/retention tests.
- `npx tsc --noEmit` — passed.
- `npx next build --webpack` — passed, 173 static pages and all dynamic routes compiled. Default `npm run build` is blocked by Turbopack rejecting the checkout's external node_modules symlink; no configuration workaround was committed.
- ESLint against all changed/new TS/TSX files — no errors; three pre-existing HouseBanner image optimization warnings.
- Local built privacy-page browser smoke with all new collection flags off and preview write gate: withdrawal confirmation and reopening cookie choices verified. No authenticated production collection test or provider send was run.

Classic/main `50580d5ec6a8c006be37b6a58b1c73ad14aa485e` is now merged locally into this isolated feature branch. The privacy page preserves both Classic chrome and consent controls. The reviewed banner/lobby overlay is applied to actual source, with the client directive ordering corrected. Its regression test imports the real component and no longer skips for missing historical Git objects. Banner viewability, preview suppression, callbacks and lobby selection telemetry are covered.

**Outstanding activation and coverage boundaries:** expiry/refund business-event hooks are not implemented; business delivery has no durable outbox; withdrawal DB-failure cleanup has no durable targeted retry queue; engagement needs a separately approved per-message consent flow; product schema, flags, privacy mode, retention periods and provider webhook configuration need separate approval/cutover. Existing primary profile/order/refund sources stay authoritative. No complete T1–T10 operational claim is made.

See [tracking-1016-rollout.md](tracking-1016-rollout.md) for all named flags, schema ownership, deployment ordering, rollback and exact limitations. No DB writes outside isolated PGlite fixtures, real email, provider configuration, deploy, main-branch change or push was performed by this task.

## Integrated Classic verification (local follow-up)

- Actual Classic component suite: 7 files, 47 passing tests, including the real banner component and lobby filter measurements.
- Focused integration suite: 32 files, 310 passing tests; no historical-source skip.
- Standalone TypeScript and ESLint on integrated components/tests pass.
- Webpack builds pass both with default local flags and with `NEXT_PUBLIC_CLASSIC=1`, each generating 173 static pages. Classic-enabled component tests also pass (47/47). This command-scoped build flag did not modify any environment file or deployed setting.

## Concrete activation review checklist

1. Review this feature-branch integration against `50580d5e`; decide product PR merge/deployment independently from BO read-only deploy.
2. Approve/reconcile additive product migration `202610160002_product_analytics.sql` against installed shared foundation, then apply through the controlled migration process and verify RPC/RLS privileges.
3. Approve disclosure/consent behavior and retention periods; provision dedicated signing secret and matching client/server linkage flags only after isolated authenticated QA.
4. Approve Resend webhook endpoint/secret and exercise signed replay/delivery fixtures before enabling outcomes. Engagement remains off until explicit per-message consent is implemented.
5. Reconcile primary orders/profiles against sampled analytics after controlled activation. Accept or implement durable business delivery and targeted withdrawal retry before claiming complete coverage.
6. Define authoritative expiry/refund lifecycle events with product/payment owners before adding hooks. The current normalized business-event contract supports signup, activation and purchase only; no inferred financial events or historical backfill are introduced.

All new tracking flags retain their off defaults. No deployed environment changes, DB migration, provider send/configuration, push or production deployment was performed.
