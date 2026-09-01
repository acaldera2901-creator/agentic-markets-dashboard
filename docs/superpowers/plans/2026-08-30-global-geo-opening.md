# Global Geo Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open signup, partner/sportsbook links, and FortunePlay data to every country while retaining one central blocklist for future restrictions and leaving Casea limited to its valid NO/CH/FI URLs.

**Architecture:** Keep signup and sportsbook controls separate so future signup restrictions never lock out existing users. Empty the existing sportsbook blocklist, reuse it in every sportsbook/FortunePlay route, and activate worldwide access through the existing wildcard environment variables. Preserve client fail-closed behavior, cache controls, external URLs, and all non-geo authentication logic.

**Tech Stack:** Next.js 16.2.7, TypeScript 5, React, Vitest 3, Node assert tests via `tsx`, ESLint 9, Vercel environment variables.

---

## File map

- `lib/sportsbooks/index.ts`: source of truth for the sportsbook/partner/FortunePlay blocklist and sportsbook allowlist resolution.
- `lib/sportsbooks/geo.test.ts`: unit contract for an empty blocklist, wildcard global access, and future CSV allowlist behavior.
- `tests/sportsbooks-resolver.test.ts`: integration-style resolver checks for master switch, wildcard, and CSV behavior.
- `app/api/geo-books/route.test.ts`: endpoint contract consumed by partner pages and footers.
- `app/api/fortuneplay-match/route.ts`: per-match markets; must consume the central blocklist.
- `app/api/fortuneplay-match/route.test.ts`: proves formerly blocked countries receive complete markets.
- `app/api/fortuneplay-odds/route.ts`: board odds and outbound URLs; must consume the central blocklist.
- `app/api/fortuneplay-odds/route.test.ts`: proves formerly blocked countries receive complete odds and `geoBlocked: false`.
- `docs/handoffs/2026-08-30-global-geo-opening-handoff.md`: final technical/non-technical handoff, verification evidence, rollback, and future operations.

Files deliberately unchanged:

- `lib/signup-geo.ts`: already supports `SIGNUP_COUNTRY_ALLOWLIST=*` and keeps login/logout/reset outside the signup gate.
- `lib/affiliate.ts` and `lib/partners.ts`: retain Casea's NO/CH/FI-only URL mapping.
- client components: retain fail-closed network-error behavior and keep using `/api/geo-books` for the country needed by Casea.
- `.env.example`: retain safe defaults; the existing comments already document `*` as global and empty sportsbook allowlist as closed.

### Task 1: Prepare dependencies and read the local Next.js guidance

**Files:**
- Read: `AGENTS.md`
- Read after install: `node_modules/next/dist/docs/`
- Modify: none

- [ ] **Step 1: Install the locked dependency tree**

Run:

```powershell
npm ci
```

Expected: exit code 0, `node_modules` created from `package-lock.json`, and no tracked dependency file changed.

- [ ] **Step 2: Locate and read the route-handler documentation required by AGENTS.md**

Run:

```powershell
rg --files node_modules/next/dist/docs | rg -i "route-handler|route\.md|environment"
```

Open the returned route-handler and environment-variable pages that apply to `app/api/**/route.ts`. Expected: confirmation that the existing `NextRequest` route-handler pattern remains valid; no architectural rewrite is required.

- [ ] **Step 3: Confirm the starting worktree without staging unrelated files**

Run:

```powershell
git status --short
git diff --check
```

Expected: the pre-existing untracked tennis/data/report files may remain, but there are no tracked application changes from dependency installation.

### Task 2: Define and implement the global central geo contract

**Files:**
- Modify: `lib/sportsbooks/geo.test.ts`
- Modify: `tests/sportsbooks-resolver.test.ts`
- Modify: `app/api/geo-books/route.test.ts`
- Modify: `lib/sportsbooks/index.ts`

- [ ] **Step 1: Replace the hard-block expectations in `lib/sportsbooks/geo.test.ts`**

Use this complete test body:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { geoAllowed, GEO_BLOCKED_COUNTRIES } from "./index";

