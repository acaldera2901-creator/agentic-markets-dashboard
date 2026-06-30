# FortunePlay Live Odds + Deep-link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrare la quota live FortunePlay sulle card (calcio/tennis/WC), con edge ricalcolato vs FortunePlay, e trasformare "Place bet" in un deep-link alla pagina-partita FortunePlay.

**Architecture:** Endpoint server `/api/fortuneplay-odds` che scarica la lista BetConstruct una volta (TTL-cache ~30s) e ritorna le quote indicizzate per `team_pair_key`. Il FE fa fetch parallelo (interval ~30s) e fa merge per `team_pair_key` su card calcio e tennis. Entrambe le chiavi di join (lato predizione e lato FortunePlay) sono calcolate in TypeScript con lo stesso `normName`/`canonicalPlayerKey` → consistenza interna, nessuna dipendenza dal path Python→DB.

**Tech Stack:** Next.js App Router (route handlers), TypeScript, `tsx` per i test (`node:assert/strict`), `fetch` nativo.

## Global Constraints

- **Tag**: tutti i commit/PR includono `#FORTUNEPLAY-LIVE-ODDS-1`.
- **Surgical**: non toccare modello di prediction, `match_predictions`, scraper Python→`odds_snapshots`, adapter Stake/Roobet, registry multi-book.
- **Degradazione pulita**: se l'endpoint fallisce o una partita non è nel feed FortunePlay, la card resta ESATTAMENTE come oggi (landing link, nessuna riga FP). Mai regressione.
- **Anti-hammering**: MAI una chiamata FortunePlay per-card. Un solo fetch lista server-side con TTL-cache, `_MAX_PAGES` cap = 20, header identici allo scraper Python.
- **Copy FTC**: niente "batti il bookmaker"/"profitto garantito"/"vinci". Linguaggio probabilistico ("value indicativo del modello rispetto alla quota FortunePlay") + disclaimer +18. **Review legale obbligatoria** prima del go-live (gate).
- **Odds BetConstruct**: intero ÷ 1000 (1600 → 1.60). Parse mercati **per posizione**, mai per nome (localizzato).
- **Test runner**: `npx tsx tests/<file>.test.ts` (i test sono file standalone con `node:assert/strict`; non c'è npm script `test`).
- **Gate**: task medium/high-risk → nessun deploy senza PROPOSAL + APPROVE umano + OK legale. Il piano costruisce e verifica in locale; NON deploya.

---

### Task 1: Port tennis canonical key in TS

**Files:**
- Create: `lib/tennis-names.ts`
- Test: `tests/tennis-names.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `cleanPlayerName(raw: string | null): string`, `canonicalPlayerKey(raw: string | null): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tennis-names.test.ts
import assert from "node:assert/strict";
import { cleanPlayerName, canonicalPlayerKey } from "../lib/tennis-names";

// rimuove seeding, nazione, score-suffix
assert.equal(cleanPlayerName("Djokovic N. (1)"), "Djokovic N.");
assert.equal(cleanPlayerName("Carlos Alcaraz (ESP)"), "Carlos Alcaraz");
assert.equal(cleanPlayerName("Sinner J. 6-4 7-5"), "Sinner J.");
assert.equal(cleanPlayerName(null), "");

// canonical: lowercase, no diacritici, no punteggiatura, trattini→spazi
assert.equal(canonicalPlayerKey("Novak Djokovic"), "novak djokovic");
assert.equal(canonicalPlayerKey("Stefanos Tsitsipas"), "stefanos tsitsipas");
assert.equal(canonicalPlayerKey("Jean-Pierre Müller"), "jean pierre muller");
assert.equal(canonicalPlayerKey(null), "");

console.log("tennis-names OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/tennis-names.test.ts`
Expected: FAIL (modulo `../lib/tennis-names` non esiste).

- [ ] **Step 3: Write minimal implementation** (porting di `core/tennis_names.py`)

```ts
// lib/tennis-names.ts
// Port TS di core/tennis_names.py (#FORTUNEPLAY-LIVE-ODDS-1). I feed divergono su
// punteggiatura, seed, nazione e score-suffix: chiavi canoniche per il lookup.
const SEEDING = /\(\d+\)\s*/g;
const NATION = /\([A-Z]{2,3}\)/g;
const SCORE_SUFFIX =
  /\s+\d+(?:[-–]\d+)?(?:\(\d+\))?(?:\s+\d+(?:[-–]\d+)?(?:\(\d+\))?)*(?:\s+(?:ret|w\/o|wo|walkover))?\s*$/i;
const PUNCT = /[^a-z0-9\s]/g;

export function cleanPlayerName(raw: string | null): string {
  if (!raw) return "";
  let name = String(raw);
  name = name.replace(SEEDING, "");
  name = name.replace(NATION, "");
  name = name.replace(SCORE_SUFFIX, "");
  name = name.replace(/\s+/g, " ");
  return name.replace(/^[\s\-–]+|[\s\-–]+$/g, "");
}

export function canonicalPlayerKey(raw: string | null): string {
  let name = cleanPlayerName(raw);
  name = name.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  name = name.toLowerCase().replace(/-/g, " ");
  name = name.replace(PUNCT, " ");
  return name.replace(/\s+/g, " ").trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/tennis-names.test.ts`
Expected: `tennis-names OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/tennis-names.ts tests/tennis-names.test.ts
git commit -m "feat(tennis): port canonical player key in TS (#FORTUNEPLAY-LIVE-ODDS-1)"
```

---

### Task 2: `teamPairKey` — chiave di join calcio/tennis in TS

**Files:**
- Create: `lib/team-pair-key.ts`
- Test: `tests/team-pair-key.test.ts`

**Interfaces:**
- Consumes: `normName` da `lib/odds-api.ts`, `canonicalPlayerKey` da `lib/tennis-names.ts` (Task 1).
- Produces: `teamPairKey(sport: "soccer" | "tennis", a: string, b: string, commenceIso: string | null): string | null`.

Replica `core/sportsbook/common.py::_pair_key`: `YYYY-MM-DD:keyA|keyB` con le due chiavi **ordinate** alfabeticamente. Calcio → `normName`; tennis → `canonicalPlayerKey`. Data = primi 10 char dell'ISO **UTC**. `null` se manca la data o un nome.

- [ ] **Step 1: Write the failing test**

```ts
// tests/team-pair-key.test.ts
import assert from "node:assert/strict";
import { teamPairKey } from "../lib/team-pair-key";

// calcio: nomi normalizzati (FC strippato), ordinati, prefisso data
assert.equal(
  teamPairKey("soccer", "FC Internazionale", "AC Milan", "2026-07-01T18:00:00Z"),
  "2026-07-01:internazionale|milan"
);
// ordine indipendente dall'input
assert.equal(
  teamPairKey("soccer", "AC Milan", "FC Internazionale", "2026-07-01T18:00:00Z"),
  "2026-07-01:internazionale|milan"
);
// tennis: canonical key
assert.equal(
  teamPairKey("tennis", "Novak Djokovic", "Carlos Alcaraz (ESP)", "2026-07-01T12:00:00Z"),
  "2026-07-01:carlos alcaraz|novak djokovic"
);
// data mancante → null
assert.equal(teamPairKey("soccer", "A", "B", null), null);

console.log("team-pair-key OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/team-pair-key.test.ts`
Expected: FAIL (modulo non esiste).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/team-pair-key.ts
// Chiave di join odds↔predizione (#FORTUNEPLAY-LIVE-ODDS-1). Replica TS di
// core/sportsbook/common.py::_pair_key. Calcolata su entrambi i lati in TS →
// consistenza interna (nessuna dipendenza dal path Python→DB).
import { normName } from "./odds-api";
import { canonicalPlayerKey } from "./tennis-names";

export function teamPairKey(
  sport: "soccer" | "tennis",
  a: string,
  b: string,
  commenceIso: string | null
): string | null {
  if (!commenceIso || !a || !b) return null;
  const day = commenceIso.slice(0, 10);
  if (day.length !== 10) return null;
  const key = (n: string) => (sport === "tennis" ? canonicalPlayerKey(n) : normName(n));
  const ka = key(a);
  const kb = key(b);
  if (!ka || !kb) return null;
  const [x, y] = [ka, kb].sort();
  return `${day}:${x}|${y}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/team-pair-key.test.ts`
Expected: `team-pair-key OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/team-pair-key.ts tests/team-pair-key.test.ts
git commit -m "feat(odds): teamPairKey join calcio/tennis in TS (#FORTUNEPLAY-LIVE-ODDS-1)"
```

---

### Task 3: Parse del feed FortunePlay + edge helper

**Files:**
- Create: `lib/fortuneplay-live.ts` (solo parse + tipi + edge in questo task; il fetch in Task 4)
- Create: `tests/fixtures/fortuneplay-sample.json` (catturato dal vivo)
- Test: `tests/fortuneplay-live.test.ts`

**Interfaces:**
- Consumes: `teamPairKey` (Task 2).
- Produces:
  - tipo `FpMatch = { teamPairKey: string; sport: "soccer" | "tennis"; slug: string; id: number; urnId: string; oddsHome: number | null; oddsDraw: number | null; oddsAway: number | null; totalLine: number | null; totalOver: number | null; totalUnder: number | null }`
  - `parseFortuneplayMatches(payload: unknown): FpMatch[]`
  - `fpEdge(pPick: number, oddsDecimal: number | null): number | null` (= `pPick * oddsDecimal - 1`, `null` se odds assente/≤1)

- [ ] **Step 1: Cattura la fixture reale** (read-only, stesso endpoint dello scraper)

```bash
curl -s --max-time 20 \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" \
  -H "Accept: application/json" -H "Origin: https://www.fortuneplay.com" \
  -H "Referer: https://www.fortuneplay.com/it/sports" \
  "https://www.fortuneplay.com/_sb_api/api/v2/matches?bettable=true&match_status=0&match_status=1&sport_type=regular&sort_by=bets_count:desc&limit=5&page=1" \
  > tests/fixtures/fortuneplay-sample.json
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/fortuneplay-live.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFortuneplayMatches, fpEdge } from "../lib/fortuneplay-live";

const payload = JSON.parse(readFileSync("tests/fixtures/fortuneplay-sample.json", "utf8"));
const matches = parseFortuneplayMatches(payload);

// almeno una partita parsata, con i campi chiave valorizzati
assert.ok(matches.length >= 1, "almeno 1 match");
const m = matches[0];
assert.ok(m.teamPairKey && m.teamPairKey.includes(":"), "teamPairKey valido");
assert.ok(typeof m.id === "number" && m.slug.length > 0, "id+slug presenti");
// odds in range decimale plausibile (×1000 → ÷1000)
for (const o of [m.oddsHome, m.oddsAway]) {
  if (o !== null) assert.ok(o > 1 && o < 1000, "odds decimale plausibile");
}
// solo soccer/tennis
assert.ok(matches.every((x) => x.sport === "soccer" || x.sport === "tennis"));

// fpEdge: 0.6 prob * 2.0 quota - 1 = 0.2
assert.equal(fpEdge(0.6, 2.0), 0.2);
assert.equal(fpEdge(0.6, null), null);
assert.equal(fpEdge(0.6, 1.0), null);

console.log("fortuneplay-live parse OK");
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx tsx tests/fortuneplay-live.test.ts`
Expected: FAIL (modulo non esiste).

- [ ] **Step 4: Write minimal implementation** (porta la logica parse di `core/sportsbook/fortuneplay.py`)

```ts
// lib/fortuneplay-live.ts
// Sorgente quote live FortunePlay/BetConstruct (#FORTUNEPLAY-LIVE-ODDS-1).
// Parse PER POSIZIONE (il `name` è localizzato). Odds = intero ÷ 1000.
import { teamPairKey } from "./team-pair-key";

export type FpMatch = {
  teamPairKey: string;
  sport: "soccer" | "tennis";
  slug: string;
  id: number;
  urnId: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  totalLine: number | null;
  totalOver: number | null;
  totalUnder: number | null;
};

const SPORTS = new Set(["soccer", "tennis"]);

function odds(raw: unknown): number | null {
  const v = Number(raw) / 1000;
  return Number.isFinite(v) && v > 1 ? v : null;
}

function parseMatchResult(market: any): [number | null, number | null, number | null] {
  const o = market?.outcomes ?? [];
  if (o.length >= 3) return [odds(o[0]?.odds), odds(o[1]?.odds), odds(o[2]?.odds)];
  if (o.length === 2) return [odds(o[0]?.odds), null, odds(o[1]?.odds)];
  return [null, null, null];
}

function parseTotals(market: any): [number | null, number | null, number | null] {
  const o = market?.outcomes ?? [];
  const spec: string = market?.specifier ?? "";
  if (o.length !== 2 || !spec.includes("hcp=")) return [null, null, null];
  let line: number | null = null;
  for (const part of spec.split("|")) {
    if (part.startsWith("hcp=")) {
      const n = Number(part.split("=")[1]);
      if (!Number.isFinite(n)) return [null, null, null];
      line = n;
      break;
    }
  }
  return [line, odds(o[0]?.odds), odds(o[1]?.odds)];
}

export function parseFortuneplayMatches(payload: unknown): FpMatch[] {
  const data: any[] = (payload as any)?.data ?? [];
  const out: FpMatch[] = [];
  for (const m of data) {
    const sport: string | undefined = m?.tournament?.sport?.key;
    if (!sport || !SPORTS.has(sport)) continue;
    const home: string = m?.competitors?.home?.name ?? "";
    const away: string = m?.competitors?.away?.name ?? "";
    if (!home || !away) continue;
    const [oh, od, oa] = parseMatchResult(m?.main_market);
    if (oh === null && oa === null) continue;
    const key = teamPairKey(sport as "soccer" | "tennis", home, away, m?.start_time ?? null);
    if (!key) continue;
    const [line, over, under] = parseTotals(m?.secondary_market);
    out.push({
      teamPairKey: key,
      sport: sport as "soccer" | "tennis",
      slug: String(m?.slug ?? ""),
      id: Number(m?.id),
      urnId: String(m?.urn_id ?? ""),
      oddsHome: oh, oddsDraw: od, oddsAway: oa,
      totalLine: line, totalOver: over, totalUnder: under,
    });
  }
  return out;
}

export function fpEdge(pPick: number, oddsDecimal: number | null): number | null {
  if (!oddsDecimal || oddsDecimal <= 1) return null;
  return pPick * oddsDecimal - 1;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx tests/fortuneplay-live.test.ts`
Expected: `fortuneplay-live parse OK`.

- [ ] **Step 6: Commit**

```bash
git add lib/fortuneplay-live.ts tests/fortuneplay-live.test.ts tests/fixtures/fortuneplay-sample.json
git commit -m "feat(odds): parse feed FortunePlay + fpEdge in TS (#FORTUNEPLAY-LIVE-ODDS-1)"
```

---

### Task 4: Fetch lista + TTL-cache server-side

**Files:**
- Modify: `lib/fortuneplay-live.ts` (aggiunge fetch+cache)
- Test: `tests/fortuneplay-fetch.test.ts`

**Interfaces:**
- Consumes: `parseFortuneplayMatches` (Task 3).
- Produces: `fetchFortuneplayBoard(now?: number): Promise<Map<string, FpMatch>>` (mappa `teamPairKey → FpMatch`; cache in-memory TTL 30s; mai solleva → `Map` vuota su errore). Parametro `now` opzionale per testare la cache senza orologio reale.

- [ ] **Step 1: Write the failing test** (inietta un fetcher fake via override del modulo)

```ts
// tests/fortuneplay-fetch.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { __setFpFetcherForTest, fetchFortuneplayBoard } from "../lib/fortuneplay-live";

const sample = JSON.parse(readFileSync("tests/fixtures/fortuneplay-sample.json", "utf8"));
let calls = 0;
__setFpFetcherForTest(async () => { calls++; return sample; });

const m1 = await fetchFortuneplayBoard(1000);
assert.ok(m1.size >= 1, "mappa popolata");
assert.equal(calls, 1, "1 fetch");

// entro TTL → cache, nessun nuovo fetch
const m2 = await fetchFortuneplayBoard(1000 + 10_000);
assert.equal(calls, 1, "cache hit entro TTL");

// oltre TTL (30s) → refetch
await fetchFortuneplayBoard(1000 + 31_000);
assert.equal(calls, 2, "refetch oltre TTL");

console.log("fortuneplay-fetch OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/fortuneplay-fetch.test.ts`
Expected: FAIL (`__setFpFetcherForTest`/`fetchFortuneplayBoard` non esistono).

- [ ] **Step 3: Write minimal implementation** (append a `lib/fortuneplay-live.ts`)

```ts
// --- fetch + TTL cache (append in lib/fortuneplay-live.ts) ---
const BASE = "https://www.fortuneplay.com/_sb_api/api/v2/matches";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  Accept: "application/json",
  Origin: "https://www.fortuneplay.com",
  Referer: "https://www.fortuneplay.com/it/sports",
};
const PAGE_LIMIT = 50;
const MAX_PAGES = 20; // cap anti-hammering (come lo scraper Python)
const TTL_MS = 30_000;

type Fetcher = (page: number) => Promise<unknown>;

async function defaultFetcher(page: number): Promise<unknown> {
  const qs = new URLSearchParams({
    bettable: "true", sport_type: "regular", sort_by: "bets_count:desc",
    limit: String(PAGE_LIMIT), page: String(page),
  });
  qs.append("match_status", "0");
  qs.append("match_status", "1");
  const resp = await fetch(`${BASE}?${qs.toString()}`, { headers: HEADERS });
  if (!resp.ok) throw new Error(`fortuneplay HTTP ${resp.status}`);
  return resp.json();
}

let _fetcher: Fetcher = defaultFetcher;
export function __setFpFetcherForTest(f: Fetcher) { _fetcher = f; }

let _cache: { at: number; map: Map<string, FpMatch> } | null = null;

export async function fetchFortuneplayBoard(now = Date.now()): Promise<Map<string, FpMatch>> {
  if (_cache && now - _cache.at < TTL_MS) return _cache.map;
  const map = new Map<string, FpMatch>();
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const payload: any = await _fetcher(page);
      for (const fm of parseFortuneplayMatches(payload)) map.set(fm.teamPairKey, fm);
      const last = payload?.pagination?.last_page ?? page;
      if (page >= last) break;
    }
    _cache = { at: now, map };
  } catch {
    if (_cache) return _cache.map; // su errore, riusa l'ultima buona
  }
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/fortuneplay-fetch.test.ts`
Expected: `fortuneplay-fetch OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/fortuneplay-live.ts tests/fortuneplay-fetch.test.ts
git commit -m "feat(odds): fetch lista FortunePlay + TTL-cache 30s (#FORTUNEPLAY-LIVE-ODDS-1)"
```

---

### Task 5: Deep-link builder pagina-partita FortunePlay

**Files:**
- Create: `lib/fortuneplay-url.ts`
- Modify: `lib/sportsbooks/adapters/fortuneplay.ts`
- Test: `tests/fortuneplay-url.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `buildFortuneplayMatchUrl(opts: { baseUrl: string; locale?: string; slug: string; id: number; code?: string }): string`.

> **STEP 0 — BLOCCANTE (verifica browser):** apri una partita reale su `https://www.fortuneplay.com/it/sports`, copia l'URL della pagina-partita e annota il pattern esatto (usa slug? id? locale? query affiliate?). Aggiorna il template nello `buildFortuneplayMatchUrl` e il `VERIFIED_EXAMPLE` del test col valore reale osservato. Lo unit test sotto verifica l'assemblaggio della stringa; la correttezza del pattern live va confermata nel visual check (Task 8). Pattern atteso BetConstruct (DA CONFERMARE): `{baseUrl}/{locale}/sports/{slug}-{id}`.

- [ ] **Step 1: Write the failing test** (sostituisci `VERIFIED_EXAMPLE` col valore reale dopo lo Step 0)

```ts
// tests/fortuneplay-url.test.ts
import assert from "node:assert/strict";
import { buildFortuneplayMatchUrl } from "../lib/fortuneplay-url";

// VERIFIED_EXAMPLE: aggiorna con l'URL reale copiato dal sito (Step 0)
const url = buildFortuneplayMatchUrl({
  baseUrl: "https://www.fortuneplay.com",
  locale: "it",
  slug: "netherlands-morocco",
  id: 70395717,
  code: "AFF123",
});
assert.equal(url, "https://www.fortuneplay.com/it/sports/netherlands-morocco-70395717?btag=AFF123");

// senza code → niente query affiliate
const url2 = buildFortuneplayMatchUrl({
  baseUrl: "https://www.fortuneplay.com", slug: "a-b", id: 1,
});
assert.equal(url2, "https://www.fortuneplay.com/en/sports/a-b-1");

console.log("fortuneplay-url OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/fortuneplay-url.test.ts`
Expected: FAIL (modulo non esiste).

- [ ] **Step 3: Write minimal implementation** (adatta il template al pattern VERIFICATO allo Step 0)

```ts
// lib/fortuneplay-url.ts
// Deep-link pagina-partita FortunePlay/BetConstruct (#FORTUNEPLAY-LIVE-ODDS-1).
// PATTERN VERIFICATO il <DATA> su una partita reale (Step 0 del piano).
export function buildFortuneplayMatchUrl(opts: {
  baseUrl: string;
  locale?: string;
  slug: string;
  id: number;
  code?: string;
}): string {
  const locale = opts.locale || "en";
  const base = opts.baseUrl.replace(/\/+$/, "");
  let url = `${base}/${locale}/sports/${opts.slug}-${opts.id}`;
  if (opts.code) url += `?btag=${encodeURIComponent(opts.code)}`;
  return url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/fortuneplay-url.test.ts`
Expected: `fortuneplay-url OK`.

- [ ] **Step 5: Esegui i test sportsbooks esistenti (no regressione adapter)**

Run: `npx tsx tests/sportsbooks-resolver.test.ts && npx tsx tests/sportsbooks-books.test.ts`
Expected: PASS (nessun output di errore). L'adapter FortunePlay resta `landingAdapter` come fallback — il deep-link arriva via `/api/fortuneplay-odds` (Task 6), non dal resolver multi-book.

- [ ] **Step 6: Commit**

```bash
git add lib/fortuneplay-url.ts tests/fortuneplay-url.test.ts
git commit -m "feat(affiliate): deep-link pagina-partita FortunePlay (#FORTUNEPLAY-LIVE-ODDS-1)"
```

---

### Task 6: API `GET /api/fortuneplay-odds`

**Files:**
- Create: `lib/fortuneplay-board.ts` (mapping puro, testabile)
- Create: `app/api/fortuneplay-odds/route.ts` (route handler sottile)
- Test: `tests/fortuneplay-board.test.ts`

**Interfaces:**
- Consumes: `FpMatch` + `fetchFortuneplayBoard` (Task 3/4), `buildFortuneplayMatchUrl` (Task 5).
- Produces:
  - tipo `FpOddsEntry = { oddsHome: number | null; oddsDraw: number | null; oddsAway: number | null; totalLine: number | null; totalOver: number | null; totalUnder: number | null; matchUrl: string; prefilled: boolean }`
  - `boardToResponse(map: Map<string, FpMatch>, cfg: { baseUrl: string; locale: string; code?: string; landingUrl: string }): Record<string, FpOddsEntry>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/fortuneplay-board.test.ts
import assert from "node:assert/strict";
import { boardToResponse } from "../lib/fortuneplay-board";
import type { FpMatch } from "../lib/fortuneplay-live";

const fm: FpMatch = {
  teamPairKey: "2026-07-01:internazionale|milan", sport: "soccer",
  slug: "milan-inter", id: 42, urnId: "bc:match:9",
  oddsHome: 2.1, oddsDraw: 3.2, oddsAway: 3.6,
  totalLine: 2.5, totalOver: 1.9, totalUnder: 1.95,
};
const map = new Map([[fm.teamPairKey, fm]]);
const res = boardToResponse(map, {
  baseUrl: "https://www.fortuneplay.com", locale: "it", code: "AFF1",
  landingUrl: "https://mediaroosters.com/aacugmydl8",
});

const e = res["2026-07-01:internazionale|milan"];
assert.equal(e.oddsHome, 2.1);
assert.equal(e.prefilled, true);
assert.ok(e.matchUrl.includes("milan-inter-42"), "matchUrl deep-link");

console.log("fortuneplay-board OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/fortuneplay-board.test.ts`
Expected: FAIL (modulo non esiste).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/fortuneplay-board.ts
// (#FORTUNEPLAY-LIVE-ODDS-1) Proietta la mappa FpMatch nel payload servito al FE.
import type { FpMatch } from "./fortuneplay-live";
import { buildFortuneplayMatchUrl } from "./fortuneplay-url";

export type FpOddsEntry = {
  oddsHome: number | null; oddsDraw: number | null; oddsAway: number | null;
  totalLine: number | null; totalOver: number | null; totalUnder: number | null;
  matchUrl: string; prefilled: boolean;
};

export function boardToResponse(
  map: Map<string, FpMatch>,
  cfg: { baseUrl: string; locale: string; code?: string; landingUrl: string }
): Record<string, FpOddsEntry> {
  const out: Record<string, FpOddsEntry> = {};
  for (const [key, m] of map) {
    const deep = m.slug && m.id
      ? buildFortuneplayMatchUrl({ baseUrl: cfg.baseUrl, locale: cfg.locale, slug: m.slug, id: m.id, code: cfg.code })
      : null;
    out[key] = {
      oddsHome: m.oddsHome, oddsDraw: m.oddsDraw, oddsAway: m.oddsAway,
      totalLine: m.totalLine, totalOver: m.totalOver, totalUnder: m.totalUnder,
      matchUrl: deep ?? cfg.landingUrl,
      prefilled: Boolean(deep),
    };
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/fortuneplay-board.test.ts`
Expected: `fortuneplay-board OK`.

- [ ] **Step 5: Crea il route handler** (sottile, non testato a unità — verificato in Task 8)

```ts
// app/api/fortuneplay-odds/route.ts
import { NextResponse } from "next/server";
import { fetchFortuneplayBoard } from "@/lib/fortuneplay-live";
import { boardToResponse } from "@/lib/fortuneplay-board";
import { FORTUNEPLAY_BET_URL } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

export async function GET() {
  const map = await fetchFortuneplayBoard();
  const odds = boardToResponse(map, {
    baseUrl: process.env.SPORTSBOOK_FORTUNEPLAY_URL || "https://www.fortuneplay.com",
    locale: "it",
    code: process.env.SPORTSBOOK_FORTUNEPLAY_CODE || "",
    landingUrl: FORTUNEPLAY_BET_URL,
  });
  return NextResponse.json({ odds });
}
```

- [ ] **Step 6: Smoke test locale del route** (richiede dev server + rete verso FortunePlay)

```bash
npm run dev   # in un terminale separato
curl -s http://localhost:3000/api/fortuneplay-odds | python3 -m json.tool | head -30
```
Expected: JSON `{ "odds": { "<team_pair_key>": { "oddsHome": ..., "matchUrl": ..., "prefilled": true } , ... } }`. Se vuoto: verifica raggiungibilità FortunePlay dalla rete locale.

- [ ] **Step 7: Commit**

```bash
git add lib/fortuneplay-board.ts app/api/fortuneplay-odds/route.ts tests/fortuneplay-board.test.ts
git commit -m "feat(api): GET /api/fortuneplay-odds quote live + deep-link (#FORTUNEPLAY-LIVE-ODDS-1)"
```

---

### Task 7: Wiring FE + render card (calcio/tennis/WC)

**Files:**
- Modify: `app/app/page.tsx` (stato + fetch + merge + render in `PredictionCard` ~4479-4721 e `TennisMatchCard` ~4951-5180)

**Interfaces:**
- Consumes: `GET /api/fortuneplay-odds`, `teamPairKey` (Task 2), `fpEdge` (Task 3).
- Produces: nessuna API pubblica nuova (solo stato/UI interni).

> Questo task è UI: la verifica è il visual check (Task 8), non uno unit test. Mantieni le modifiche ≤ ~300 righe e segui lo stile esistente delle card (readout Mercato/Modello/Edge, niente barre — vedi feedback_card_structure_standard).

- [ ] **Step 1: Stato + fetch con interval 30s** (vicino a `fetchPredictions`, ~7749)

```tsx
const [fpOdds, setFpOdds] = useState<Record<string, {
  oddsHome: number | null; oddsDraw: number | null; oddsAway: number | null;
  totalLine: number | null; totalOver: number | null; totalUnder: number | null;
  matchUrl: string; prefilled: boolean;
}>>({});

const fetchFpOdds = useCallback(async () => {
  try {
    const resp = await fetch("/api/fortuneplay-odds", { credentials: "same-origin" });
    if (resp.ok) { const d = await resp.json(); setFpOdds(d.odds ?? {}); }
  } catch { /* degrada al landing */ }
}, []);

useEffect(() => {
  fetchFpOdds();
  const t = setInterval(fetchFpOdds, 30_000);
  return () => clearInterval(t);
}, [fetchFpOdds]);
```

- [ ] **Step 2: Helper di lookup** (import `teamPairKey`, `fpEdge` in cima al file)

```tsx
// import { teamPairKey } from "@/lib/team-pair-key";
// import { fpEdge } from "@/lib/fortuneplay-live";
function fpFor(p: Prediction) {
  const key = teamPairKey("soccer", p.home_team, p.away_team, p.kickoff);
  return key ? fpOdds[key] : undefined;
}
// per il tennis usare teamPairKey("tennis", p1, p2, kickoff) nella TennisMatchCard
```

- [ ] **Step 3: Render nella `PredictionCard`** (sotto il readout esistente, prima del footer ~4707). Mappa la pick (`best_selection`: home/draw/away) sulla quota FP corrispondente.

```tsx
{(() => {
  const fp = fpFor(p);
  if (!fp) return null;
  const pickOdds = p.best_selection === "home" ? fp.oddsHome
    : p.best_selection === "draw" ? fp.oddsDraw
    : p.best_selection === "away" ? fp.oddsAway : null;
  if (!pickOdds) return null;
  const pPick = p.best_selection === "home" ? p.p_home
    : p.best_selection === "draw" ? p.p_draw : p.p_away;
  const edge = fpEdge(pPick, pickOdds);
  return (
    <div className="fp-odds-row">
      <span className="fp-odds-label">Quota FortunePlay</span>
      <span className="fp-odds-val">{pickOdds.toFixed(2)}</span>
      {edge !== null && edge > 0 && (
        <span className="fp-edge" title="Value indicativo del modello rispetto alla quota FortunePlay. Non è una garanzia di vincita. +18, gioca responsabilmente.">
          value {(edge * 100).toFixed(1)}%
        </span>
      )}
    </div>
  );
})()}
```

- [ ] **Step 4: Bottone "Place bet" → deep-link** (sostituisci `onBetNow` ~8143 e il footer ~4707 per usare `fp.matchUrl` quando presente, altrimenti il landing attuale)

```tsx
// nel footer della card:
onClick={() => { const fp = fpFor(p); window.open(fp?.matchUrl || FORTUNEPLAY_BET_URL, "_blank", "noopener"); }}
```

- [ ] **Step 5: Ripeti Step 3-4 nella `TennisMatchCard`** (usa `teamPairKey("tennis", ...)`; il tennis è match-winner 2 vie → niente `draw`).

- [ ] **Step 6: CSS** (aggiungi in `app/globals.css` classi `.fp-odds-row/.fp-odds-label/.fp-odds-val/.fp-edge`, coerenti col tema verde — vedi project_green_rebrand; verifica collisione classi con grep prima, vedi feedback_redesign_pitfalls).

```bash
grep -n "fp-odds-row\|fp-edge" app/globals.css   # atteso: nessun match prima di aggiungere
```

- [ ] **Step 7: Build di verifica**

Run: `npm run build`
Expected: build OK, nessun errore TS.

- [ ] **Step 8: Commit**

```bash
git add app/app/page.tsx app/globals.css
git commit -m "feat(ui): quota live FortunePlay + edge + deep-link sulle card (#FORTUNEPLAY-LIVE-ODDS-1)"
```

---

### Task 8: Verifica end-to-end + gate (NO deploy)

**Files:** nessuno (verifica + PROPOSAL).

- [ ] **Step 1: Esegui tutta la suite TS toccata**

Run:
```bash
for t in tennis-names team-pair-key fortuneplay-live fortuneplay-fetch fortuneplay-url fortuneplay-board sportsbooks-resolver sportsbooks-books; do echo "== $t =="; npx tsx tests/$t.test.ts; done
```
Expected: ogni file stampa il suo "OK"/PASS, nessuna eccezione.

- [ ] **Step 2: Conferma Step 0 URL pattern** — verifica su una partita reale che `matchUrl` apra davvero la pagina-partita giusta su FortunePlay (browser). Se il pattern reale differisce, correggi `lib/fortuneplay-url.ts` + relativo test e ricommitta.

- [ ] **Step 3: Visual check da loggato** (vedi feedback_visual_check_loggato — browse con cookie, non da anonimo). Per calcio, tennis e WC: la riga "Quota FortunePlay" appare quando la partita è nel feed; l'edge è coerente; il bottone apre la partita corretta. Verifica la **degradazione**: una partita non nel feed → nessuna riga FP, bottone = landing, card invariata.

- [ ] **Step 4: PROPOSAL deploy** (gate) — posta in `ch_deploy_gate` la change-spec: file toccati, prima→dopo, env `SPORTSBOOK_FORTUNEPLAY_URL`/`_CODE` da configurare su Vercel, reversibilità (revert PR), blast radius (solo card serving, degradazione = stato attuale), piano di verifica. **Attendi `APPROVE` umano (Andrea/Michele).**

- [ ] **Step 5: Review legale copy edge** — invia il copy "value vs FortunePlay" + disclaimer a `legale-compliance`. **OK legale è bloccante per il go-live.**

- [ ] **Step 6: Dopo APPROVE+OK legale** — apri PR, report "cosa è cambiato davvero vs proposto".

---

## Self-Review

- **Spec coverage:** sorgente quote (T3/T4) ✓ · API (T6) ✓ · deep-link (T5) ✓ · UI calcio+tennis+WC (T7) ✓ · edge vs FP (T3 `fpEdge` + T7 render) ✓ · freschezza ~30s no-hammering (T4 TTL + T7 interval) ✓ · matching team_pair_key (T2, tennis T1) ✓ · guardrail FTC copy (T7 Step 3 + T8 Step 5) ✓ · degradazione (T6/T7) ✓ · gate (T8) ✓ · non-tocchiamo (Global Constraints) ✓.
- **Placeholder scan:** unico valore differito = il pattern URL FortunePlay (Task 5 Step 0) — è una verifica esplicita con comando e fallback, non un placeholder pigro.
- **Type consistency:** `FpMatch`, `FpOddsEntry`, `teamPairKey`, `fpEdge`, `buildFortuneplayMatchUrl`, `boardToResponse`, `fetchFortuneplayBoard` usati con le stesse firme tra i task ✓.
