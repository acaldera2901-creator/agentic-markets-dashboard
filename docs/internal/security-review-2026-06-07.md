# Security review — reverse engineering + hardening (pre-deploy)

Date: 2026-06-07 · Author: michele-claude (ethical-hacker pass, Michele present)
Branch: `michele/security-hardening` (patch-for-review — review/merge/deploy Andrea)
Scope: monorepo `agentic-markets-dashboard` — Next.js app (Vercel) + Python agents (Fly.io).
Method: 4 parallel read-only reverse-engineering passes (auth/admin · money/subscription ·
data/predictions/cron/Supabase · secrets/config/deploy), then independent verification of
every finding against the live code (`app/` root + `lib/`). False positives were reproduced-
to-disprove and dropped — see §4.

---

## 1. Deployment topology (what is actually live — so we don't secure dead code)

| Tree | Live? | Target |
|---|---|---|
| `app/` (Next.js 16) + `lib/` | ✅ | Vercel — UI + all 33 API routes + 3 crons |
| root Python `agents/ core/ config/` via `run.py` | ✅ | Fly.io (`agentic-markets-workers`) |
| `dashboard-web/`, `client-portal/` | ❌ DEAD | excluded in `.vercelignore`, nested `.git` removed 2026-06-05 |
| `dashboard/` (FastAPI) | ~ dev-only | docker-compose, not in prod |

Only `app/`+`lib/` and the Python agents were treated as in-scope.

## 2. Findings — verified, with fixes on this branch

| # | Severity | Finding | Status |
|---|---|---|---|
| S1 | **HIGH** | `.mcp.json` ships a real `x-brain-token` (`593ece9b…`) committed to a PUBLIC repo (commit `aca32d3`). Grants access to project-brain MCP. | **Untracked + .example added on this branch; ROTATION + history purge = Andrea (server owner).** |
| S2 | MEDIUM | 8 server-to-server endpoints compared the bearer secret with `!==`/`===` (timing-variable, length/prefix leak) instead of constant-time. Routes: research, research/calibration, cron/subscriptions, cron/settle, health, predictions(POST), predictions/refresh, diagnostics/world-cup. | **FIXED — all routed through new `verifyBearer()` (constant-time, fail-closed).** |
| S3 | MEDIUM | No security headers (`next.config.ts` was empty `{}`): no HSTS, anti-clickjacking, nosniff, Referrer-Policy, CSP. | **FIXED — headers added; CSP shipped Report-Only (see §3).** |

### S1 — leaked MCP token (action required: Andrea)
The token is in git history of a public repo, so it must be considered compromised.
This branch removes the file from tracking (`git rm --cached`), adds `.mcp.json` to
`.gitignore`, and commits `.mcp.json.example` with a `${PROJECT_BRAIN_TOKEN}` placeholder.
**Andrea, to fully close it:** (1) rotate the token on `project-brain-server`; (2) put the
new value in the local `.mcp.json` only (now git-ignored); (3) optional but recommended —
purge it from history (same BFG `--replace-text` sequence used for the Betfair leak), then
re-clone. Until rotated, treat the old token as burned.

### S2 — constant-time bearer auth
New helper `lib/admin-auth.ts:verifyBearer(req, expected)` extracts the `Authorization:
Bearer` token and compares it with the existing `safeEqual` (Node `timingSafeEqual`), failing
closed when the env secret is unset. Each of the 8 routes now calls it. Pure hardening — a
caller with the correct secret behaves exactly as before. (Practical exploitability was low:
`CRON_SECRET`/`RESEARCH_SECRET` are high-entropy env values and remote timing attacks are hard
— but the fix is free, removes the class of bug, and makes weak-secret accidents safe.)

