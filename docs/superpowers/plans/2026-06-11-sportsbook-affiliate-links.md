# Sportsbook Affiliate Links — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CTA "Piazza scommessa" sulle card/Match Builder che apre un dropdown di sportsbook affiliati (Stake/Roobet), con link in uscita affiliati, geo-gate server-side e default OFF.

**Architecture:** Logica pura in `lib/sportsbooks/` (registry da env + adapter per-book + resolver con geo-gate). Una route `/api/bet-links` espone enablement (GET) e opzioni-link per una selezione (POST), leggendo la geo da `x-vercel-ip-country`. Un client component `PlaceBetMenu` mostra il CTA solo se abilitato e fa fetch lazy delle opzioni all'apertura. Noi non gestiamo mai fondi né scommesse.

**Tech Stack:** Next.js (App Router), React client components, TypeScript, test con `tsx` + `node:assert/strict` (pattern esistente in `tests/`).

**Spec di riferimento:** `docs/superpowers/specs/2026-06-11-sportsbook-affiliate-links-design.md`

**⚠️ Gate:** feature di promozione gambling, legale rimandato (decisione Andrea 2026-06-11). Default OFF cablato. Il deploy e il flip `ENABLED=true`/`ALLOWLIST=*` richiedono PROPOSAL + `APPROVE #id` umano su `ch_deploy_gate`. Questo piano copre solo build+test.

---

## File Structure

| File | Responsabilità |
|------|----------------|
| `lib/sportsbooks/types.ts` | Tipi condivisi (`BetSelection`, `Sportsbook`, `BuildResult`, `BookAdapter`, `BetLinkOption`, `SportsbookId`) |
| `lib/sportsbooks/url.ts` | `joinUrl(base, path?)` — join URL preservando la query string |
| `lib/sportsbooks/adapters/landing.ts` | `landingAdapter` — v1: landing su sezione sport del book (`prefilled:false`) |
| `lib/sportsbooks/adapters/stake.ts` | `stakeAdapter` (= landing in v1; seam per deep-link futuro) |
| `lib/sportsbooks/adapters/roobet.ts` | `roobetAdapter` (= landing in v1) |
| `lib/sportsbooks/registry.ts` | `allSportsbooks()` — costruisce i book dai env, esclude i non configurati |
| `lib/sportsbooks/index.ts` | `linksEnabled()`, `geoAllowed()`, `resolveBooks()`, `buildBetUrl()` (geo-gate) |
| `app/api/bet-links/route.ts` | GET → `{enabled}`; POST `{selection}` → `{options}` (geo da header) |
| `components/PlaceBetMenu.tsx` | Client: CTA + dropdown, fetch lazy opzioni, track click |
| `app/api/track/route.ts` | +`"sportsbook_click"` in `ALLOWED_EVENTS` (modifica) |
| `app/page.tsx` | Gate `betLinksEnabled` + render `<PlaceBetMenu>` su card football/tennis (modifica) |
| `.env.example` | Documentazione nuove variabili |
| `tests/sportsbooks-*.test.ts` | Unit test logica pura |

---

## Task 1: Tipi + helper URL

**Files:**
- Create: `lib/sportsbooks/types.ts`
- Create: `lib/sportsbooks/url.ts`
- Test: `tests/sportsbooks-url.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// tests/sportsbooks-url.test.ts
import assert from "node:assert/strict";
import { joinUrl } from "../lib/sportsbooks/url";

// nessun path -> base invariata
assert.equal(joinUrl("https://stake.com"), "https://stake.com");
assert.equal(joinUrl("https://stake.com/", undefined), "https://stake.com/");

// path semplice, normalizza gli slash
assert.equal(joinUrl("https://stake.com/", "sports/soccer"), "https://stake.com/sports/soccer");
assert.equal(joinUrl("https://stake.com", "/sports/soccer"), "https://stake.com/sports/soccer");

// preserva la query string (codice affiliato già nella baseUrl)
assert.equal(
  joinUrl("https://stake.com/?c=ABC", "sports/soccer"),
  "https://stake.com/sports/soccer?c=ABC",
);

console.log("sportsbooks-url ok");
```

