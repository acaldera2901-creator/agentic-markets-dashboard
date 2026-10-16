# Product tracking integration — 16 October 2026

Prepared on `feat/backoffice-tracking-1016` in the isolated product checkout, originally based on production `26fdd583`, now locally integrated with Classic/main `50580d5ec6a8c006be37b6a58b1c73ad14aa485e`. This document describes prepared code, not an activated integration. No product migration, deployment, main-branch change, push, provider configuration or real email was performed. The merge is confined to this isolated feature branch.

## What is implemented

- Production-only browser analytics and redirect click persistence; explicit `TRACK_ALLOW_WRITE=1` remains available only for an isolated fixture DB. Admin paths and preview banners do not emit browser measurements. Existing partner redirect targets, encoded parameters, click ID forwarding, no-store/noindex and postback contracts are preserved.
- Coarse server UA/device classification, declared widget host/test classification and a bounded metadata allowlist. All text dimensions are decoded up to a bounded depth before email/UUID redaction; malformed or unresolved escapes are redacted. Country/language/plan/partner scalar dimensions cannot carry arbitrary email or encoded payloads.
- Consent-aware session anchors and memory-only entry context. With advanced linkage **off**, existing anonymous page counters remain unchanged. With advanced linkage **on**, an undecided visitor's current view waits in memory for a choice: acceptance bootstraps the signed server cookie before measuring the current page; refusal measures the current page anonymously. Earlier undecided navigation is not retrospectively collected. This measurement-mode change must be approved before enabling the flag.
- Advanced session linkage uses a dedicated HMAC-signed, httpOnly, same-site, server-generated SID; no raw caller SID or profile UUID can create a binding. Password/token auth and fresh server session lookups resolve the profile, while SQL resolves its UUID. Binding, session anchor and browser insertion RPCs use the same session-row lock as withdrawal. Existing bindings cannot be reassigned to a different identity; account switches rotate the SID.
- Consent withdrawal clears local analytics identifiers, revokes the signed cookie/binding and anonymizes that session's stored event SIDs. Same-page refusal→acceptance and withdrawal→reacceptance create a new anchor without adding duplicate aggregate page views. A late bootstrap response is followed by withdrawal before any consented page is emitted. The privacy page exposes withdrawal and reopening the existing banner.
- Deferred, idempotent `signup_created`, `account_activated` and `purchase` events use internal profile UUIDs/order references, never email/name in new event rows. Source claims and event insertion are atomic; failed telemetry cannot leave a claimed key or roll back a successful payment. All existing plan grant hooks plus weekly purchase notifications are covered. Mirrored PayGate/crypto source variants dedupe; Shopify historical reconcile emits null amount/currency because no currency is stored there.
- Resend raw-body Svix signature verification, timestamp tolerance, event-ID replay protection, delivery/bounce/failure/suppression outcomes and monotonic provider unsubscribe processing. Send responses correlate provider message IDs to profile UUIDs; outcomes arriving first can be correlated later. Opens/clicks require both a separate flag and explicit per-message consent; existing send paths deliberately mark engagement false.
- Optional atomic Berlin-day aggregate tracking counters with structured log evidence independent of DB persistence. DB failure explicitly logs `counter_complete:false`; counters alone cannot establish completeness.
- Optional coordinated retention transaction: browser SID anonymization and session-link/session cleanup at 14 months; removal of business analytics UUID/order identifiers at 14 months; separately configured email and counter retention; read-only dry run. Existing legacy retention behavior remains available when the additive coordinator is off.

## Schema ownership and rollout prerequisites

`supabase/migrations/202610160002_product_analytics.sql` is additive and has **not** been applied. BO foundation already created the shared base tables `session_links`, `email_events`, `bo_tracking_counters`; this migration repeats exactly compatible `IF NOT EXISTS` definitions. Treat those base definitions as a coordinated shared contract, not independent migrations to diverge. Product owns all `br_*` tables and writer/cleanup functions; BO reads shared data. All new tables use RLS with no anon/authenticated grants; writer functions have explicit search paths and service-role-only execution.

Before enabling any writer:

1. Review and separately approve the product migration against the installed BO foundation and observed product schema. Apply it once through the approved migration process; verify the new functions/privileges read-only.
2. Review the privacy/consent mode change, dedicated session collection and retention periods. Confirm the named environment flags and disclosure before collection. Dedicated analytics signing material must not reuse customer/operator auth secrets.
3. Run the affected unit/integration fixtures, build and authenticated preview QA against an isolated DB. Reconcile primary profile/order counts independently. Never point `TRACK_ALLOW_WRITE=1` at shared production data for QA.
4. Review the integrated Classic/main `50580d5e` changes and rerun affected tests if main advances before merging. The overlay is now applied to real Classic source in this isolated feature branch.
5. Enable approved flags deliberately and monitor logs/source completeness. Provider webhook setup is a separate explicit action; no Resend webhook or campaign was configured here.

