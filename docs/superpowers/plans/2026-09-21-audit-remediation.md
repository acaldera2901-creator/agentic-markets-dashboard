# BetRedge audit remediation implementation plan

> For agentic workers: use subagent-driven-development for bounded tasks and independent review. User approved the audit solutions with "procedi con tutto quello che hai trovato" on 2026-09-21. This plan executes that scope; production deployment still follows the current approval gates.

Goal: correct verified defects F01–F12 and deliver reviewable operational recovery instructions for external systems.
Architecture: retain Next.js/Supabase/Python contracts and current model policy; isolate changes on codex/betredge-remediation-20260921. Never invent outcomes, quotes or subscription capability. Quarantine ambiguous data and report degraded readiness explicitly.
Tech stack: Next.js 16, TypeScript/Vitest, Python/pytest, Postgres (read-only inspection).

Approved design: C:/Users/bragh/.codex/shells/agentic_codex/audit-2026-09-21/betredge-audit-2026-09-21.html, findings F01–F12, including each solution and acceptance criterion. No production writes, messages or deployments are implied by preparing these changes.

## Work units and ownership

- [x] F01: lib/prediction-dedup.ts + tests, app/api/v2/predictions/route.ts. Canonical tennis pairs at identical parsed start times, compatible tournament/round context; provider placeholders are not tournament identifiers. Preserve distinct fixtures and existing football semantics. Conflicting declared tennis winners are withheld, not chosen by confidence. Add route regression and pure identity/conflict tests before implementation.
- [x] F05: lib/paygate.ts and all evaluateCallback/checkPaymentStatus call sites + tests. Preserve provider coin. Compare USD only with explicitly supported USD stablecoin payout denominations. Unknown/unsupported denomination fails closed. Validate finite positive amount/tolerance; server verification is authoritative. Verify callback, polling, reconcile and weekly access; do not execute money operations.
- [x] F10: components/VercelAnalytics.tsx + tests. Consent state follows acceptance and revocation. Gate SDK beforeSend against current consent, including after unmount because injected SDK may remain. Test same-tab and storage events, malformed/absent state, withdrawal.
- [x] F03: scripts/refresh_history_snapshot.py, core/football_data_uk.py if evidence supports source fix, lib/summer-leagues.ts, scoped tests. Record freshness per league; partial failure must not silently report fresh all-success. Preserve prior valid league data. Never relax cross-division redirect guard blindly. Download source evidence only; refresh snapshot in own worktree if valid data can be obtained.
- [x] F02: app/api/health/route.ts + readiness helper/tests. Expose stale release/data readiness separately from heartbeat liveness; avoid pretending all Python commits must match web HEAD. Prepare real-runtime release checklist, no remote restart without scoped deployment approval.
- [x] F04/F07/F08 copy: align existing copy with current explicit capabilities, prematch freeze and pick policy. Reuse PR397/399 concepts after review, cover homepage/CRM/plans/terms and translations. Preserve model flags and pricing. Track record labels disclose reconstructed/regraded cohorts without changing immutable ledger.
- [x] F08/F09: inspect tennis ledger writer and settlement path; fix demonstrated missing capture locally with tests. Build read-only exception report for overdue cases, no guessed outcomes or bulk voids.
- [x] F06: produce per-migration comparison of version/name/SQL/catalog. Add safe workflow gate if isolated from active PR431; do not repair ledger or run db push. Existing owner handles concurrent migration content.
- [x] F11: baseball/MMA payload contract and tests against checked-in schema. Required event_name, probability distribution in notes, flags remain off. Do not claim settlement ready unless demonstrated.
- [x] F12: explicit UTF-8 in affected control-center I/O, OS-aware tests. Preserve production checkout caches/dependencies; use own worktree dependencies.
- [x] Review each implemented unit against approved criteria, then independent code quality review. Resolve findings before final validation.
- [x] Full Vitest/typecheck/build and affected Python tests, then relevant broader Python run. Record known platform-only failures separately. Commit only own changes locally, no automatic push.
- [x] Deliver HTML closure matrix: fixed locally / verified live / external gate / unresolved with exact next action. Update own HANDOFF and one diary entry; no vault or other agent memory writes.

## TDD execution protocol for every behavioral unit

1. Add narrowly scoped behavioral regression to the named unit's tests.
2. Run `node node_modules/vitest/vitest.mjs run <test-file>` or production venv Python `-X utf8 -B -m pytest -q -p no:cacheprovider <test-file>` from this worktree. Confirm the failure asserts the intended missing behavior, not an environment error.
3. Implement minimum correction; preserve existing contracts outside the approved unit.
4. Rerun the regression and all callers' tests; then typecheck or Python import checks as applicable.
5. Inspect diff and record verification. Commit with explicit paths only once the unit is reviewed.

## Concrete initial regression expectations

```ts
expect(deduplicatePredictions([tennis, reversedSameWinner])).toHaveLength(1);
expect(deduplicatePredictions([tennis, reversedOppositeWinner])).toHaveLength(0);
expect(evaluateCallback({ order: {status: 'pending', amount_usd: 10}, valueCoin: 10, coin: 'polygon-pol' }).grant).toBe(false);
expect(evaluateCallback({ order: {status: 'pending', amount_usd: 10}, valueCoin: 10, coin: 'polygon-usdc' }).grant).toBe(true);
// Render accepted -> set declined -> dispatch storage -> analytics absent;
// captured SDK beforeSend callback must return null after withdrawal.
```

The audit's failing reproduction fixtures are archived with the approved report. Refine exact types to existing code before adding tests. Operational recovery must remain separately visible: a local fix is not a deployed fix.

## Delivery status — 2026-09-21

Checked items mean the scoped local implementation or recovery package was delivered, not that production was changed. Vitest 173 files/2308 tests passed; standalone 34 passed/2 skipped; Python 1674 passed/5 skipped plus 8 writer regression tests; typecheck and Next build passed; ledger SQL 13 cases passed on in-memory PostgreSQL WASM. Independent final integration review approved.

External follow-ups remain: worker release/AH collection, 11 orphan tennis records, migration journal reconciliation and actual environment reviewer protection, Shopify billing verification, browser telemetry E2E. Unsupported PayGate denominations remain pending and verified coin is not persisted. Baseball/MMA remain disabled. Ledger capture proves DB publication, not display. Full migration replay not performed.

HTML closure and evidence: C:/Users/bragh/.codex/shells/agentic_codex/audit-2026-09-21/betredge-remediation-2026-09-21.html. No push, deployment, DB writes or coordination messages were performed.