- [ ] **Step 2: Esegui il test e verifica che fallisce**

Run: `npx tsx tests/sportsbooks-url.test.ts`
Expected: FAIL — `Cannot find module '../lib/sportsbooks/url'`

- [ ] **Step 3: Crea i tipi**

```ts
// lib/sportsbooks/types.ts
export type SportsbookId = "stake" | "roobet";

export type BetSport = "football" | "tennis" | "worldcup";

export type BetSelection = {
  sport: BetSport;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  market: string;
  pick: string;
  odds: number | null;
  eventStartUtc?: string;
};

export type BuildResult = { url: string; prefilled: boolean };

export type Sportsbook = {
  id: SportsbookId;
  name: string;
  logo: string;
  affiliateCode: string;
  baseUrl: string;
  // path opzionali per-sport forniti dall'operatore (route verificate dall'operatore,
  // non fabbricate qui). Es: { football: "sports/soccer" }
  sportPaths?: Partial<Record<BetSport, string>>;
  adapter: BookAdapter;
};

export type BookAdapter = (sel: BetSelection, book: Sportsbook) => BuildResult;

// payload serializzabile passato al client (no funzioni)
export type BetLinkOption = {
  id: SportsbookId;
  name: string;
  logo: string;
  url: string;
  prefilled: boolean;
};
```

- [ ] **Step 4: Implementa `joinUrl`**

```ts
// lib/sportsbooks/url.ts
// Unisce base + path opzionale preservando la query string della base.
// La baseUrl può già contenere il codice affiliato come query (?c=ABC).
export function joinUrl(base: string, path?: string): string {
  if (!path) return base;
  const q = base.indexOf("?");
  const origin = q === -1 ? base : base.slice(0, q);
  const query = q === -1 ? "" : base.slice(q); // include "?"
  const left = origin.replace(/\/+$/, "");
  const right = path.replace(/^\/+/, "");
  return `${left}/${right}${query}`;
}
```

- [ ] **Step 5: Esegui il test e verifica che passa**

Run: `npx tsx tests/sportsbooks-url.test.ts`
Expected: PASS — stampa `sportsbooks-url ok`, exit 0

- [ ] **Step 6: Commit**

```bash
git add lib/sportsbooks/types.ts lib/sportsbooks/url.ts tests/sportsbooks-url.test.ts
git commit -m "feat(sportsbooks): tipi condivisi + helper joinUrl"
```

---

## Task 2: Landing adapter

**Files:**
- Create: `lib/sportsbooks/adapters/landing.ts`
- Test: `tests/sportsbooks-adapter.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// tests/sportsbooks-adapter.test.ts
import assert from "node:assert/strict";
import { landingAdapter } from "../lib/sportsbooks/adapters/landing";
import type { Sportsbook, BetSelection } from "../lib/sportsbooks/types";

const baseBook: Sportsbook = {
  id: "stake", name: "Stake", logo: "/logos/stake.svg",
  affiliateCode: "ABC", baseUrl: "https://stake.com/?c=ABC",
  adapter: landingAdapter,
};
const sel: BetSelection = { sport: "football", market: "1X2", pick: "HOME", odds: null };

// senza sportPaths -> baseUrl invariata, prefilled false
{
  const r = landingAdapter(sel, baseBook);
  assert.equal(r.url, "https://stake.com/?c=ABC");
  assert.equal(r.prefilled, false);
}

// con sportPaths -> landing su sezione sport, query preservata
{
  const book: Sportsbook = { ...baseBook, sportPaths: { football: "sports/soccer" } };
  const r = landingAdapter(sel, book);
  assert.equal(r.url, "https://stake.com/sports/soccer?c=ABC");
  assert.equal(r.prefilled, false); // landing != betslip pieno (onesto)
}

console.log("sportsbooks-adapter ok");
```

- [ ] **Step 2: Esegui e verifica fallimento**

Run: `npx tsx tests/sportsbooks-adapter.test.ts`
Expected: FAIL — modulo `landing` inesistente

- [ ] **Step 3: Implementa il landing adapter**