| Environment name | Default / requirement |
| --- | --- |
| `ANALYTICS_LINKING_ENABLED` | Off unless exactly `1`; also requires production write gate, retention approval and dedicated secret |
| `NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED` | Off unless exactly `1`; build-time client mode must match approved server linkage mode |
| `ANALYTICS_SESSION_SECRET` | Dedicated random secret of at least 32 characters; never exposed to browser |
| `ANALYTICS_RETENTION_APPROVED` | Off unless exactly `1`; explicit operational confirmation, not inferred from installed schema |
| `BUSINESS_EVENTS_ENABLED` | Off unless exactly `1`; requires production gate and retention approval |
| `EMAIL_OUTCOMES_ENABLED` | Off unless exactly `1`; requires production gate and explicit valid email retention |
| `EMAIL_OUTCOMES_RETENTION_DAYS` | Must be explicitly selected, integer 7–730; 90 days is only an example, not an approved setting |
| `RESEND_WEBHOOK_SECRET` | Provider-issued `whsec_…` secret; absent configuration fails closed |
| `EMAIL_ENGAGEMENT_ENABLED` | Off unless exactly `1`; insufficient by itself: each provider message must also have verified consent stored |
| `TRACKING_COUNTERS_ENABLED` | Off unless exactly `1`; aggregate counters and structured logs only |
| `TRACKING_RETENTION_ENABLED` | Off unless exactly `1`; requires production gate, retention approval and both periods configured |
| `TRACKING_COUNTER_RETENTION_DAYS` | Explicit integer 7–730; no silent deletion default |
| `CRON_SECRET` | Existing authenticated retention endpoint; no new scheduler was enabled |
| `TRACK_ALLOW_WRITE` | Keep unset in shared dev/preview. `1` is an isolated-test override only |

Rollback: disable the additive writer flags and restore the prior product deployment. Keep additive tables/functions for review and recovery; do not DROP recently collected data as a rollback shortcut. Existing customer/operator session cookies and partner redirect identifiers are not shared with the backoffice.

## Classic source integration

Classic/main `50580d5ec6a8c006be37b6a58b1c73ad14aa485e` is merged into this isolated feature branch. The privacy page retains both ClassicChrome and consent controls/disclosures. The reviewed `classic-3930728-tracking.patch` applied cleanly to that source. Its import-before-`use client` ordering was corrected in the integrated ClassicLobby so its client boundary remains valid.

Classic banners now emit 50%-qualified once-per-mount impressions with `viewability='50pct-v1'` and CTA/more-link clicks while retaining existing custom navigation handlers. Explicit banner previews suppress these events; server production gates continue protecting preview deployments. Lobby tab/sport selections now emit the prepared events. New collection flags remain off by default.

`lib/classic-tracking-overlay.test.tsx` now imports the actual integrated component instead of applying a patch to a synthetic checkout. It cannot skip due to a missing historical Git object. ClassicLobby tests verify measurement and retained selection behavior. The historical patch remains only an audit artifact; do not reapply it to the integrated branch.

## Verification and candid limits

- Integrated Classic follow-up: focused suite 32 files / 310 passing tests; Classic component suite 7 files / 47 passing with both local default and Classic-enabled test configuration; TypeScript and affected-file ESLint pass. Webpack builds pass with both default local flags and command-scoped `NEXT_PUBLIC_CLASSIC=1` (173 static pages each). No environment file or deployed setting changed.

- Tests use synthetic data and mocked providers/DBs or in-memory PGlite only. PGlite replays the migration twice, verifies business dedup/rollback, signed-session binding refusal/revocation, both deterministic insert/revoke interleavings, out-of-order email correlation, unsubscribe, retention dry/live behavior and denied anon privileges.
- Real route tests prove successful payment responses precede analytics work and telemetry failure does not roll back grants; failed grants emit no purchase event. Redirect regression cases preserve partner URL bytes/click-ID forwarding while preview performs no click persistence.
- Browser smoke QA used the local built privacy page with `VERCEL_ENV=preview`, `TRACK_ALLOW_WRITE=0`, all new collection flags off. Withdrawal confirmation and reopening the cookie choices were visible. It did not exercise a live authenticated collection flow or real provider.
- Full default `npm run build` encounters the local checkout's external `node_modules` symlink, which Turbopack rejects. `npx next build --webpack` is the verified production-build fallback; no config or dependency change was used to hide the limitation. Existing middleware deprecation and three existing HouseBanner image optimization lint warnings remain.
- **T1–T10 is not fully operational or certified.** New expiry/refund business-event hooks are not implemented. Existing provider order/refund/state sources remain authoritative; these must not be relabeled as complete normalized analytics.
- Business analytics are best-effort `after()` work, not a durable transactional outbox. Failed telemetry is logged for reconciliation; primary profile/order counts remain the KPI source. Delivery counters cannot prove zero loss during DB/log-platform outages.
- Withdrawal cleanup DB failures are explicitly logged and return 503; a durable targeted erasure retry queue has not been implemented. This remains an activation/review consideration rather than a claim that every failure path is operationally reconciled.
- Engagement tracking remains unusable from current send flows without a separately approved per-message consent implementation. No production webhook signature/replay drill, provider amount reconciliation, live retention deletion or post-rollout coverage target has been certified.
- No false history backfill or production reclassification occurred. Historical metrics remain provisional.

Provider references checked for the implementation: [Resend signature verification](https://www.resend.com/changelog/managing-webhooks-via-api), [event types](https://resend.com/docs/webhooks/event-types), [contact update payload](https://resend.com/docs/webhooks/contacts/updated).