describe("geoAllowed — apertura globale reversibile", () => {
  const previousAllowlist = process.env.SPORTSBOOK_GEO_ALLOWLIST;

  afterEach(() => {
    if (previousAllowlist === undefined) delete process.env.SPORTSBOOK_GEO_ALLOWLIST;
    else process.env.SPORTSBOOK_GEO_ALLOWLIST = previousAllowlist;
  });

  it("parte con una blocklist centrale vuota", () => {
    expect(GEO_BLOCKED_COUNTRIES.size).toBe(0);
  });

  it("con '*' ammette ogni paese e anche la geo ignota", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
    for (const country of ["IT", "DE", "FR", "NL", "ES", "BE", "GB", "US", null, undefined]) {
      expect(geoAllowed(country), String(country)).toBe(true);
    }
  });

  it("con allowlist vuota non ammette alcun paese", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("US")).toBe(false);
  });

  it("con CSV ammette solo i paesi indicati", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "CH, GB";
    expect(geoAllowed("ch")).toBe(true);
    expect(geoAllowed("GB")).toBe(true);
    expect(geoAllowed("US")).toBe(false);
  });
});
```

- [ ] **Step 2: Update the resolver assertions**

In `tests/sportsbooks-resolver.test.ts`, keep the master-OFF, empty-allowlist, CSV, URL-builder, and adapter-fallback checks. Replace the hard-block section and final wildcard assertions with:

```ts
// Blocklist centrale temporaneamente vuota: una allowlist esplicita apre anche
// le geo storicamente bloccate.
process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,DE,FR,NL,ES,BE";
for (const country of ["IT", "DE", "FR", "NL", "ES", "BE", "it", "be"]) {
  assert.equal(geoAllowed(country), true, `geo ammessa: ${country}`);
  assert.equal(resolveBooks(country).length, 1, `book disponibile per ${country}`);
}