```ts
// lib/sportsbooks/adapters/landing.ts
import { joinUrl } from "../url";
import type { BookAdapter } from "../types";

// v1 best-effort: porta l'utente sulla sezione sport configurata dall'operatore.
// NON è un betslip precompilato -> prefilled resta false (onestà: Costruito != Verificato).
// Il deep-link al betslip pieno richiede il reverse-engineering del bet-code (fuori scope v1).
export const landingAdapter: BookAdapter = (sel, book) => ({
  url: joinUrl(book.baseUrl, book.sportPaths?.[sel.sport]),
  prefilled: false,
});
```

- [ ] **Step 4: Esegui e verifica successo**

Run: `npx tsx tests/sportsbooks-adapter.test.ts`
Expected: PASS — `sportsbooks-adapter ok`

- [ ] **Step 5: Commit**

```bash
git add lib/sportsbooks/adapters/landing.ts tests/sportsbooks-adapter.test.ts
git commit -m "feat(sportsbooks): landing adapter best-effort per-sport"
```

---

## Task 3: Adapter Stake e Roobet

**Files:**
- Create: `lib/sportsbooks/adapters/stake.ts`
- Create: `lib/sportsbooks/adapters/roobet.ts`
- Test: `tests/sportsbooks-books.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// tests/sportsbooks-books.test.ts
import assert from "node:assert/strict";
import { stakeAdapter } from "../lib/sportsbooks/adapters/stake";
import { roobetAdapter } from "../lib/sportsbooks/adapters/roobet";
import type { Sportsbook, BetSelection } from "../lib/sportsbooks/types";

const sel: BetSelection = { sport: "football", market: "1X2", pick: "HOME", odds: null };

const stake: Sportsbook = {
  id: "stake", name: "Stake", logo: "/logos/stake.svg",
  affiliateCode: "ABC", baseUrl: "https://stake.com/?c=ABC", adapter: stakeAdapter,
};
const roobet: Sportsbook = {
  id: "roobet", name: "Roobet", logo: "/logos/roobet.svg",
  affiliateCode: "XYZ", baseUrl: "https://roobet.com/?ref=XYZ", adapter: roobetAdapter,
};

const rs = stakeAdapter(sel, stake);
assert.ok(rs.url.includes("stake.com"));
assert.ok(rs.url.includes("ABC"));
assert.equal(rs.prefilled, false);

const rr = roobetAdapter(sel, roobet);
assert.ok(rr.url.includes("roobet.com"));
assert.ok(rr.url.includes("XYZ"));
assert.equal(rr.prefilled, false);

console.log("sportsbooks-books ok");
```

- [ ] **Step 2: Esegui e verifica fallimento**

Run: `npx tsx tests/sportsbooks-books.test.ts`
Expected: FAIL — moduli stake/roobet inesistenti

- [ ] **Step 3: Implementa gli adapter (thin, sul seam)**

```ts
// lib/sportsbooks/adapters/stake.ts
import { landingAdapter } from "./landing";
import type { BookAdapter } from "../types";

// Stake v1 = landing adapter. Futuro: sostituire con un builder di deep-link al
// betslip quando la route bet-code/share-link di Stake sarà verificata (allora
// prefilled potrà diventare true). Il seam vive qui, isolato dagli altri book.
export const stakeAdapter: BookAdapter = landingAdapter;
```

```ts
// lib/sportsbooks/adapters/roobet.ts
import { landingAdapter } from "./landing";
import type { BookAdapter } from "../types";

// Roobet v1 = landing adapter (nessun deep-link sportsbook ufficiale noto).
export const roobetAdapter: BookAdapter = landingAdapter;
```

- [ ] **Step 4: Esegui e verifica successo**

Run: `npx tsx tests/sportsbooks-books.test.ts`
Expected: PASS — `sportsbooks-books ok`

- [ ] **Step 5: Commit**

```bash
git add lib/sportsbooks/adapters/stake.ts lib/sportsbooks/adapters/roobet.ts tests/sportsbooks-books.test.ts
git commit -m "feat(sportsbooks): adapter Stake e Roobet"
```

---

## Task 4: Registry da env

