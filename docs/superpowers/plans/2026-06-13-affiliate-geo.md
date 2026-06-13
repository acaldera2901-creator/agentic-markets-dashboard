# Affiliate Geo-Aware Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Piazza scommessa" affiliate links point to the book's regional domain based on the visitor's Vercel-detected country (US→stake.us, IT→stake.it, …), with a `.com` global fallback.

**Architecture:** Approach A (env-driven). Add an optional per-country URL map (`regionalUrls`) to each `Sportsbook`, populated from a new `SPORTSBOOK_<BOOK>_URLS` env JSON. A pure `resolveBaseUrl(book, country)` picks `regionalUrls[country] ?? regionalUrls.default ?? baseUrl`; `buildBetUrl` passes the resolved base URL to the (unchanged) adapter. The existing geo header read + enable/allowlist gate in `/api/bet-links` are reused as-is.

**Tech Stack:** TypeScript, Next.js App Router API route, `tsx --test` (node:test runner, bare-assert style as in existing `tests/sportsbooks-*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-06-13-affiliate-geo-redirect-design.md`

---

## File Structure

- `lib/sportsbooks/types.ts` — add `regionalUrls?: Record<string,string>` to `Sportsbook`.
- `lib/sportsbooks/registry.ts` — parse `SPORTSBOOK_<BOOK>_URLS` into `regionalUrls`.
- `lib/sportsbooks/index.ts` — add `resolveBaseUrl`; thread `country` through `buildBetUrl`.
- `app/api/bet-links/route.ts` — pass the already-read `country` into `buildBetUrl`.
- `tests/sportsbooks-regional.test.ts` — new test file (regional resolution + build).

No DB migration. All activation is env-controlled (`SPORTSBOOK_LINKS_ENABLED`, `SPORTSBOOK_GEO_ALLOWLIST`, `SPORTSBOOK_<BOOK>_URLS`).

---

### Task 1: Add `regionalUrls` to the Sportsbook type

**Files:**
- Modify: `lib/sportsbooks/types.ts` (the `Sportsbook` type, currently ends with `adapter: BookAdapter;`)

- [ ] **Step 1: Add the optional field**

In `lib/sportsbooks/types.ts`, inside `export type Sportsbook = { … }`, add after the `sportPaths?` line:

```ts
  // Optional per-country base URL (referral) overrides. Keys are ISO-3166-1
  // alpha-2 country codes UPPERCASE, plus an optional "default". Falls back to
  // baseUrl. Populated from SPORTSBOOK_<BOOK>_URLS env JSON.
  regionalUrls?: Record<string, string>;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v stripe | grep -E "sportsbooks|error" | head`
Expected: no new errors referencing `lib/sportsbooks` (pre-existing `stripe` module errors are unrelated and filtered out).

- [ ] **Step 3: Commit**

```bash
git add lib/sportsbooks/types.ts
git commit -m "feat(sportsbooks): regionalUrls field on Sportsbook type"
```

---

### Task 2: Parse `SPORTSBOOK_<BOOK>_URLS` in the registry

**Files:**
- Modify: `lib/sportsbooks/registry.ts`
- Test: `tests/sportsbooks-regional.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/sportsbooks-regional.test.ts`:

```ts
// tests/sportsbooks-regional.test.ts
import assert from "node:assert/strict";

// env is read at call-time (not import-time), so setting it here is enough.
process.env.SPORTSBOOK_STAKE_URL = "https://stake.com/?c=GLOBAL";
process.env.SPORTSBOOK_STAKE_CODE = "GLOBAL";
process.env.SPORTSBOOK_STAKE_PATHS = JSON.stringify({ football: "sports/soccer" });
process.env.SPORTSBOOK_STAKE_URLS = JSON.stringify({
  US: "https://stake.us/?c=US",
  it: "https://stake.it/?c=IT", // lowercase key in env → normalized to IT
  default: "https://stake.com/?c=DEF",
});

import { allSportsbooks } from "../lib/sportsbooks/registry";

const stake = allSportsbooks().find((b) => b.id === "stake");
assert.ok(stake, "stake book should be present");
assert.deepEqual(stake!.regionalUrls, {
  US: "https://stake.us/?c=US",
  IT: "https://stake.it/?c=IT",
  default: "https://stake.com/?c=DEF",
});

// malformed JSON → regionalUrls undefined, book still emitted via baseUrl
process.env.SPORTSBOOK_STAKE_URLS = "{not valid";
const stakeBad = allSportsbooks().find((b) => b.id === "stake");
assert.ok(stakeBad, "stake still emitted on bad URLS json");
assert.equal(stakeBad!.regionalUrls, undefined);

console.log("sportsbooks-regional registry ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/sportsbooks-regional.test.ts`
Expected: FAIL — `regionalUrls` is `undefined` (registry doesn't parse `_URLS` yet), so the `deepEqual` assertion throws.

- [ ] **Step 3: Implement the registry parsing**

In `lib/sportsbooks/registry.ts`:

(a) Add a parser helper after `parsePaths` (around line 13):

```ts
// Per-country base-URL map from SPORTSBOOK_<BOOK>_URLS. Country keys are
// uppercased; the "default" key is preserved. Non-string/empty values dropped.
function parseUrlMap(json: string | undefined): Record<string, string> | undefined {
  if (!json) return undefined;
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "string" || !v) continue;
      out[k === "default" ? "default" : k.toUpperCase()] = v;
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}
```

(b) Add `urlsEnv` to the `Spec` type (line 15-18):

```ts
type Spec = {
  id: SportsbookId; name: string; logo: string; adapter: BookAdapter;
  codeEnv: string; urlEnv: string; pathsEnv: string; urlsEnv: string;
};
```

(c) Add `urlsEnv` to each entry in `SPECS`:

```ts
const SPECS: Spec[] = [
  {
    id: "stake", name: "Stake", logo: "/logos/stake.svg", adapter: stakeAdapter,
    codeEnv: "SPORTSBOOK_STAKE_CODE", urlEnv: "SPORTSBOOK_STAKE_URL",
    pathsEnv: "SPORTSBOOK_STAKE_PATHS", urlsEnv: "SPORTSBOOK_STAKE_URLS",
  },
  {
    id: "roobet", name: "Roobet", logo: "/logos/roobet.svg", adapter: roobetAdapter,
    codeEnv: "SPORTSBOOK_ROOBET_CODE", urlEnv: "SPORTSBOOK_ROOBET_URL",
    pathsEnv: "SPORTSBOOK_ROOBET_PATHS", urlsEnv: "SPORTSBOOK_ROOBET_URLS",
  },
];
```

(d) Populate `regionalUrls` in the `out.push({…})` inside `allSportsbooks` (after the `sportPaths:` line):

```ts
      sportPaths: parsePaths(process.env[s.pathsEnv]),
      regionalUrls: parseUrlMap(process.env[s.urlsEnv]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/sportsbooks-regional.test.ts`
Expected: PASS — prints `sportsbooks-regional registry ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/sportsbooks/registry.ts tests/sportsbooks-regional.test.ts
git commit -m "feat(sportsbooks): parse SPORTSBOOK_<BOOK>_URLS into regionalUrls"
```

---

### Task 3: `resolveBaseUrl` + country-aware `buildBetUrl`

**Files:**
- Modify: `lib/sportsbooks/index.ts` (`buildBetUrl` currently at the bottom)
- Test: `tests/sportsbooks-regional.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `tests/sportsbooks-regional.test.ts` (re-set the env first because Task 2's last block left malformed URLS):

```ts
// ── resolveBaseUrl + buildBetUrl (country-aware) ──
process.env.SPORTSBOOK_STAKE_URLS = JSON.stringify({
  US: "https://stake.us/?c=US",
  IT: "https://stake.it/?c=IT",
  default: "https://stake.com/?c=DEF",
});
process.env.SPORTSBOOK_LINKS_ENABLED = "true";
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";

const { resolveBaseUrl, buildBetUrl } = await import("../lib/sportsbooks/index");
const book = allSportsbooks().find((b) => b.id === "stake")!;

assert.equal(resolveBaseUrl(book, "US"), "https://stake.us/?c=US");
assert.equal(resolveBaseUrl(book, "it"), "https://stake.it/?c=IT"); // case-insensitive
assert.equal(resolveBaseUrl(book, "FR"), "https://stake.com/?c=DEF"); // unmapped → default
assert.equal(resolveBaseUrl(book, null), "https://stake.com/?c=DEF"); // missing → default
assert.equal(resolveBaseUrl({ ...book, regionalUrls: undefined }, "US"), "https://stake.com/?c=GLOBAL"); // no map → baseUrl

const sel = { sport: "football" as const, market: "1X2", pick: "HOME", odds: 2.0 };
assert.ok(buildBetUrl(book, sel, "US").url.startsWith("https://stake.us/"), "US → stake.us domain");
assert.ok(buildBetUrl(book, sel, "FR").url.startsWith("https://stake.com/"), "FR → .com default");

console.log("sportsbooks-regional resolve/build ok");
```

Note: `await import(...)` requires the test to run as a module; `tsx --test` supports top-level await. Keep the static `allSportsbooks` import from Task 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/sportsbooks-regional.test.ts`
Expected: FAIL — `resolveBaseUrl is not a function` (not exported yet) / `buildBetUrl` ignores the 3rd arg.

- [ ] **Step 3: Implement in `lib/sportsbooks/index.ts`**

Add `resolveBaseUrl` (place it above `buildBetUrl`):

```ts
// Pick the book's base URL for a country: regional override → "default" → global baseUrl.
export function resolveBaseUrl(book: Sportsbook, country: string | null | undefined): string {
  const cc = country?.trim().toUpperCase();
  return (cc && book.regionalUrls?.[cc]) || book.regionalUrls?.default || book.baseUrl;
}
```

Replace the existing `buildBetUrl` with the country-aware version:

```ts
// Costruisce l'URL in uscita; non lancia mai (fallback alla baseUrl risolta).
export function buildBetUrl(book: Sportsbook, sel: BetSelection, country?: string | null): BuildResult {
  const effective = { ...book, baseUrl: resolveBaseUrl(book, country) };
  try {
    return effective.adapter(sel, effective);
  } catch {
    return { url: effective.baseUrl, prefilled: false };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/sportsbooks-regional.test.ts`
Expected: PASS — prints both `… registry ok` and `… resolve/build ok`.

- [ ] **Step 5: Run the existing sportsbook tests (no regression)**

Run: `npx tsx --test tests/sportsbooks-resolver.test.ts tests/sportsbooks-books.test.ts tests/sportsbooks-url.test.ts tests/sportsbooks-adapter.test.ts`
Expected: all PASS (the `buildBetUrl` 3rd arg is optional, so existing 2-arg calls still compile and behave identically: `resolveBaseUrl(book, undefined)` → `baseUrl`).

- [ ] **Step 6: Commit**

```bash
git add lib/sportsbooks/index.ts tests/sportsbooks-regional.test.ts
git commit -m "feat(sportsbooks): resolveBaseUrl + country-aware buildBetUrl"
```

---

### Task 4: Pass the detected country from the bet-links route

**Files:**
- Modify: `app/api/bet-links/route.ts` (POST handler; `country` is already read from `x-vercel-ip-country` at the top of POST)

- [ ] **Step 1: Thread `country` into buildBetUrl**

In `app/api/bet-links/route.ts`, in the `POST` handler, change the map callback from:

```ts
  const options: BetLinkOption[] = resolveBooks(country).map((b) => {
    const { url, prefilled } = buildBetUrl(b, sel);
    return { id: b.id, name: b.name, logo: b.logo, url, prefilled };
  });
```

to:

```ts
  const options: BetLinkOption[] = resolveBooks(country).map((b) => {
    const { url, prefilled } = buildBetUrl(b, sel, country);
    return { id: b.id, name: b.name, logo: b.logo, url, prefilled };
  });
```

(`country` is the same `const country = req.headers.get("x-vercel-ip-country")` already used by `resolveBooks(country)` above.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v stripe | grep -E "bet-links|sportsbooks|error" | head`
Expected: no errors.

- [ ] **Step 3: Lint the touched files**

Run: `npx eslint lib/sportsbooks/index.ts lib/sportsbooks/registry.ts lib/sportsbooks/types.ts app/api/bet-links/route.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/bet-links/route.ts
git commit -m "feat(bet-links): pass detected country into buildBetUrl (regional domain)"
```

---

## Manual verification (after all tasks, before PR)

With a dev server and env configured (`SPORTSBOOK_LINKS_ENABLED=true`, `SPORTSBOOK_GEO_ALLOWLIST=*`, `SPORTSBOOK_STAKE_URLS={"US":"https://stake.us/?c=US","IT":"https://stake.it/?c=IT","default":"https://stake.com/?c=DEF"}`):

```bash
# simulate an Italian visitor
curl -s -X POST http://localhost:3000/api/bet-links \
  -H "content-type: application/json" -H "x-vercel-ip-country: IT" \
  -d '{"sport":"football","market":"1X2","pick":"HOME","odds":2.0}' | python3 -m json.tool
# expected: options[].url starts with https://stake.it/

curl -s -X POST http://localhost:3000/api/bet-links \
  -H "content-type: application/json" -H "x-vercel-ip-country: US" \
  -d '{"sport":"football","market":"1X2","pick":"HOME","odds":2.0}' | python3 -m json.tool
# expected: https://stake.us/

curl -s -X POST http://localhost:3000/api/bet-links \
  -H "content-type: application/json" -H "x-vercel-ip-country: FR" \
  -d '{"sport":"football","market":"1X2","pick":"HOME","odds":2.0}' | python3 -m json.tool
# expected: https://stake.com/ (default)
```

## Go-live (GATED — not part of code tasks)

Production activation is a separate, **human-APPROVE-gated** step (money + gambling): set the prod env vars (`SPORTSBOOK_LINKS_ENABLED`, `SPORTSBOOK_GEO_ALLOWLIST`, the real `SPORTSBOOK_<BOOK>_URLS` with **licensed** regional domains + affiliate codes) — Andrea owns legal clearance. Rollback = `SPORTSBOOK_LINKS_ENABLED=false` (no deploy needed). Update memory `project_sportsbook_affiliate_links` at go-live.

---

## Self-Review

- **Spec coverage:** §4.1 type → Task 1; §4.2 registry → Task 2; §4.3 resolveBaseUrl+buildBetUrl → Task 3; §4.4 route → Task 4; §6 fallback (default/baseUrl/case-insensitive/missing) → Task 3 tests; §8 testing → Tasks 2-3; §5 env + §7 legal + §9 rollback → "Go-live" + "Manual verification" sections. Covered.
- **Placeholders:** none — every step has exact code/commands.
- **Type consistency:** `regionalUrls?: Record<string,string>` (Task 1) matches `parseUrlMap` return (Task 2) and `resolveBaseUrl` access (Task 3); `buildBetUrl(book, sel, country?)` signature matches the Task 4 call site.
</content>