// Globale "*": qualsiasi geo, inclusa quella ignota.
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
for (const country of ["US", "IT", "DE", null, undefined]) {
  assert.equal(geoAllowed(country), true, `geo globale: ${String(country)}`);
  assert.equal(resolveBooks(country).length, 1, `book globale: ${String(country)}`);
}
```

- [ ] **Step 3: Update the `/api/geo-books` contract**

In `app/api/geo-books/route.test.ts`, replace the test that expects IT/DE to be blocked with:

```ts
it("con blocklist vuota non blocca le giurisdizioni storiche", async () => {
  expect(await call({ "x-vercel-ip-country": "IT" })).toEqual({ blocked: false, country: "IT" });
  expect(await call({ "x-vercel-ip-country": "DE" })).toEqual({ blocked: false, country: "DE" });
});
```

Keep the Vercel-header, Cloudflare-header, and missing-header tests unchanged.

- [ ] **Step 4: Run the new contract and verify it fails against the old hard-block**

Run:

```powershell
npx vitest run lib/sportsbooks/geo.test.ts app/api/geo-books/route.test.ts
npx tsx tests/sportsbooks-resolver.test.ts
```

Expected before implementation: failures showing a non-empty `GEO_BLOCKED_COUNTRIES`, `geoAllowed("IT") === false`, and `/api/geo-books` returning `blocked: true` for IT/DE.

- [ ] **Step 5: Empty the central blocklist without deleting the mechanism**

In `lib/sportsbooks/index.ts`, replace the legal hard-block comment and declaration with:

```ts
// Blocklist geografica centrale per link partner, sportsbook e feed quote.
// Temporaneamente vuota: il progetto è aperto globalmente. Per ripristinare
// restrizioni mirate aggiungere qui codici ISO 3166-1 alpha-2 uppercase.
// Questa costante è condivisa dalle API geo e FortunePlay per evitare liste
// duplicate che possano divergere.
export const GEO_BLOCKED_COUNTRIES = new Set<string>();
```

Keep the first line of `geoAllowed()` unchanged:

```ts
if (country && GEO_BLOCKED_COUNTRIES.has(country.trim().toUpperCase())) return false;
```

This dormant branch is the preserved future block mechanism.

- [ ] **Step 6: Run the central geo tests and verify they pass**

Run:

```powershell
npx vitest run lib/sportsbooks/geo.test.ts app/api/geo-books/route.test.ts
npx tsx tests/sportsbooks-resolver.test.ts
```

Expected: both Vitest files pass and the resolver prints `sportsbooks-resolver ok`.

- [ ] **Step 7: Commit only the central geo contract**

Run:

```powershell
git add -- lib/sportsbooks/index.ts lib/sportsbooks/geo.test.ts tests/sportsbooks-resolver.test.ts app/api/geo-books/route.test.ts
git commit -m "feat: open central sportsbook geo policy globally"
```

Expected: one commit containing only the four listed files.

### Task 3: Make FortunePlay match markets use the central blocklist

**Files:**
- Modify: `app/api/fortuneplay-match/route.test.ts`
- Modify: `app/api/fortuneplay-match/route.ts`

- [ ] **Step 1: Replace the IT-redaction test with the global-access contract**

Replace the `describe` block in `app/api/fortuneplay-match/route.test.ts` with:

```ts
describe("GET /api/fortuneplay-match — blocklist centrale vuota", () => {
  it("rende i mercati completi anche a un viewer IT", async () => {
    fetchFortuneplayMatchMarkets.mockClear();
    const res = await GET(req("99", "IT"));
    const body = await res.json();
    expect(body.markets).toHaveLength(1);
    expect(body.markets[0].outcomes[0].odds).toBe(1.8);
    expect(fetchFortuneplayMatchMarkets).toHaveBeenCalledOnce();
  });

  it("mantiene invariata la risposta per un viewer non-IT", async () => {
    const res = await GET(req("99", "GB"));
    const body = await res.json();
    expect(body.markets).toHaveLength(1);
    expect(body.markets[0].outcomes[0].odds).toBe(1.8);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails against the local IT blocklist**

Run:

```powershell
npx vitest run app/api/fortuneplay-match/route.test.ts
```

Expected before implementation: the IT response contains no markets and the upstream mock was not called.

- [ ] **Step 3: Replace the local list with the central import**

In `app/api/fortuneplay-match/route.ts`, add:

```ts
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";
```

Delete:

```ts
const GEO_BLOCKED_COUNTRIES = new Set(["IT"]);
```

Update the nearby comment to state that the route shares the central reversible blocklist. Leave request parsing, `resolveCountry()`, upstream fetch, curation, and error behavior unchanged.

- [ ] **Step 4: Run the match-route test and verify it passes**

Run:

```powershell
npx vitest run app/api/fortuneplay-match/route.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit the match-route change**

Run:

```powershell
git add -- app/api/fortuneplay-match/route.ts app/api/fortuneplay-match/route.test.ts
git commit -m "feat: share global geo policy with match markets"
```

Expected: one commit containing only the two match-route files.

### Task 4: Make FortunePlay board odds use the central blocklist

**Files:**
- Modify: `app/api/fortuneplay-odds/route.test.ts`
- Modify: `app/api/fortuneplay-odds/route.ts`

- [ ] **Step 1: Replace the IT-redaction assertion with the global-access contract**

In `app/api/fortuneplay-odds/route.test.ts`, replace the first test in the geo-redaction `describe` block with:

```ts
it("rende quote e URL completi anche a un viewer IT", async () => {
  const res = await GET(req("IT"));
  const body = await res.json();
  const entry = body.odds["2026-07-15:brazil|italy"];
  expect(body.geoBlocked).toBe(false);
  expect(entry.id).toBe(99);
  expect(entry.oddsHome).toBe(2.1);
  expect(entry.oddsDraw).toBe(3.2);
  expect(entry.oddsAway).toBe(3.6);
  expect(entry.matchUrl).not.toBe("");
  expect(entry.books.length).toBeGreaterThan(0);
});
```

Rename the `describe` label to:

```ts
describe("GET /api/fortuneplay-odds — blocklist centrale vuota", () => {
```

Keep the non-IT response and `Vary` header tests. The header remains intentionally present for safe future reactivation.

- [ ] **Step 2: Run the test and verify it fails against the local IT blocklist**

Run:

```powershell
npx vitest run app/api/fortuneplay-odds/route.test.ts
```

Expected before implementation: `geoBlocked` is true and the IT odds/URL fields are redacted.

- [ ] **Step 3: Replace the local list with the central import**

In `app/api/fortuneplay-odds/route.ts`, add:

```ts
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";
```

Delete:

```ts
const GEO_BLOCKED_COUNTRIES = new Set(["IT"]);
```

Update only the obsolete geo comment. Keep `redactEntry()`, `geoBlocked`, `Cache-Control`, and `Vary` in place because they are needed as soon as countries are added back to the central list.

- [ ] **Step 4: Run the odds-route test and verify it passes**

Run:

```powershell
npx vitest run app/api/fortuneplay-odds/route.test.ts
```

Expected: all tests pass, including the preserved cache-header test.

- [ ] **Step 5: Commit the odds-route change**

Run:

```powershell
git add -- app/api/fortuneplay-odds/route.ts app/api/fortuneplay-odds/route.test.ts
git commit -m "feat: share global geo policy with board odds"
```

Expected: one commit containing only the two odds-route files.

### Task 5: Verify signup, Casea, regressions, and production readiness

**Files:**
- Test: `lib/signup-geo.test.ts`
- Test: `lib/affiliate.test.ts`
- Test: `lib/partners.test.ts`
- Test: all Vitest suites
- Modify: `docs/handoffs/2026-08-30-global-geo-opening-handoff.md`

- [ ] **Step 1: Run the focused cross-system regression suite**

Run:

```powershell
npx vitest run lib/signup-geo.test.ts lib/affiliate.test.ts lib/partners.test.ts lib/sportsbooks/geo.test.ts app/api/geo-books/route.test.ts app/api/fortuneplay-match/route.test.ts app/api/fortuneplay-odds/route.test.ts
npx tsx tests/sportsbooks-resolver.test.ts
npx tsx tests/sportsbooks-regional.test.ts
```

Expected:

- signup wildcard admits every country and unknown geo;
- Casea remains restricted to NO/CH/FI;
- central geo, API, match, and odds tests pass;
- sportsbook resolver and regional URL scripts print their success messages.

- [ ] **Step 2: Run the complete automated checks**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected: exit code 0 for all three commands. Any unrelated pre-existing failure must be recorded with its exact command and output; do not claim completion while an in-scope failure remains.

- [ ] **Step 3: Inspect the final diff and worktree isolation**

Run:

```powershell
git diff --check
git status --short
git diff --stat HEAD~3..HEAD
git diff HEAD~3..HEAD -- lib/sportsbooks/index.ts app/api/fortuneplay-match/route.ts app/api/fortuneplay-odds/route.ts
```

Expected: only the planned source/test files are in implementation commits; all pre-existing untracked files remain untouched.

- [ ] **Step 4: Update the handoff with actual evidence**

In `docs/handoffs/2026-08-30-global-geo-opening-handoff.md`:

- change status to `implementazione completata localmente; deploy e configurazione Vercel non eseguiti`;
- replace the planned-file wording with the exact files from the commits;
- record each command from Steps 1-2 with pass/fail and relevant test counts;
- record implementation commit hashes;
- retain the required production variables exactly as:

```env
SIGNUP_COUNTRY_ALLOWLIST=*
SPORTSBOOK_LINKS_ENABLED=true
SPORTSBOOK_GEO_ALLOWLIST=*
```

- retain monitoring, external-sportsbook caveats, Casea exception, rollback, and future ISO-2 blocklist instructions.

- [ ] **Step 5: Validate and commit the final handoff**

Run:

```powershell
git diff --check -- docs/handoffs/2026-08-30-global-geo-opening-handoff.md
git add -- docs/handoffs/2026-08-30-global-geo-opening-handoff.md
git commit -m "docs: finalize global geo opening handoff"
```

Expected: one documentation-only commit.

### Task 6: Provide the operational handoff without deploying

**Files:**
- Read: `docs/handoffs/2026-08-30-global-geo-opening-handoff.md`
- Modify: none

- [ ] **Step 1: Report the local outcome**

Provide Andrea and Claude Code with:

- the handoff path;
- design, plan, implementation, and final-handoff commit hashes;
- verification evidence;
- confirmation that no Vercel variable or deployment was changed;
- exact three-variable Vercel configuration required for global opening;
- rollback and future blocklist instructions.

- [ ] **Step 2: Keep production activation separately authorized**

Do not change Vercel Preview or Production variables and do not deploy unless the user explicitly authorizes that external state change. The implementation is complete when the local repository is verified and the final handoff is accurate.