**Files:**
- Create: `lib/sportsbooks/registry.ts`
- Test: `tests/sportsbooks-registry.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// tests/sportsbooks-registry.test.ts
import assert from "node:assert/strict";

// env PRIMA dell'import (i moduli leggono process.env a runtime nelle funzioni)
process.env.SPORTSBOOK_STAKE_URL = "https://stake.com/?c=ABC";
process.env.SPORTSBOOK_STAKE_CODE = "ABC";
process.env.SPORTSBOOK_STAKE_PATHS = '{"football":"sports/soccer"}';
delete process.env.SPORTSBOOK_ROOBET_URL; // non configurato -> escluso

const { allSportsbooks } = await import("../lib/sportsbooks/registry");

const books = allSportsbooks();
assert.equal(books.length, 1);
assert.equal(books[0].id, "stake");
assert.equal(books[0].baseUrl, "https://stake.com/?c=ABC");
assert.deepEqual(books[0].sportPaths, { football: "sports/soccer" });

console.log("sportsbooks-registry ok");
```

- [ ] **Step 2: Esegui e verifica fallimento**

Run: `npx tsx tests/sportsbooks-registry.test.ts`
Expected: FAIL — modulo `registry` inesistente

- [ ] **Step 3: Implementa il registry**

```ts
// lib/sportsbooks/registry.ts
import { stakeAdapter } from "./adapters/stake";
import { roobetAdapter } from "./adapters/roobet";
import type { Sportsbook, SportsbookId, BookAdapter } from "./types";

function parsePaths(json: string | undefined): Sportsbook["sportPaths"] | undefined {
  if (!json) return undefined;
  try {
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? obj : undefined;
  } catch {
    return undefined;
  }
}

type Spec = {
  id: SportsbookId; name: string; logo: string; adapter: BookAdapter;
  codeEnv: string; urlEnv: string; pathsEnv: string;
};

const SPECS: Spec[] = [
  {
    id: "stake", name: "Stake", logo: "/logos/stake.svg", adapter: stakeAdapter,
    codeEnv: "SPORTSBOOK_STAKE_CODE", urlEnv: "SPORTSBOOK_STAKE_URL", pathsEnv: "SPORTSBOOK_STAKE_PATHS",
  },
  {
    id: "roobet", name: "Roobet", logo: "/logos/roobet.svg", adapter: roobetAdapter,
    codeEnv: "SPORTSBOOK_ROOBET_CODE", urlEnv: "SPORTSBOOK_ROOBET_URL", pathsEnv: "SPORTSBOOK_ROOBET_PATHS",
  },
];

// Un book è incluso SOLO se la sua baseUrl (referral affiliato) è in env.
// Affiliate "da creare": finché manca la URL, il book non viene emesso.
export function allSportsbooks(): Sportsbook[] {
  const out: Sportsbook[] = [];
  for (const s of SPECS) {
    const baseUrl = process.env[s.urlEnv] || "";
    if (!baseUrl) continue;
    out.push({
      id: s.id, name: s.name, logo: s.logo, adapter: s.adapter,
      affiliateCode: process.env[s.codeEnv] || "",
      baseUrl,
      sportPaths: parsePaths(process.env[s.pathsEnv]),
    });
  }
  return out;
}
```

- [ ] **Step 4: Esegui e verifica successo**

Run: `npx tsx tests/sportsbooks-registry.test.ts`
Expected: PASS — `sportsbooks-registry ok`

- [ ] **Step 5: Commit**

```bash
git add lib/sportsbooks/registry.ts tests/sportsbooks-registry.test.ts
git commit -m "feat(sportsbooks): registry book da env"
```

---

## Task 5: Resolver + geo-gate

