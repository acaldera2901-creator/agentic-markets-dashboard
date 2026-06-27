# Segmenti BO + Resend — Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere al backoffice BetRedge la creazione/gestione di segmenti di utenti e la loro sincronizzazione su Resend (contatti + appartenenza segmento), **senza inviare alcuna email** (l'invio resta manuale dalla dashboard Resend).

**Architecture:** Una tabella `segments` con una regola JSONB (mini-DSL whitelistato) compilata in SQL sicuro su `profiles`. Route admin per CRUD + preview conteggio + sync. Il sync fa upsert dei contatti idonei in un'unica Audience Resend con `properties` + array `segments`. UI operatore in una pagina dedicata `app/admin/segments`. Refresh giornaliero via cron.

**Tech Stack:** Next.js App Router (route handlers), TypeScript, Supabase (via `lib/db` RPC `exec_sql`), Resend REST API (no SDK), test con `tsx` + `node:assert/strict`.

## Global Constraints

- **Gate aziendale:** nessuna esecuzione in produzione (migration applicata su DB reale, deploy, sync reale) senza `APPROVE #id` umano. I task qui producono codice + test locali; la promozione è gated.
- **SQL sicuro:** ogni valore dall'operatore passa come param `$n` a `dbQuery`/`dbExecute` (che fa `interpolate` con escaping). Nomi-campo e operatori SQL provengono **solo** dalla whitelist in `lib/segments.ts`, mai dall'input. Input fuori whitelist → errore (la route risponde 400).
- **Auth:** ogni route `/api/admin/segments/*` sotto `isAdminAuthorized` (`@/lib/admin-auth`). Il cron sotto `verifyBearer(req, process.env.CRON_SECRET)`.
- **Resend:** chiamate REST a `https://api.resend.com` con `Authorization: Bearer ${RESEND_API_KEY}`, nessun SDK (coerente con `lib/email.ts`). Audience target da `RESEND_AUDIENCE_ID`. `unsubscribed` **mai** incluso negli upsert.
- **Consenso (soft opt-in):** sincronizzare solo profili idonei — `plan IN (base,premium)` oppure `free` con `activated_at IS NOT NULL`; esclusi `admin_full` e l'identità admin (`acaldera2901@gmail.com`). Il primo sync reale resta gated su review `legale-compliance`.
- **Stile:** seguire i pattern esistenti del repo (route handlers come `app/api/admin/*`, test come `tests/*.test.ts`). Surgical changes: non toccare `lib/email.ts` né le lifecycle esistenti.
- **Test command:** `npx tsx <file di test>` (non c'è script `test`). Lint: `npm run lint`. Build: `npm run build`.

---

### Task 1: Migration tabella `segments`

**Files:**
- Create: `supabase/migrations/20260627120000_segments.sql`

**Interfaces:**
- Produces: tabella `segments` con colonne `id, key, name, description, rule (jsonb), active, resend_segment, last_count, last_synced_at, created_at, updated_at`.

- [ ] **Step 1: Scrivere la migration**

```sql
-- Segmenti di marketing gestiti dal backoffice (#BO-SEGMENTS-FASE1).
-- Additiva + idempotente: nessuna tabella esistente toccata, safe re-run.
-- La `rule` è un mini-DSL JSON compilato in SQL parametrico lato server
-- (lib/segments.ts) — mai SQL raw dall'operatore.

CREATE TABLE IF NOT EXISTS public.segments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT NOT NULL UNIQUE,            -- slug stabile (nome segmento/proprietà su Resend)
  name           TEXT NOT NULL,
  description    TEXT,
  rule           JSONB NOT NULL DEFAULT '{"all":[]}'::jsonb,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  resend_segment TEXT,                            -- id/nome del segmento lato Resend (nullable)
  last_count     INTEGER,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_active ON public.segments (active) WHERE active;

-- Operator-only: accesso esclusivo via service role nelle route admin.
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
-- Nessuna policy → nega ogni accesso anon/authenticated; il service role bypassa RLS.

-- Rollback:
-- DROP TABLE IF EXISTS public.segments;
```

- [ ] **Step 2: Verifica sintattica locale (lint SQL leggero)**

Run: `grep -c "CREATE TABLE IF NOT EXISTS public.segments" supabase/migrations/20260627120000_segments.sql`
Expected: `1`

> ⚠️ **GATED:** l'applicazione su DB reale (`supabase db push` o MCP `apply_migration`) avviene **solo dopo APPROVE**. Non eseguire qui.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260627120000_segments.sql
git commit -m "feat(bo): migration tabella segments (#BO-SEGMENTS-FASE1)"
```

---

### Task 2: `lib/segments.ts` — validazione regola + compilazione SQL (TDD)

**Files:**
- Create: `lib/segments.ts`
- Test: `tests/segments-rule.test.ts`

**Interfaces:**
- Produces:
  - `type SegmentClause = { field: string; op: string; value?: unknown }`
  - `type SegmentRule = { all: SegmentClause[] }`
  - `validateRule(input: unknown): SegmentRule` — throws `Error` su input non valido.
  - `buildSegmentQuery(rule: SegmentRule, opts: { select: "count" | "contacts" }): { sql: string; params: unknown[] }` — include sempre il predicato di eligibility consenso in AND con la regola.
  - `ADMIN_ELIGIBILITY_EXCLUDE_EMAIL: string` (= `acaldera2901@gmail.com`).

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// tests/segments-rule.test.ts
import assert from "node:assert/strict";
import { validateRule, buildSegmentQuery } from "../lib/segments";

// — validateRule accetta una regola valida —
const ok = validateRule({ all: [{ field: "plan", op: "in", value: ["base", "premium"] }] });
assert.deepEqual(ok.all[0].field, "plan");

// — validateRule rifiuta campo non whitelistato —
assert.throws(() => validateRule({ all: [{ field: "password_hash", op: "eq", value: "x" }] }), /field/i);

// — validateRule rifiuta operatore non ammesso per il campo —
assert.throws(() => validateRule({ all: [{ field: "plan", op: "lte", value: "base" }] }), /op/i);

// — validateRule rifiuta value mancante quando richiesto —
assert.throws(() => validateRule({ all: [{ field: "language", op: "eq" }] }), /value/i);

// — buildSegmentQuery (count): include eligibility + clausola, placeholder contigui —
const q = buildSegmentQuery({ all: [{ field: "language", op: "eq", value: "it" }] }, { select: "count" });
assert.match(q.sql, /SELECT COUNT\(\*\)::int AS n FROM profiles WHERE/);
assert.match(q.sql, /plan IN \('base','premium'\) OR/); // eligibility presente
assert.match(q.sql, /language = \$2/);                   // $1 = email admin (eligibility), $2 = 'it'
assert.deepEqual(q.params, ["acaldera2901@gmail.com", "it"]);

// — expiring_in_days usa make_interval e il param numerico —
const q2 = buildSegmentQuery({ all: [{ field: "plan_expires_at", op: "expiring_in_days", value: 7 }] }, { select: "contacts" });
assert.match(q2.sql, /make_interval\(days => \$2\)/);
assert.deepEqual(q2.params, ["acaldera2901@gmail.com", 7]);

// — select contacts ritorna le colonne attese —
assert.match(q2.sql, /SELECT id, identifier, name, plan, language, requested_plan, plan_expires_at, created_at, activated_at FROM profiles/);

// — 'in' richiede un array non vuoto —
assert.throws(() => validateRule({ all: [{ field: "plan", op: "in", value: [] }] }), /array/i);

console.log("segments rule ok");
```

- [ ] **Step 2: Eseguire il test e verificare che fallisce**

Run: `npx tsx tests/segments-rule.test.ts`
Expected: FAIL (modulo `../lib/segments` inesistente / export mancanti).

- [ ] **Step 3: Implementare `lib/segments.ts`**

```ts
// lib/segments.ts
// Mini-DSL dei segmenti marketing: validazione su whitelist + compilazione in
// SQL parametrico ($n) per dbQuery. I nomi-campo e gli operatori SQL vengono
// SOLO da questa whitelist; i valori dall'operatore passano come param ($n) e
// vengono escapati da lib/db.interpolate. Mai SQL raw dall'input.

export type SegmentClause = { field: string; op: string; value?: unknown };
export type SegmentRule = { all: SegmentClause[] };

// Email dell'identità admin, esclusa dal marketing (allineata a lib/admin-profile-policy).
export const ADMIN_ELIGIBILITY_EXCLUDE_EMAIL = "acaldera2901@gmail.com";

// Operatori ammessi per ciascun campo. Qualunque cosa fuori da qui → throw.
const FIELD_OPS: Record<string, string[]> = {
  plan: ["eq", "in"],
  language: ["eq", "in"],
  requested_plan: ["eq", "in", "is_null"],
  activated: ["eq"],
  account_age_days: ["lte", "gte"],
  plan_expires_at: ["expired", "active", "expiring_in_days"],
};

const PLAN_VALUES = new Set(["free", "pending_payment", "base", "premium"]);

function fail(msg: string): never {
  throw new Error(`segment rule invalid: ${msg}`);
}

export function validateRule(input: unknown): SegmentRule {
  if (!input || typeof input !== "object" || !Array.isArray((input as { all?: unknown }).all)) {
    fail("missing 'all' array");
  }
  const all = (input as { all: unknown[] }).all;
  const clauses: SegmentClause[] = [];
  for (const raw of all) {
    if (!raw || typeof raw !== "object") fail("clause must be an object");
    const c = raw as SegmentClause;
    const ops = FIELD_OPS[c.field];
    if (!ops) fail(`unknown field '${String(c.field)}'`);
    if (!ops.includes(c.op)) fail(`op '${String(c.op)}' not allowed for field '${c.field}'`);

    // Validazione del value per operatore.
    if (c.op === "in") {
      if (!Array.isArray(c.value) || c.value.length === 0) fail(`op 'in' requires a non-empty array for '${c.field}'`);
      if (c.field === "plan" && !c.value.every((v) => PLAN_VALUES.has(String(v)))) fail("invalid plan value");
    } else if (c.op === "eq") {
      if (c.value === undefined || c.value === null) fail(`op 'eq' requires a value for '${c.field}'`);
      if (c.field === "plan" && !PLAN_VALUES.has(String(c.value))) fail("invalid plan value");
      if (c.field === "activated" && typeof c.value !== "boolean") fail("'activated' requires boolean value");
    } else if (c.op === "expiring_in_days" || c.op === "lte" || c.op === "gte") {
      if (typeof c.value !== "number" || !Number.isFinite(c.value) || c.value < 0) fail(`op '${c.op}' requires a non-negative number for '${c.field}'`);
    }
    // is_null / expired / active: nessun value.
    clauses.push({ field: c.field, op: c.op, value: c.value });
  }
  return { all: clauses };
}

// Compila una clausola in un frammento SQL con placeholder $n a partire da `next`.
// Ritorna il frammento e i param aggiunti (in ordine).
function compileClause(c: SegmentClause, next: number): { sql: string; params: unknown[] } {
  switch (c.field) {
    case "plan":
    case "language":
    case "requested_plan": {
      if (c.op === "is_null") return { sql: `${c.field} IS NULL`, params: [] };
      if (c.op === "in") {
        const arr = c.value as unknown[];
        const ph = arr.map((_, i) => `$${next + i}`).join(",");
        return { sql: `${c.field} IN (${ph})`, params: arr };
      }
      return { sql: `${c.field} = $${next}`, params: [c.value] };
    }
    case "activated":
      return { sql: c.value ? "activated_at IS NOT NULL" : "activated_at IS NULL", params: [] };
    case "account_age_days": {
      // lte = account "giovane" (creato negli ultimi N giorni); gte = più vecchio.
      const cmp = c.op === "lte" ? ">=" : "<";
      return { sql: `created_at ${cmp} (NOW() - make_interval(days => $${next}))`, params: [c.value] };
    }
    case "plan_expires_at": {
      if (c.op === "expired") return { sql: "plan_expires_at IS NOT NULL AND plan_expires_at <= NOW()", params: [] };
      if (c.op === "active") return { sql: "plan_expires_at IS NOT NULL AND plan_expires_at > NOW()", params: [] };
      // expiring_in_days: attivo ora ma scade entro N giorni.
      return {
        sql: `plan_expires_at IS NOT NULL AND plan_expires_at > NOW() AND plan_expires_at <= (NOW() + make_interval(days => $${next}))`,
        params: [c.value],
      };
    }
    default:
      fail(`unknown field '${c.field}'`);
  }
}

// Predicato di eligibility consenso (soft opt-in clienti). Usa $1 = email admin.
function eligibilitySql(): { sql: string; params: unknown[] } {
  return {
    sql: "(plan IN ('base','premium') OR (plan = 'free' AND activated_at IS NOT NULL)) AND plan <> 'admin_full' AND lower(identifier) <> $1",
    params: [ADMIN_ELIGIBILITY_EXCLUDE_EMAIL],
  };
}

export function buildSegmentQuery(rule: SegmentRule, opts: { select: "count" | "contacts" }): { sql: string; params: unknown[] } {
  const elig = eligibilitySql();
  const params: unknown[] = [...elig.params];
  const fragments: string[] = [elig.sql];
  for (const c of rule.all) {
    const compiled = compileClause(c, params.length + 1);
    fragments.push(compiled.sql);
    params.push(...compiled.params);
  }
  const where = fragments.map((f) => `(${f})`).join(" AND ");
  const cols =
    opts.select === "count"
      ? "COUNT(*)::int AS n"
      : "id, identifier, name, plan, language, requested_plan, plan_expires_at, created_at, activated_at";
  return { sql: `SELECT ${cols} FROM profiles WHERE ${where}`, params };
}
```

> Nota: il test si aspetta `language = $2` e `make_interval(days => $2)` perché `$1` è l'email admin dell'eligibility. Il wrapping `(...)` per frammento è compatibile con le `assert.match` (regex non ancorate).

- [ ] **Step 4: Eseguire il test e verificare che passa**

Run: `npx tsx tests/segments-rule.test.ts`
Expected: PASS → stampa `segments rule ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/segments.ts tests/segments-rule.test.ts
git commit -m "feat(bo): mini-DSL segmenti + compilazione SQL sicura (#BO-SEGMENTS-FASE1)"
```

---

### Task 3: `lib/resend-contacts.ts` — payload contatto + sync (TDD sul builder)

**Files:**
- Create: `lib/resend-contacts.ts`
- Test: `tests/resend-contacts.test.ts`

**Interfaces:**
- Consumes: nessuno da Task precedenti (usa tipi locali).
- Produces:
  - `type SegmentContact = { id: string; identifier: string; name: string | null; plan: string; language: string | null; requested_plan: string | null; plan_expires_at: string | null; created_at: string; activated_at: string | null }`
  - `lifecycleStage(c: SegmentContact, nowISO: string): "prospect" | "active" | "expiring" | "expired"`
  - `cohortMonth(createdAtISO: string): string` (es. `"2026-06"`)
  - `buildContactPayload(c: SegmentContact, matchedSegmentKeys: string[], nowISO: string): { email: string; firstName?: string; properties: Record<string, string | boolean>; segments: string[] }`
  - `syncSegmentToResend(segmentKey: string, contacts: SegmentContact[], segmentKeysByContact: Map<string, string[]>): Promise<{ ok: number; failed: number }>` (network)

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// tests/resend-contacts.test.ts
import assert from "node:assert/strict";
import { lifecycleStage, cohortMonth, buildContactPayload, type SegmentContact } from "../lib/resend-contacts";

const NOW = "2026-06-27T12:00:00.000Z";

const base: SegmentContact = {
  id: "u1", identifier: "a@b.com", name: "Mario Rossi", plan: "premium",
  language: "it", requested_plan: null, plan_expires_at: "2026-12-01T00:00:00.000Z",
  created_at: "2026-05-10T00:00:00.000Z", activated_at: "2026-05-10T00:00:00.000Z",
};

assert.equal(cohortMonth(base.created_at), "2026-05");

// premium con scadenza lontana → active
assert.equal(lifecycleStage(base, NOW), "active");
// premium che scade entro 7gg → expiring
assert.equal(lifecycleStage({ ...base, plan_expires_at: "2026-06-30T00:00:00.000Z" }, NOW), "expiring");
// scaduto → expired
assert.equal(lifecycleStage({ ...base, plan_expires_at: "2026-06-01T00:00:00.000Z" }, NOW), "expired");
// free attivato → prospect
assert.equal(lifecycleStage({ ...base, plan: "free", plan_expires_at: null }, NOW), "prospect");

const payload = buildContactPayload(base, ["pro_it", "renewers"], NOW);
assert.equal(payload.email, "a@b.com");
assert.equal(payload.firstName, "Mario");
assert.equal(payload.properties.plan, "premium");
assert.equal(payload.properties.language, "it");
assert.equal(payload.properties.lifecycle_stage, "active");
assert.equal(payload.properties.cohort_month, "2026-05");
assert.equal(payload.properties.seg_pro_it, true);
assert.equal(payload.properties.seg_renewers, true);
assert.deepEqual(payload.segments, ["pro_it", "renewers"]);
// MAI impostare unsubscribed nell'upsert
assert.equal("unsubscribed" in payload, false);

console.log("resend contacts ok");
```

- [ ] **Step 2: Eseguire il test e verificare che fallisce**

Run: `npx tsx tests/resend-contacts.test.ts`
Expected: FAIL (modulo inesistente).

- [ ] **Step 3: Implementare `lib/resend-contacts.ts`**

```ts
// lib/resend-contacts.ts
// Sync dei contatti verso Resend per i segmenti marketing (#BO-SEGMENTS-FASE1).
// REST, no SDK (coerente con lib/email.ts). NESSUN invio email: solo upsert
// contatti nell'Audience. `unsubscribed` non è MAI incluso negli upsert, così
// un re-sync non re-iscrive chi si è disiscritto (la scelta vive su Resend).

const RESEND_CONTACTS_ENDPOINT = "https://api.resend.com/contacts";
const EXPIRING_WINDOW_DAYS = 7;

export type SegmentContact = {
  id: string;
  identifier: string;
  name: string | null;
  plan: string;
  language: string | null;
  requested_plan: string | null;
  plan_expires_at: string | null;
  created_at: string;
  activated_at: string | null;
};

export function cohortMonth(createdAtISO: string): string {
  return createdAtISO.slice(0, 7); // "YYYY-MM"
}

export function lifecycleStage(c: SegmentContact, nowISO: string): "prospect" | "active" | "expiring" | "expired" {
  if (c.plan === "free" || c.plan === "pending_payment") return "prospect";
  if (!c.plan_expires_at) return "active";
  const now = new Date(nowISO).getTime();
  const exp = new Date(c.plan_expires_at).getTime();
  if (exp <= now) return "expired";
  if (exp <= now + EXPIRING_WINDOW_DAYS * 86400_000) return "expiring";
  return "active";
}

export function buildContactPayload(
  c: SegmentContact,
  matchedSegmentKeys: string[],
  nowISO: string
): { email: string; firstName?: string; properties: Record<string, string | boolean>; segments: string[] } {
  const firstName = c.name?.trim().split(/\s+/)[0];
  const properties: Record<string, string | boolean> = {
    plan: c.plan,
    language: c.language ?? "",
    lifecycle_stage: lifecycleStage(c, nowISO),
    cohort_month: cohortMonth(c.created_at),
  };
  for (const k of matchedSegmentKeys) properties[`seg_${k}`] = true;
  const payload: { email: string; firstName?: string; properties: Record<string, string | boolean>; segments: string[] } = {
    email: c.identifier,
    properties,
    segments: matchedSegmentKeys,
  };
  if (firstName) payload.firstName = firstName;
  return payload;
}

async function upsertContact(
  audienceId: string,
  apiKey: string,
  payload: ReturnType<typeof buildContactPayload>
): Promise<void> {
  // Resend: upsert contatto nell'audience. audience_id nel body.
  const resp = await fetch(RESEND_CONTACTS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ audience_id: audienceId, ...payload }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend contact upsert failed: ${resp.status} ${body.slice(0, 200)}`);
  }
}

// Sincronizza i contatti di UN segmento. `segmentKeysByContact` mappa
// identifier → tutte le key di segmento che quel contatto matcha ora (così il
// contatto porta su Resend l'appartenenza completa, non solo questo segmento).
export async function syncSegmentToResend(
  _segmentKey: string,
  contacts: SegmentContact[],
  segmentKeysByContact: Map<string, string[]>
): Promise<{ ok: number; failed: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  if (!audienceId) throw new Error("RESEND_AUDIENCE_ID not configured");

  const nowISO = new Date().toISOString();
  let ok = 0;
  let failed = 0;
  for (const c of contacts) {
    const keys = segmentKeysByContact.get(c.identifier) ?? [];
    try {
      await upsertContact(audienceId, apiKey, buildContactPayload(c, keys, nowISO));
      ok++;
    } catch (e) {
      console.error(`[resend-contacts] upsert ${c.identifier} failed:`, String(e));
      failed++;
    }
  }
  return { ok, failed };
}
```

- [ ] **Step 4: Eseguire il test e verificare che passa**

Run: `npx tsx tests/resend-contacts.test.ts`
Expected: PASS → stampa `resend contacts ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/resend-contacts.ts tests/resend-contacts.test.ts
git commit -m "feat(bo): payload + sync contatti Resend per segmenti (#BO-SEGMENTS-FASE1)"
```

---

### Task 4: API CRUD segmenti + preview conteggio

**Files:**
- Create: `app/api/admin/segments/route.ts` (GET lista, POST crea)
- Create: `app/api/admin/segments/[id]/route.ts` (PATCH, DELETE)
- Create: `app/api/admin/segments/[id]/count/route.ts` (POST preview conteggio su rule arbitraria)

**Interfaces:**
- Consumes: `validateRule`, `buildSegmentQuery` da `lib/segments`; `isAdminAuthorized` da `lib/admin-auth`; `dbQuery`, `dbExecute` da `lib/db`.
- Produces: endpoint REST elencati nello spec §3.6.

- [ ] **Step 1: Implementare `app/api/admin/segments/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { validateRule } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await dbQuery(
    "SELECT id, key, name, description, rule, active, resend_segment, last_count, last_synced_at, created_at, updated_at FROM segments ORDER BY created_at DESC"
  );
  return NextResponse.json({ segments: rows ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as
    | { key?: string; name?: string; description?: string; rule?: unknown; active?: boolean }
    | null;
  if (!body?.key || !body?.name) return NextResponse.json({ error: "key and name required" }, { status: 400 });
  if (!/^[a-z0-9_]+$/.test(body.key)) return NextResponse.json({ error: "key must be [a-z0-9_]" }, { status: 400 });

  let rule;
  try {
    rule = validateRule(body.rule ?? { all: [] });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }

  try {
    const rows = await dbExecute(
      `INSERT INTO segments (key, name, description, rule, active)
       VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`,
      [body.key, body.name, body.description ?? null, JSON.stringify(rule), body.active ?? true]
    );
    return NextResponse.json({ ok: true, id: (rows?.[0] as { id?: string })?.id ?? null });
  } catch (e) {
    return NextResponse.json({ error: "insert failed", detail: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implementare `app/api/admin/segments/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbExecute } from "@/lib/db";
import { validateRule } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { name?: string; description?: string; rule?: unknown; active?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: "body required" }, { status: 400 });

  let ruleJson: string | null = null;
  if (body.rule !== undefined) {
    try {
      ruleJson = JSON.stringify(validateRule(body.rule));
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
    }
  }

  try {
    await dbExecute(
      `UPDATE segments SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         rule = COALESCE($4::jsonb, rule),
         active = COALESCE($5, active),
         updated_at = NOW()
       WHERE id = $1`,
      [id, body.name ?? null, body.description ?? null, ruleJson, body.active ?? null]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "update failed", detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await dbExecute("DELETE FROM segments WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "delete failed", detail: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implementare `app/api/admin/segments/[id]/count/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery } from "@/lib/db";
import { validateRule, buildSegmentQuery } from "@/lib/segments";

export const dynamic = "force-dynamic";

// Preview conteggio: accetta una `rule` arbitraria nel body (anche non salvata)
// così l'editor del BO mostra il match count live. L'[id] nel path non è usato
// per la query (la rule arriva dal body) ma mantiene l'URL coerente.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { rule?: unknown } | null;
  let rule;
  try {
    rule = validateRule(body?.rule ?? { all: [] });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
  const { sql, params } = buildSegmentQuery(rule, { select: "count" });
  const rows = await dbQuery<{ n: number }>(sql, params);
  return NextResponse.json({ count: rows?.[0]?.n ?? 0 });
}
```

- [ ] **Step 4: Verifica build + lint**

Run: `npm run lint && npm run build`
Expected: nessun errore TypeScript/ESLint sui nuovi file.

> ⚠️ **GATED:** test funzionale contro DB reale (creare/leggere un segmento) → solo dopo APPROVE + migration applicata. Vedi Task 8.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/segments
git commit -m "feat(bo): API CRUD segmenti + preview conteggio (#BO-SEGMENTS-FASE1)"
```

---

### Task 5: API sync segmento → Resend

**Files:**
- Create: `app/api/admin/segments/[id]/sync/route.ts`

**Interfaces:**
- Consumes: `buildSegmentQuery` da `lib/segments`; `syncSegmentToResend`, `type SegmentContact` da `lib/resend-contacts`; `dbQuery`, `dbExecute` da `lib/db`.
- Produces: `POST /api/admin/segments/[id]/sync` → `{ ok, synced, failed, count }`; aggiorna `last_count`, `last_synced_at` sulla riga.

- [ ] **Step 1: Implementare la route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { validateRule, buildSegmentQuery } from "@/lib/segments";
import { syncSegmentToResend, type SegmentContact } from "@/lib/resend-contacts";

export const dynamic = "force-dynamic";

type SegRow = { id: string; key: string; rule: unknown; active: boolean };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const segs = await dbQuery<SegRow>("SELECT id, key, rule, active FROM segments WHERE id = $1", [id]);
  const seg = segs?.[0];
  if (!seg) return NextResponse.json({ error: "segment not found" }, { status: 404 });

  let rule;
  try {
    rule = validateRule(seg.rule);
  } catch (e) {
    return NextResponse.json({ error: `stored rule invalid: ${String(e)}` }, { status: 500 });
  }

  // Match dei contatti idonei (eligibility consenso applicata in buildSegmentQuery).
  const { sql, params: qp } = buildSegmentQuery(rule, { select: "contacts" });
  const contacts = (await dbQuery<SegmentContact>(sql, qp)) ?? [];

  // Per Fase 1 il sync è per-segmento: ogni contatto porta SOLO questo segmento.
  // (L'appartenenza multi-segmento completa arriva dal refresh-all del cron, Task 7.)
  const byContact = new Map<string, string[]>();
  for (const c of contacts) byContact.set(c.identifier, [seg.key]);

  let result: { ok: number; failed: number };
  try {
    result = await syncSegmentToResend(seg.key, contacts, byContact);
  } catch (e) {
    return NextResponse.json({ error: "sync failed", detail: String(e) }, { status: 500 });
  }

  await dbExecute(
    "UPDATE segments SET last_count = $2, last_synced_at = NOW(), resend_segment = COALESCE(resend_segment, $3) WHERE id = $1",
    [id, contacts.length, seg.key]
  );

  return NextResponse.json({ ok: result.failed === 0, synced: result.ok, failed: result.failed, count: contacts.length });
}
```

- [ ] **Step 2: Verifica build + lint**

Run: `npm run lint && npm run build`
Expected: nessun errore.

> ⚠️ **GATED:** sync reale verso Resend → solo dopo APPROVE + audience di test configurata. Vedi Task 8.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/segments/[id]/sync/route.ts
git commit -m "feat(bo): sync segmento → Resend (#BO-SEGMENTS-FASE1)"
```

---

### Task 6: UI BO — pagina Segmenti

**Files:**
- Create: `app/admin/segments/page.tsx`
- Modify: `app/admin/page.tsx` (aggiungere un link "Segmenti / Marketing" alla pagina dedicata)

**Interfaces:**
- Consumes: le route admin di Task 4 e 5 (fetch con credenziali cookie admin già presenti nel BO).
- Produces: una pagina operatore per creare/modificare segmenti, vedere il conteggio match live, e lanciare il sync.

- [ ] **Step 1: Implementare `app/admin/segments/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";

type Clause = { field: string; op: string; value?: unknown };
type Segment = {
  id: string; key: string; name: string; description: string | null;
  rule: { all: Clause[] }; active: boolean;
  last_count: number | null; last_synced_at: string | null;
};

const FIELD_OPS: Record<string, string[]> = {
  plan: ["eq", "in"],
  language: ["eq", "in"],
  requested_plan: ["eq", "in", "is_null"],
  activated: ["eq"],
  account_age_days: ["lte", "gte"],
  plan_expires_at: ["expired", "active", "expiring_in_days"],
};

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ key: string; name: string; clauses: Clause[] }>({ key: "", name: "", clauses: [] });
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/segments");
    if (!res.ok) { setError("Caricamento segmenti fallito"); return; }
    const data = await res.json();
    setSegments(data.segments ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const runPreview = useCallback(async () => {
    const res = await fetch("/api/admin/segments/preview/count".replace("preview", "00000000-0000-0000-0000-000000000000"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule: { all: draft.clauses } }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Preview fallita"); return; }
    setError(null); setPreview(data.count ?? 0);
  }, [draft.clauses]);

  const create = useCallback(async () => {
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/segments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: draft.key, name: draft.name, rule: { all: draft.clauses } }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Creazione fallita"); return; }
    setDraft({ key: "", name: "", clauses: [] }); setPreview(null); void load();
  }, [draft, load]);

  const sync = useCallback(async (id: string) => {
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/segments/${id}/sync`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Sync fallito"); return; }
    void load();
  }, [load]);

  const addClause = () => setDraft((d) => ({ ...d, clauses: [...d.clauses, { field: "plan", op: "eq", value: "" }] }));
  const updClause = (i: number, patch: Partial<Clause>) =>
    setDraft((d) => ({ ...d, clauses: d.clauses.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const delClause = (i: number) => setDraft((d) => ({ ...d, clauses: d.clauses.filter((_, j) => j !== i) }));

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24, fontFamily: "system-ui,sans-serif", color: "#0f172a" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Marketing — Segmenti</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>
        I segmenti sincronizzati su Resend non inviano email: i Broadcast si compongono nella dashboard Resend.
      </p>
      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>⚠️ {error}</p>}

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, margin: "16px 0" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Nuovo segmento</h2>
        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
          <input placeholder="key (es. pro_it)" value={draft.key}
            onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
            style={{ flex: 1, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
          <input placeholder="Nome leggibile" value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            style={{ flex: 2, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
        </div>
        {draft.clauses.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 8, margin: "6px 0" }}>
            <select value={c.field} onChange={(e) => updClause(i, { field: e.target.value, op: FIELD_OPS[e.target.value][0] })}>
              {Object.keys(FIELD_OPS).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={c.op} onChange={(e) => updClause(i, { op: e.target.value })}>
              {FIELD_OPS[c.field].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input placeholder="value (CSV per 'in', numero per giorni)" value={String(c.value ?? "")}
              onChange={(e) => {
                const op = c.op;
                let v: unknown = e.target.value;
                if (op === "in") v = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                else if (op === "eq" && c.field === "activated") v = e.target.value === "true";
                else if (["expiring_in_days", "lte", "gte"].includes(op)) v = Number(e.target.value);
                updClause(i, { value: v });
              }}
              style={{ flex: 1, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
            <button onClick={() => delClause(i)}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={addClause}>+ clausola</button>
          <button onClick={runPreview} disabled={busy}>Anteprima conteggio</button>
          <button onClick={create} disabled={busy || !draft.key || !draft.name}>Crea segmento</button>
          {preview != null && <span style={{ alignSelf: "center", fontSize: 13 }}>≈ {preview} utenti</span>}
        </div>
      </section>

      <h2 style={{ fontSize: 15, fontWeight: 700 }}>Segmenti esistenti</h2>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead><tr style={{ textAlign: "left", color: "#64748b" }}>
          <th>Nome</th><th>key</th><th>Match</th><th>Ultimo sync</th><th></th>
        </tr></thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td>{s.name}</td><td>{s.key}</td>
              <td>{s.last_count ?? "—"}</td>
              <td>{s.last_synced_at ? new Date(s.last_synced_at).toLocaleString("it-IT") : "mai"}</td>
              <td><button onClick={() => sync(s.id)} disabled={busy}>Sync su Resend</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

> Nota implementativa: `runPreview` usa un id placeholder nell'URL perché il conteggio lavora sulla `rule` del body (la route ignora l'`[id]` per il preview). In fase di refactor si può esporre `/api/admin/segments/count` senza id; per ora si riusa la route `[id]/count`.

- [ ] **Step 2: Aggiungere il link nel BO principale** (`app/admin/page.tsx`)

Individuare l'area di navigazione/intestazione della dashboard (vicino agli altri link, es. `banners-preview`) e aggiungere:

```tsx
<a href="/admin/segments" style={{ fontSize: 13, color: "#0f172a", textDecoration: "underline" }}>Marketing → Segmenti</a>
```

(Surgical: una sola riga/elemento, coerente con i link già presenti. Se non esiste una barra link, aggiungerlo in cima alla pagina dentro il blocco header esistente.)

- [ ] **Step 3: Verifica build + lint**

Run: `npm run lint && npm run build`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add app/admin/segments/page.tsx app/admin/page.tsx
git commit -m "feat(bo): UI pagina Segmenti + link nel backoffice (#BO-SEGMENTS-FASE1)"
```

---

### Task 7: Cron refresh giornaliero di tutti i segmenti attivi

**Files:**
- Create: `app/api/cron/segments-sync/route.ts`
- Modify: `vercel.json` (aggiungere la voce cron)

**Interfaces:**
- Consumes: `verifyBearer` da `lib/admin-auth`; `validateRule`, `buildSegmentQuery` da `lib/segments`; `syncSegmentToResend`, `type SegmentContact` da `lib/resend-contacts`; `dbQuery`, `dbExecute` da `lib/db`.
- Produces: `GET /api/cron/segments-sync` (cron-secret gated) che ricalcola e sincronizza tutti i segmenti `active`, con appartenenza multi-segmento per contatto.

- [ ] **Step 1: Implementare la route cron**

```ts
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { validateRule, buildSegmentQuery } from "@/lib/segments";
import { syncSegmentToResend, type SegmentContact } from "@/lib/resend-contacts";

export const dynamic = "force-dynamic";

type SegRow = { id: string; key: string; rule: unknown };

// Refresh giornaliero: ricalcola l'appartenenza di OGNI segmento attivo e
// sincronizza i contatti su Resend con l'appartenenza multi-segmento completa
// (un contatto può stare in più segmenti). Cron-secret gated, default-deny.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const segs = (await dbQuery<SegRow>("SELECT id, key, rule FROM segments WHERE active")) ?? [];

  // 1. Calcola i match di ogni segmento e costruisci la mappa identifier → [keys].
  const byContact = new Map<string, string[]>();
  const contactById = new Map<string, SegmentContact>();
  const perSegment: { row: SegRow; contacts: SegmentContact[] }[] = [];

  for (const s of segs) {
    let rule;
    try { rule = validateRule(s.rule); } catch (e) { console.error(`[segments-sync] rule invalid ${s.key}:`, String(e)); continue; }
    const { sql, params } = buildSegmentQuery(rule, { select: "contacts" });
    const contacts = (await dbQuery<SegmentContact>(sql, params)) ?? [];
    perSegment.push({ row: s, contacts });
    for (const c of contacts) {
      contactById.set(c.identifier, c);
      const arr = byContact.get(c.identifier) ?? [];
      arr.push(s.key);
      byContact.set(c.identifier, arr);
    }
  }

  // 2. Un solo upsert per contatto (deduplicato) con TUTTE le sue key.
  const uniqueContacts = Array.from(contactById.values());
  let result = { ok: 0, failed: 0 };
  if (uniqueContacts.length) {
    try {
      result = await syncSegmentToResend("__all__", uniqueContacts, byContact);
    } catch (e) {
      return NextResponse.json({ error: "sync failed", detail: String(e) }, { status: 500 });
    }
  }

  // 3. Aggiorna last_count/last_synced_at per ciascun segmento.
  for (const { row, contacts } of perSegment) {
    await dbExecute(
      "UPDATE segments SET last_count = $2, last_synced_at = NOW(), resend_segment = COALESCE(resend_segment, $3) WHERE id = $1",
      [row.id, contacts.length, row.key]
    );
  }

  return NextResponse.json({ ok: result.failed === 0, segments: segs.length, contacts: uniqueContacts.length, synced: result.ok, failed: result.failed });
}
```

- [ ] **Step 2: Aggiungere la voce cron in `vercel.json`**

Nel blocco `"crons"` aggiungere (giornaliero alle 05:00, prima del sweep abbonamenti delle 06:00 così l'appartenenza è fresca):

```json
{
  "path": "/api/cron/segments-sync",
  "schedule": "0 5 * * *"
}
```

- [ ] **Step 3: Verifica build + lint + JSON valido**

Run: `npm run lint && npm run build && node -e "require('./vercel.json')"`
Expected: nessun errore; `vercel.json` parsabile.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/segments-sync/route.ts vercel.json
git commit -m "feat(bo): cron refresh giornaliero segmenti → Resend (#BO-SEGMENTS-FASE1)"
```

---

### Task 8: Verifica reale end-to-end (GATED) + bootstrap audience

> Questo task **non è codice**: è la verifica operativa che trasforma "Costruito" in "Verificato/Operativo". Richiede `APPROVE #id` umano e la review `legale-compliance` prima del primo sync reale. Va eseguito da chi ha accesso a Supabase prod e all'account Resend.

**Pre-requisiti (gated):**
- [ ] Review `legale-compliance` sulla base giuridica del soft opt-in marketing → OK scritto.
- [ ] Creare l'Audience "BetRedge users" su Resend; impostare `RESEND_AUDIENCE_ID` su Vercel (env prod + preview). Confermare presenza `RESEND_API_KEY`.
- [ ] Applicare la migration `segments` (Task 1) su DB — via `supabase db push` o MCP `apply_migration` — **solo dopo APPROVE**.

**Verifica funzionale:**
- [ ] **Unit test verdi:** `npx tsx tests/segments-rule.test.ts && npx tsx tests/resend-contacts.test.ts` → entrambi stampano `ok`.
- [ ] **CRUD:** dal BO loggato, creare un segmento di test (es. `pro_it`: `plan in [base,premium]` AND `language eq it`). Verificare che `last_count` ≈ conteggio manuale:
  `SELECT COUNT(*) FROM profiles WHERE (plan IN ('base','premium') OR (plan='free' AND activated_at IS NOT NULL)) AND plan<>'admin_full' AND lower(identifier)<>'acaldera2901@gmail.com' AND plan IN ('base','premium') AND language='it';`
- [ ] **Sync verso audience di test:** premere "Sync su Resend". Su Resend i contatti idonei compaiono con `properties` (`plan`, `language`, `lifecycle_stage`, `cohort_month`, `seg_pro_it=true`) e nel segmento `pro_it`.
- [ ] **Esclusione consenso:** un profilo non attivato e l'identità admin **non** compaiono tra i contatti.
- [ ] **Unsubscribe preservato:** marcare manualmente un contatto come `unsubscribed` su Resend, ri-lanciare il sync, verificare che **resta** unsubscribed (l'upsert non lo resetta).
- [ ] **Cron:** invocare `GET /api/cron/segments-sync` con `Authorization: Bearer $CRON_SECRET` → risposta `{ ok:true, ... }`; un contatto in due segmenti porta entrambe le key.
- [ ] **Visual check** del BO da operatore loggato (no fiducia cieca su screenshot anonimo).

**Report finale:** "cosa è cambiato davvero vs proposto" + aggiornare la memoria del progetto.

---

## Self-Review (eseguita)

**Spec coverage:**
- §3.1 tabella `segments` → Task 1 ✓
- §3.2 mini-DSL + compilazione sicura → Task 2 ✓
- §3.3 sync engine (audience, properties, segments, unsubscribe preservato) → Task 3 + Task 5 ✓
- §3.3 innesco automatico (cron) → Task 7 ✓
- §3.4 consenso/eligibility → predicato in Task 2 (`eligibilitySql`), gate legale in Task 8 ✓
- §3.5 BO UI → Task 6 ✓
- §3.6 API (list/create/patch/delete/count/sync) → Task 4 + Task 5 ✓
- §6 verifica → Task 8 ✓
- §9 env (`RESEND_AUDIENCE_ID`) → Task 8 bootstrap ✓
- Fase 2 (trigger) → **fuori da questo piano** (piano separato dopo la verifica Fase 1), come da spec.

**Placeholder scan:** nessun TBD/TODO nel codice dei task; gli unici "GATED" sono passi operativi consapevolmente rimandati all'approvazione (Task 1 Step 2, Task 4/5 verifica, Task 8).

**Type consistency:** `SegmentContact`, `buildSegmentQuery({select})`, `syncSegmentToResend(key, contacts, map)`, `buildContactPayload(c, keys, nowISO)` usati in modo coerente tra Task 3/5/7. `validateRule`/`buildSegmentQuery` firma coerente tra Task 2/4/5/7.

## Note di rischio (riassunto per il gate)
- **DB:** una sola tabella nuova, additiva/idempotente, RLS-deny, rollback fornito.
- **Email a utenti reali:** Fase 1 **non invia nulla**; l'invio resta manuale dalla dashboard Resend.
- **GDPR:** gate `legale-compliance` prima del primo sync reale; eligibility = parametro in `lib/segments.ts`.
- **Sicurezza:** rule whitelistata + param `$n`; tutte le route admin sotto `isAdminAuthorized`; cron sotto `verifyBearer`.