### S3 — security headers
Added to every response via `next.config.ts` `headers()`:
- `Strict-Transport-Security` (2y, includeSubDomains, preload)
- `X-Frame-Options: SAMEORIGIN` (clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin` (don't leak `?ref=`/session URLs)
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Content-Security-Policy-Report-Only` (see below)

CSP ships **Report-Only on purpose** so it can never break the live site — it only logs
violations. Recommended path: deploy, watch for zero legitimate violations for a few days,
then promote the same policy to the enforcing `Content-Security-Policy` header (tighten
`script-src` to nonces at that point). Promoting blind on a revenue site is how you take the
board down at kickoff.

## 3. Confirmed-good (no change needed)
- Customer auth: scrypt + `crypto.timingSafeEqual` password verify; HMAC session cookie,
  `httpOnly`+`secure`+`sameSite`; plan resolved fresh from DB every request (stale cookie
  cannot escalate); `admin_full` cannot log in via public auth.
- Admin gate: `isAdminAuthorized` (constant-time bearer OR HMAC `admin_token` cookie),
  CSRF guard (`sec-fetch-site: cross-site` rejected) on mutating admin routes, fail-closed
  on unset `ADMIN_SECRET`. Root `middleware.ts` uses `verifyAdminToken` (HMAC), not the raw
  secret. `founder/grant` uses `safeEqual` + hardcoded target identifier.
- SQL: `lib/db.ts interpolate()` parameterizes (`$n`) and escapes single quotes; PostgREST
  filters are URL params. No injection found on live routes (the `LIMIT ${n}` in v2/history
  is clamped to an integer 0–300 — safe, sloppy; left as-is).
- Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is server-only — never in a `NEXT_PUBLIC_*`
  var. `.gitignore` correctly ignores `.env`/`.env.*`. No other committed secret found.

## 4. False positives dismissed (verified against code)
- **"`/api/data` & `/api/leaderboard` leak all users' bets"** — FALSE. The `bets` table
  (`docs/supabase_schema.sql:147`) has NO owner column: it is the platform's single house
  paper-bet book (the public track record), gated behind `requireAccess`. Not multi-tenant,
  so reading all rows is by design.
- **"`ADMIN_SECRET ?? ""` enables empty-password admin login"** — FALSE. The guard
  `if (!ADMIN_SECRET || ...)` denies when the secret is empty.
- **"dashboard-web middleware uses raw secret in cookie"** — MOOT. `dashboard-web/` is dead,
  not deployed (§1).

## 5. PRE-FLIGHT for tomorrow's payment processor + wallet + deposits
The biggest risk is not in today's code — it's the IPN/wallet wiring arriving next. The
existing money surface (`/api/auth checkout`, `/api/admin/activations`) currently trusts a
manually-entered `tx_hash` (stored unvalidated) and a free-text `requested_plan`. Before any
real money flows, the new webhook MUST:
1. **Verify the IPN signature** (HMAC of the raw body against the processor's webhook secret)
   on every call — never activate on an unsigned/unverified notification.
2. **Idempotency**: a `payments` table keyed by processor tx id; reject/no-op duplicates
   (replayed IPNs must not double-activate).
3. **Exact-amount + currency + destination** check server-side; reject under/over-payments
   rather than trusting a client-supplied plan.
4. **Fail-closed**: any verification failure → no grant, logged, alerted.
5. **Referral integrity** (once payouts exist): codes are free-text today — self-attribution
   and typosquatting are open. Add a registry of approved codes + block self-referral before
   any commission is computed.
6. **Wallet keys**: never in repo/vault/chat — env only; the deposit address that ships in
   the client bundle (`NEXT_PUBLIC_USDT_TRC20_ADDRESS`) is fine to be public, private keys are
   not. Spend/withdrawal paths need limits + a circuit breaker.

When the API keys arrive, run a dedicated risk review of the webhook + wallet path against
this checklist before it's wired.

## 6. Verification performed
- Every finding reproduced against live code before asserting; false positives dropped (§4).
- All 8 edited routes: confirmed `verifyBearer` imported, no dangling references to removed
  `auth`/`secret`/`cronSecret` vars, `refresh` still forwards the bearer.
- Full `next build`/`tsc` NOT run locally (deps not installed in this workspace) — relies on
  Andrea's build/CI to confirm the type-check. Edits are import + single-call substitutions.