**Files:**
- Create: `lib/sportsbooks/index.ts`
- Test: `tests/sportsbooks-resolver.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// tests/sportsbooks-resolver.test.ts
import assert from "node:assert/strict";

process.env.SPORTSBOOK_STAKE_URL = "https://stake.com/?c=ABC";
process.env.SPORTSBOOK_STAKE_CODE = "ABC";

const { resolveBooks, buildBetUrl, geoAllowed, linksEnabled } =
  await import("../lib/sportsbooks/index");
const { allSportsbooks } = await import("../lib/sportsbooks/registry");

// default sicuro: master OFF -> nessun book
delete process.env.SPORTSBOOK_LINKS_ENABLED;
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
assert.equal(linksEnabled(), false);
assert.deepEqual(resolveBooks("IT"), []);

// abilitato ma allowlist vuota -> nessun book
process.env.SPORTSBOOK_LINKS_ENABLED = "true";
process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
assert.equal(geoAllowed("IT"), false);
assert.deepEqual(resolveBooks("IT"), []);

// allowlist specifica: dentro lista (case-insensitive) ok, fuori no
process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,MT";
assert.equal(geoAllowed("it"), true);
assert.equal(geoAllowed("US"), false);
assert.equal(resolveBooks("IT").length, 1);
assert.deepEqual(resolveBooks("US"), []);

// globale "*": qualsiasi geo
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
assert.equal(geoAllowed("US"), true);
assert.equal(resolveBooks("US").length, 1);

// buildBetUrl produce un'opzione valida e non lancia mai
const book = allSportsbooks()[0];
const r = buildBetUrl(book, { sport: "football", market: "1X2", pick: "HOME", odds: null });
assert.ok(r.url.includes("stake.com"));
assert.equal(typeof r.prefilled, "boolean");

console.log("sportsbooks-resolver ok");
```

- [ ] **Step 2: Esegui e verifica fallimento**

Run: `npx tsx tests/sportsbooks-resolver.test.ts`
Expected: FAIL — modulo `index` inesistente

- [ ] **Step 3: Implementa resolver + geo-gate**

```ts
// lib/sportsbooks/index.ts
import { allSportsbooks } from "./registry";
import type { Sportsbook, BetSelection, BuildResult } from "./types";

export type { Sportsbook, BetSelection, BuildResult, BetLinkOption, SportsbookId, BetSport } from "./types";

// Master switch. Default: OFF (la feature è inerte finché non la si accende).
export function linksEnabled(): boolean {
  return process.env.SPORTSBOOK_LINKS_ENABLED === "true";
}

// Geo-gate. Lista vuota -> nessuna geo ammessa (default sicuro). "*" -> globale.
export function geoAllowed(country: string | null | undefined): boolean {
  const raw = (process.env.SPORTSBOOK_GEO_ALLOWLIST || "").trim();
  if (!raw) return false;
  if (raw === "*") return true;
  if (!country) return false;
  const set = new Set(
    raw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
  );
  return set.has(country.toUpperCase());
}

// Book ammessi per una geo. [] se master OFF o geo non ammessa.
export function resolveBooks(country: string | null | undefined): Sportsbook[] {
  if (!linksEnabled()) return [];
  if (!geoAllowed(country)) return [];
  return allSportsbooks();
}

// Costruisce l'URL in uscita; non lancia mai (fallback alla baseUrl affiliata).
export function buildBetUrl(book: Sportsbook, sel: BetSelection): BuildResult {
  try {
    return book.adapter(sel, book);
  } catch {
    return { url: book.baseUrl, prefilled: false };
  }
}
```

- [ ] **Step 4: Esegui e verifica successo**

Run: `npx tsx tests/sportsbooks-resolver.test.ts`
Expected: PASS — `sportsbooks-resolver ok`

- [ ] **Step 5: Commit**

```bash
git add lib/sportsbooks/index.ts tests/sportsbooks-resolver.test.ts
git commit -m "feat(sportsbooks): resolver con geo-gate e default OFF"
```

---

## Task 6: Evento di tracking `sportsbook_click`

**Files:**
- Modify: `app/api/track/route.ts` (set `ALLOWED_EVENTS`)

- [ ] **Step 1: Aggiungi l'evento all'allowlist**

In `app/api/track/route.ts`, nel `Set` `ALLOWED_EVENTS`, aggiungi `"sportsbook_click"`. Risultato atteso della riga finale del set:

```ts
const ALLOWED_EVENTS = new Set([
  "page_view", "tab_click", "plan_view", "language_change", "theme_change",
  "conversion", "partner_click", "mb_link_copied",
  "operator_sidebar_click", "sportsbook_sidebar_click", "sportsbook_click",
]);
```

- [ ] **Step 2: Verifica build + presenza (no harness DB-free per questa route)**

Run: `npm run build`
Expected: build OK.
Run: `grep -q '"sportsbook_click"' app/api/track/route.ts && echo PRESENT`
Expected: `PRESENT`

> Nota onesta: la route `/api/track` scrive su DB e nel repo non ha un test unit DB-free; la verifica funzionale completa avviene nel test manuale/QA (Task 10), non qui.

- [ ] **Step 3: Commit**

```bash
git add app/api/track/route.ts
git commit -m "feat(track): consenti evento sportsbook_click"
```

---

## Task 7: API `/api/bet-links` (enablement + opzioni)

**Files:**
- Create: `app/api/bet-links/route.ts`

> Nota: questa route importa `next/server` quindi NON è testabile a freddo con `tsx`. La logica sottostante (`resolveBooks`/`buildBetUrl`/geo-gate) è già coperta dai test unit del Task 5. Qui verifichiamo via build + curl manuale (Task 10).

- [ ] **Step 1: Crea la route**

```ts
// app/api/bet-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveBooks, buildBetUrl } from "@/lib/sportsbooks";
import type { BetSelection, BetLinkOption } from "@/lib/sportsbooks/types";

export const dynamic = "force-dynamic";

// GET: enablement per la geo dell'utente (decide se mostrare il CTA).
export async function GET(req: NextRequest) {
  const country = req.headers.get("x-vercel-ip-country");
  const enabled = resolveBooks(country).length > 0;
  return NextResponse.json({ enabled });
}

// POST: opzioni-link per una selezione. Geo-gate applicato in resolveBooks.
export async function POST(req: NextRequest) {
  const country = req.headers.get("x-vercel-ip-country");
  let sel: BetSelection;
  try {
    sel = (await req.json()) as BetSelection;
  } catch {
    return NextResponse.json({ options: [] });
  }
  const options: BetLinkOption[] = resolveBooks(country).map((b) => {
    const { url, prefilled } = buildBetUrl(b, sel);
    return { id: b.id, name: b.name, logo: b.logo, url, prefilled };
  });
  return NextResponse.json({ options });
}
```

- [ ] **Step 2: Verifica build**

Run: `npm run build`
Expected: build OK, route `/api/bet-links` compilata.

- [ ] **Step 3: Commit**

```bash
git add app/api/bet-links/route.ts
git commit -m "feat(api): /api/bet-links enablement + opzioni con geo-gate"
```

---

## Task 8: Componente `PlaceBetMenu`

**Files:**
- Create: `components/PlaceBetMenu.tsx`

> Nota: nessun runner di test React nel repo → verifica via build + lint + visual check (Task 10). Pattern client component come `components/world-cup/*` (`"use client"`).

- [ ] **Step 1: Crea il componente**

```tsx
// components/PlaceBetMenu.tsx
"use client";

import { useState } from "react";
import type { BetSelection, BetLinkOption } from "@/lib/sportsbooks/types";

// CTA "Piazza scommessa" + dropdown dei book affiliati.
// Mostrato dal parent SOLO quando betLinksEnabled è true (geo-gate server-side).
// Le opzioni sono caricate lazy all'apertura. Noi non gestiamo mai fondi/scommesse.
export function PlaceBetMenu({
  selection,
  label,
}: {
  selection: BetSelection;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<BetLinkOption[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && options === null && !loading) {
      setLoading(true);
      try {
        const res = await fetch("/api/bet-links", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(selection),
        });
        const json = (await res.json()) as { options?: BetLinkOption[] };
        setOptions(Array.isArray(json.options) ? json.options : []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }
  }

  // analytics beacon fire-and-forget: non blocca mai la navigazione.
  function track(book: string) {
    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_type: "sportsbook_click",
        meta: { book, sport: selection.sport },
      }),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <div className="place-bet-menu">
      <button
        type="button"
        className="bonus-cta place-bet-cta"
        onClick={toggle}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div className="place-bet-dropdown" role="menu">
          {loading && <span className="place-bet-loading">…</span>}
          {options?.map((o) => (
            <a
              key={o.id}
              role="menuitem"
              className="place-bet-option"
              href={o.url}
              target="_blank"
              rel="nofollow sponsored noopener"
              onClick={() => track(o.id)}
            >
              <img src={o.logo} alt="" className="place-bet-logo" width={20} height={20} />
              <span>{o.name}</span>
            </a>
          ))}
          {options !== null && options.length === 0 && !loading && (
            <span className="place-bet-empty">—</span>
          )}
          <p className="place-bet-disclaimer">
            18+ · {`Gioca responsabilmente · *Link affiliato — potremmo ricevere una commissione, senza costi per te.`}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Aggiungi gli stili minimi**

Individua il foglio di stile globale (quello che definisce `.bonus-cta` / `.sportsbook-board`):
Run: `grep -rln "\.bonus-cta" app/*.css app/**/*.css 2>/dev/null`
Aggiungi in fondo a quel file:

```css
.place-bet-menu { position: relative; display: inline-block; }
.place-bet-dropdown {
  position: absolute; z-index: 20; margin-top: 6px; min-width: 200px;
  display: flex; flex-direction: column; gap: 4px; padding: 8px;
  background: var(--surface, #15161a); border: 1px solid var(--border, #2a2c33);
  border-radius: 10px;
}
.place-bet-option {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border-radius: 8px; text-decoration: none; color: inherit;
}
.place-bet-option:hover { background: rgba(255,255,255,0.06); }
.place-bet-logo { border-radius: 4px; object-fit: contain; }
.place-bet-disclaimer { margin: 6px 2px 0; font-size: 10px; opacity: 0.6; }
.place-bet-empty, .place-bet-loading { padding: 8px 10px; opacity: 0.6; }
```

- [ ] **Step 3: Verifica build + lint**

Run: `npm run build && npm run lint`
Expected: nessun errore di tipo/lint sul nuovo file.

- [ ] **Step 4: Commit**

```bash
git add components/PlaceBetMenu.tsx app/globals.css
git commit -m "feat(ui): componente PlaceBetMenu (CTA + dropdown affiliati)"
```

> Se il file CSS individuato allo Step 2 non è `app/globals.css`, sostituisci il path nel `git add`.

---

## Task 9: Aggancio in `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Importa il componente**

In cima a `app/page.tsx`, accanto agli import di componenti esistenti (es. riga 13 `import { SportGlyphSprite } from "./components/sport-glyphs";`), aggiungi:

```ts
import { PlaceBetMenu } from "@/components/PlaceBetMenu";
```

- [ ] **Step 2: Aggiungi lo stato di enablement nel componente di pagina**

Tra gli `useState`/`useEffect` di primo livello del componente esportato di default, aggiungi:

```ts
const [betLinksEnabled, setBetLinksEnabled] = useState(false);
useEffect(() => {
  let alive = true;
  fetch("/api/bet-links")
    .then((r) => r.json())
    .then((j: { enabled?: boolean }) => { if (alive) setBetLinksEnabled(Boolean(j.enabled)); })
    .catch(() => {});
  return () => { alive = false; };
}, []);
```

(Se `useEffect` non è già importato da `react`, aggiungilo all'import esistente di `react`.)

- [ ] **Step 3: Renderizza il CTA sulla card football**

In `app/page.tsx`, subito DOPO il blocco CTA affiliate football (attorno a riga 3211, `{p.affiliate && ( ... )}`), aggiungi:

```tsx
{betLinksEnabled && (
  <PlaceBetMenu
    label={lang === "it" ? "Piazza scommessa" : "Place bet"}
    selection={{
      sport: p.league === "WC" ? "worldcup" : "football",
      league: p.league,
      homeTeam: p.home_team,
      awayTeam: p.away_team,
      market: "1X2",
      pick: p.pick ?? p.best_selection ?? "",
      odds: null,
      eventStartUtc: p.kickoff,
    }}
  />
)}
```

- [ ] **Step 4: Renderizza il CTA sulla card tennis**

In `app/page.tsx`, subito DOPO il blocco CTA affiliate tennis (attorno a riga 3585, `{m.affiliate && ( ... )}`), aggiungi:

```tsx
{betLinksEnabled && (
  <PlaceBetMenu
    label={lang === "it" ? "Piazza scommessa" : "Place bet"}
    selection={{
      sport: "tennis",
      market: "MO",
      pick: m.pick ?? m.best_selection ?? "",
      odds: null,
    }}
  />
)}
```

- [ ] **Step 5: Verifica build + lint**

Run: `npm run build && npm run lint`
Expected: nessun errore. (Se TS lamenta `m.best_selection`/`m.pick` non esistenti sul tipo tennis, usa solo i campi presenti nel tipo del match tennis: lascia `pick: m.pick ?? ""`.)

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat(page): CTA Piazza scommessa su card football/tennis (gated)"
```

---

## Task 10: env.example + verifica end-to-end

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Documenta le variabili in `.env.example`**

Aggiungi in fondo a `.env.example`:

```bash
# ── Sportsbook affiliate links ("Piazza scommessa") ──────────────────────────
# Default OFF: feature inerte finché non viene accesa deliberatamente.
# Il flip a true / "*" richiede APPROVE umano su ch_deploy_gate (gate gambling).
SPORTSBOOK_LINKS_ENABLED=false
# CSV di country code ISO (es. "MT,CW") oppure "*" per globale. Vuoto = nessuno.
SPORTSBOOK_GEO_ALLOWLIST=
# Referral URL affiliato (codice già incluso) + codice (per tracking) + path per-sport (JSON opzionale).
SPORTSBOOK_STAKE_URL=
SPORTSBOOK_STAKE_CODE=
SPORTSBOOK_STAKE_PATHS=
SPORTSBOOK_ROOBET_URL=
SPORTSBOOK_ROOBET_CODE=
SPORTSBOOK_ROOBET_PATHS=
```

- [ ] **Step 2: Esegui tutta la suite unit nuova**

Run:
```bash
for f in url adapter books registry resolver; do npx tsx tests/sportsbooks-$f.test.ts || exit 1; done
```
Expected: 5 righe `... ok`, exit 0.

- [ ] **Step 3: Verifica manuale della route (dev) — geo-gate**

Run: `npm run dev` (in un terminale). In un altro:
```bash
# default OFF -> enabled:false
curl -s localhost:3000/api/bet-links | grep -q '"enabled":false' && echo "OFF ok"
```
Poi con env accesi (file `.env.local` temporaneo: `SPORTSBOOK_LINKS_ENABLED=true`, `SPORTSBOOK_GEO_ALLOWLIST=*`, `SPORTSBOOK_STAKE_URL=https://stake.com/?c=TEST`), riavvia dev e:
```bash
curl -s -X POST localhost:3000/api/bet-links -H 'content-type: application/json' \
  -d '{"sport":"football","market":"1X2","pick":"HOME","odds":null}' | grep -q 'stake.com' && echo "ON ok"
```
Expected: `OFF ok` poi `ON ok`. **Rimuovi `.env.local` di test dopo.**

- [ ] **Step 4: Visual check da loggato** (regola UI repo)

Con env di test accesi, carica la home da browser **loggato** (cookie reali, non anonimo): apri una card football e una tennis, clicca "Piazza scommessa", verifica il dropdown (Stake/Roobet, disclaimer 18+), responsive, e che le CTA affiliate esistenti NON siano regredite. Con env OFF: il CTA NON deve comparire.

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "docs(env): variabili sportsbook affiliate links"
```

---

## Verifica finale (criteri di successo)

- [ ] 5/5 test unit `sportsbooks-*.test.ts` passano.
- [ ] `npm run build` e `npm run lint` puliti.
- [ ] `/api/bet-links` GET ritorna `enabled:false` con default (geo-gate OFF).
- [ ] Con env accesi, POST ritorna opzioni con URL affiliati; CTA visibile e dropdown funzionante (visual check da loggato).
- [ ] Con env OFF, nessun CTA renderizzato.
- [ ] `lib/affiliate.ts` e le CTA bonus esistenti invariate (nessuna regressione).

## Percorso post-implementazione (NON parte di questo piano)

PROPOSAL con change-spec su `ch_deploy_gate` → `APPROVE #id` umano (Andrea/Michele) → deploy. Flip `SPORTSBOOK_LINKS_ENABLED=true` / `SPORTSBOOK_GEO_ALLOWLIST` = decisione umana separata, raccomandata dopo revisione legale.
