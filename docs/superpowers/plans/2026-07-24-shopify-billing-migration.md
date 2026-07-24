# Shopify Billing Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostare lo strato commerce (checkout/abbonamenti/fatture/dunning) su Shopify, mantenendo app + gate su Vercel/Supabase, con `profiles.plan` come unica fonte di verità e convivenza grandfather con PayGate.

**Architecture:** Headless commerce. Shopify emette gli eventi di pagamento; un webhook firmato (HMAC) su Vercel (`/api/shopify/webhook`) mappa l'evento all'utente per email, concede il piano su Supabase via `activateShopifyPlan` (riusa la matematica di grant esistente) e usa `shopify_events` per l'idempotenza. Ricalca 1:1 l'integrazione **Stripe** già in repo (`app/api/stripe/webhook/route.ts`, `lib/plan-grant.ts`, `stripe_events`).

**Tech Stack:** Next.js (App Router, runtime nodejs), TypeScript, Supabase (via `lib/db` `dbQuery`/`dbQueryStrict`/`dbExecute` → `exec_sql`), vitest, crypto (HMAC), Shopify Admin webhooks + Subscriptions.

## Global Constraints

- **STEP 0 legale è BLOCCANTE.** Nessun task di codice (Task 2+) parte prima del verdetto **GO** su AUP/Shopify Payments (Task 0). NO-GO → piano archiviato.
- **Tier reali:** `free` / `base` / `premium` (NON "Pro" — "Pro"=`premium`). Prezzi: base 19.90, premium 49.90.
- **Fonte di verità piano INVARIATA:** `profiles.plan` + `profiles.plan_expires_at`; letta fresca da `lib/auth.ts`. Non toccare il gate (`lib/auth.ts`, `lib/access-projection.ts`).
- **Mapping utente per email** (`identifier`, case-insensitive: `identifier = $1 OR LOWER(TRIM(identifier)) = $1`), come tutte le integrazioni esistenti.
- **`exec_sql` NON ritorna RETURNING** → sempre SELECT-prima-poi-UPDATE; per l'idempotenza usa `dbQueryStrict` (fail-loud) e rispondi non-200 sui fallimenti transitori così Shopify ritenta.
- **Grandfather invariant:** il grant Shopify scrive/declassa SOLO righe `plan_source='shopify'` o `plan_source IS NULL`; NON tocca `plan_source='paygate'` con `plan_expires_at` futura.
- **Next.js "breaking":** prima di scrivere codice Next, leggi `node_modules/next/dist/docs/` (vedi AGENTS.md).
- **Deploy:** branch + PR; prod = PROPOSAL + APPROVE umano. Migration additive PRIMA del codice.
- **Project Brain:** `log_entry` sui deploy/decisioni; a fine sessione `update_state` (vedi CLAUDE.md progetto).
- **Secrets via env** (mai in repo): `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_VARIANT_BASE`, `SHOPIFY_VARIANT_PREMIUM`.

---

### Task 0: STEP 0 — Verdetto legale AUP (GATE, non-codice) ✅ FATTO

**Files:** `docs/superpowers/specs/2026-07-24-shopify-aup-legal.md` (verdetto salvato).

**Esito: GO-CONDIZIONATO.** La clausola gambling operativa (Stripe, "sports forecasting *with a monetary or material prize*") NON colpisce BetRedge (VIA A: no puntata/payout/premio). Il gate reale è la clausola *get-rich-quick* (claim "battiamo il mercato" ecc.) + isolare i bookmaker. Le condizioni sotto sono **bloccanti prima di aprire il merchant (Task 1)**:

- [ ] **C1 — Scrub copy get-rich-quick** sul sito (grep → zero "battiamo il mercato / beat the market / edge +X% / ROI / guadagna / value bet"; include banner Creator Picks + EdgeCard dormiente).
- [ ] **C2 — Isolare i bookmaker** (nessun link/logo/deep-link su pagina prodotto, checkout, ricevute, email Shopify).
- [ ] **C3 — Descrizione prodotto + categoria merchant** = "data/analytics SaaS, non-gambling" + disclaimer "non è scommesse".
- [ ] **C4 — Track record come accuratezza descrittiva passata** + disclaimer "no promessa risultati".
- [ ] **C5 — ToS/Privacy/Refund allineati** + ragione sociale reale; click-to-cancel + ricevute (Sufio) attivi.
- [ ] **C6 — Invariante VIA A** (nessuna feature che gestisca denaro su esiti).
- [ ] **[AVVOCATO]** conferma umana su giurisdizione entità merchant + mercati (specie US/FTC e IT/Decreto Dignità) e disponibilità Shopify Payments nel paese, PRIMA di chiudere lo STEP 0. Vedi il file legale per la lista completa.

**GATE:** C1–C6 chiuse + conferma avvocato → si procede a Task 1. Altrimenti STOP.

---

### Task 1: Setup Shopify (GATE config, non-codice)

**Files:** nessuno nel repo (deliverable = env + permalink).

- [ ] **Step 1:** Crea store Shopify + attiva **Shopify Payments** (verifica disponibilità paese merchant).
- [ ] **Step 2:** Installa app **subscription** (Shopify Subscriptions nativo o Appstle). Crea 2 selling plan mensili: prodotto "BetRedge Base" (19.90) e "BetRedge Premium" (49.90). Annota i **variant id**.
- [ ] **Step 3:** Installa app **fatture** (es. Sufio) per ricevute/fatture.
- [ ] **Step 4:** Registra il webhook `orders/paid` (topic) verso `https://betredge.com/api/shopify/webhook`; copia il **webhook signing secret**.
- [ ] **Step 5:** Metti in env (Vercel, tutte le env + `.env.local` dev): `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_VARIANT_BASE`, `SHOPIFY_VARIANT_PREMIUM`. Deliverable per Task 7: i **permalink checkout** dei due selling plan.

---

### Task 2: Migration `plan_source` + tracciamento sorgente nei grant esistenti

**Files:**
- Create: `supabase/migrations/20260724120000_plan_source.sql`
- Modify: `lib/plan-grant.ts` (UPDATE di `activateAdminPlan`, `activateStripePlan`, `activatePaygatePlan`, `activatePaypalPlan`)
- Test: `tests/plan-grant.test.ts` (esistente — aggiungi caso plan_source, se il test tocca il DB usa il pattern esistente del file)

**Interfaces:**
- Produces: colonna `profiles.plan_source TEXT` (valori `'paygate'|'shopify'|'stripe'|'paypal'|'manual'|NULL`); i grant esistenti scrivono la propria sorgente.

- [ ] **Step 1: Scrivi la migration**

```sql
-- 20260724120000_plan_source.sql
-- Traccia quale gateway "possiede" il piano attivo (grandfather PayGate↔Shopify).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_source TEXT
  CHECK (plan_source IN ('paygate','shopify','stripe','paypal','manual') OR plan_source IS NULL);

-- Backfill: gli abbonati attivi oggi sono crypto (PayGate) o attivazioni admin manuali.
-- Chi ha stripe_subscription_id valorizzato → 'stripe'; il resto degli attivi → 'paygate'.
UPDATE public.profiles
   SET plan_source = CASE
         WHEN stripe_subscription_id IS NOT NULL THEN 'stripe'
         ELSE 'paygate'
       END
 WHERE plan IN ('base','premium') AND plan_source IS NULL;
```

- [ ] **Step 2: Applica la migration** (dev/branch DB) e verifica

Run: `psql "$DATABASE_URL" -f supabase/migrations/20260724120000_plan_source.sql` (o il flusso migration del progetto)
Expected: colonna presente; `SELECT plan_source, count(*) FROM profiles GROUP BY 1` mostra il backfill.

- [ ] **Step 3: Aggiorna i 4 grant esistenti** per scrivere `plan_source`

In `lib/plan-grant.ts`, in ciascun `UPDATE profiles SET ...` aggiungi la sorgente corrispondente:
- `activateAdminPlan` → `plan_source = 'manual'`
- `activateStripePlan` → `plan_source = 'stripe'`
- `activatePaygatePlan` → `plan_source = 'paygate'`
- `activatePaypalPlan` → `plan_source = 'paypal'`

Esempio (activatePaygatePlan, riga `UPDATE profiles SET ...`):

```ts
await dbExecute(
  `UPDATE profiles
      SET plan = $2,
          requested_plan = NULL,
          plan_expires_at = $3::timestamptz,
          plan_source = 'paygate',
          updated_at = NOW()
    WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
  [identifier, newPlan, expiryISO]
);
```

- [ ] **Step 4: Test verdi**

Run: `npm test -- tests/plan-grant.test.ts tests/paygate-grant.test.ts`
Expected: PASS (nessuna regressione; le funzioni ora settano plan_source).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260724120000_plan_source.sql lib/plan-grant.ts tests/plan-grant.test.ts
git commit -m "feat(billing): profiles.plan_source + traccia sorgente nei grant"
```

---

### Task 3: Migration `shopify_events` (idempotenza webhook)

**Files:**
- Create: `supabase/migrations/20260724121000_shopify_events.sql`

**Interfaces:**
- Produces: tabella `shopify_events(event_id TEXT PRIMARY KEY, event_type TEXT, processed_at TIMESTAMPTZ)` — dedup per **order id** Shopify.

- [ ] **Step 1: Scrivi la migration** (rispecchia `20260617000000_stripe_events.sql`)

```sql
-- 20260724121000_shopify_events.sql
-- Idempotenza webhook Shopify: registra ogni order id processato così una
-- redelivery di orders/paid non ri-estende il piano né duplica la ricevuta.
-- I rinnovi ricorrenti creano NUOVI order id → passano correttamente.
-- service_role only (scritto dal webhook via exec_sql).
CREATE TABLE IF NOT EXISTS shopify_events (
  event_id     TEXT PRIMARY KEY,   -- Shopify order id
  event_type   TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE shopify_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shopify_events FROM anon, authenticated;
```

- [ ] **Step 2: Applica e verifica**

Run: `psql "$DATABASE_URL" -f supabase/migrations/20260724121000_shopify_events.sql`
Expected: `\d shopify_events` mostra la tabella con PK su `event_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260724121000_shopify_events.sql
git commit -m "feat(billing): tabella shopify_events per idempotenza webhook"
```

---

### Task 4: `lib/shopify.ts` — HMAC + resolver piano (funzioni pure, TDD)

**Files:**
- Create: `lib/shopify.ts`
- Test: `tests/shopify.test.ts`

**Interfaces:**
- Produces:
  - `isShopifyConfigured(): boolean`
  - `verifyShopifyHmac(rawBody: string, hmacHeader: string | null): boolean`
  - `resolvePlanFromVariant(variantId: string | number | null | undefined): "base" | "premium" | null`
  - `extractOrder(payload: unknown): { orderId: string; email: string | null; identifier: string | null; variantId: string | null } | null`

- [ ] **Step 1: Scrivi i test (falliscono)**

```ts
// tests/shopify.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { verifyShopifyHmac, resolvePlanFromVariant, extractOrder } from "../lib/shopify";

const SECRET = "whsec_test_123";
beforeEach(() => {
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
  process.env.SHOPIFY_VARIANT_BASE = "111";
  process.env.SHOPIFY_VARIANT_PREMIUM = "222";
});
function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}

describe("verifyShopifyHmac", () => {
  it("accetta una firma valida", () => {
    const body = '{"id":1}';
    expect(verifyShopifyHmac(body, sign(body))).toBe(true);
  });
  it("rifiuta firma errata o header mancante", () => {
    expect(verifyShopifyHmac('{"id":1}', "deadbeef")).toBe(false);
    expect(verifyShopifyHmac('{"id":1}', null)).toBe(false);
  });
});

describe("resolvePlanFromVariant", () => {
  it("mappa i variant id configurati", () => {
    expect(resolvePlanFromVariant("111")).toBe("base");
    expect(resolvePlanFromVariant(222)).toBe("premium");
    expect(resolvePlanFromVariant("999")).toBe(null);
  });
});

describe("extractOrder", () => {
  it("estrae orderId, email, identifier e variant dal payload orders/paid", () => {
    const payload = {
      id: 5001,
      email: "User@Test.com",
      note_attributes: [{ name: "identifier", value: "user@test.com" }],
      line_items: [{ variant_id: 222 }],
    };
    const o = extractOrder(payload)!;
    expect(o.orderId).toBe("5001");
    expect(o.email).toBe("User@Test.com");
    expect(o.identifier).toBe("user@test.com");
    expect(o.variantId).toBe("222");
  });
  it("ritorna null se manca l'id ordine", () => {
    expect(extractOrder({ email: "x@y.com" })).toBe(null);
  });
});
```

- [ ] **Step 2: Esegui i test → falliscono**

Run: `npm test -- tests/shopify.test.ts`
Expected: FAIL ("Cannot find module '../lib/shopify'").

- [ ] **Step 3: Implementa `lib/shopify.ts`**

```ts
import crypto from "node:crypto";

export function isShopifyConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_WEBHOOK_SECRET &&
      process.env.SHOPIFY_VARIANT_BASE &&
      process.env.SHOPIFY_VARIANT_PREMIUM
  );
}

// Shopify firma il RAW body con HMAC-SHA256 (base64) usando il webhook secret.
export function verifyShopifyHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function resolvePlanFromVariant(
  variantId: string | number | null | undefined
): "base" | "premium" | null {
  if (variantId == null) return null;
  const v = String(variantId);
  if (v === process.env.SHOPIFY_VARIANT_BASE) return "base";
  if (v === process.env.SHOPIFY_VARIANT_PREMIUM) return "premium";
  return null;
}

type OrderShape = {
  id?: unknown;
  email?: unknown;
  note_attributes?: Array<{ name?: string; value?: string }>;
  line_items?: Array<{ variant_id?: unknown }>;
};

export function extractOrder(
  payload: unknown
): { orderId: string; email: string | null; identifier: string | null; variantId: string | null } | null {
  const o = (payload ?? {}) as OrderShape;
  if (o.id == null) return null;
  const email = typeof o.email === "string" ? o.email : null;
  const attr = (o.note_attributes ?? []).find((a) => a?.name === "identifier");
  const identifier = attr?.value ?? (email ? email.toLowerCase().trim() : null);
  const variantId = o.line_items?.[0]?.variant_id != null ? String(o.line_items[0].variant_id) : null;
  return { orderId: String(o.id), email, identifier, variantId };
}
```

- [ ] **Step 4: Esegui i test → passano**

Run: `npm test -- tests/shopify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/shopify.ts tests/shopify.test.ts
git commit -m "feat(billing): lib/shopify HMAC verify + resolver piano/ordine"
```

---

### Task 5: `activateShopifyPlan` con guardia grandfather (TDD)

**Files:**
- Modify: `lib/plan-grant.ts` (aggiungi export `activateShopifyPlan`; estendi `ActivationSource`)
- Test: `tests/shopify-grant.test.ts`

**Interfaces:**
- Consumes: `computePaygateGrant` (esistente, matematica grant riusabile), `dbQuery`/`dbExecute`.
- Produces: `activateShopifyPlan(identifier: string, plan: "base"|"premium", period: "monthly"|"annual"): Promise<ActivatedRow | null>` — ritorna `null` se identifier inesistente O se bloccato dalla guardia grandfather.

- [ ] **Step 1: Scrivi il test della guardia grandfather (unità pura sulla decisione)**

La decisione "posso scrivere questa riga?" va estratta in una funzione pura testabile:

```ts
// tests/shopify-grant.test.ts
import { describe, it, expect } from "vitest";
import { shopifyGrantAllowed } from "../lib/plan-grant";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const past = new Date(Date.now() - 5 * 86_400_000).toISOString();

describe("shopifyGrantAllowed (grandfather)", () => {
  it("BLOCCA se un abbonato PayGate è ancora attivo", () => {
    expect(shopifyGrantAllowed("paygate", future)).toBe(false);
  });
  it("PERMETTE se il PayGate è scaduto", () => {
    expect(shopifyGrantAllowed("paygate", past)).toBe(true);
  });
  it("PERMETTE per sorgente shopify o nulla (free/mai pagante)", () => {
    expect(shopifyGrantAllowed("shopify", future)).toBe(true);
    expect(shopifyGrantAllowed(null, null)).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui → fallisce**

Run: `npm test -- tests/shopify-grant.test.ts`
Expected: FAIL ("shopifyGrantAllowed is not a function").

- [ ] **Step 3: Implementa `shopifyGrantAllowed` + `activateShopifyPlan` in `lib/plan-grant.ts`**

Estendi il type sorgente e aggiungi le due funzioni (modella su `activatePaypalPlan`):

```ts
// in cima: estendi ActivationSource
type ActivationSource = "admin" | "stripe" | "paygate" | "paypal" | "shopify";

// Guardia grandfather PURA: un abbonato PayGate ancora attivo non va
// sovrascritto da un grant Shopify (caso raro di doppio abbonamento).
export function shopifyGrantAllowed(
  currentSource: string | null,
  currentExpiryISO: string | null
): boolean {
  if (currentSource !== "paygate") return true;
  if (!currentExpiryISO) return true;
  return new Date(currentExpiryISO).getTime() <= Date.now();
}

// Grant Shopify: stesso modello one-shot di PayGate/PayPal (riusa
// computePaygateGrant → stack residuo + anti-downgrade). Ritorna null se
// l'identifier non esiste (→ riconciliazione) o se bloccato dalla guardia.
export async function activateShopifyPlan(
  identifier: string,
  plan: GrantablePlan,
  period: "monthly" | "annual"
): Promise<ActivatedRow | null> {
  const days = period === "annual" ? 365 : 30;
  const prev = await dbQuery<{
    plan: string;
    name: string | null;
    plan_expires_at: string | null;
    plan_source: string | null;
  }>(
    `SELECT plan, name, plan_expires_at::text AS plan_expires_at, plan_source FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      LIMIT 1`,
    [identifier]
  );
  const before = prev[0];
  if (!before) return null; // identifier-not-found → il chiamante logga la riconciliazione

  if (!shopifyGrantAllowed(before.plan_source, before.plan_expires_at)) {
    console.error("[shopify] grant bloccato: abbonato PayGate attivo", { identifier });
    return null;
  }

  const { plan: newPlan, expiryISO } = computePaygateGrant({
    currentPlan: before.plan,
    currentExpiryISO: before.plan_expires_at,
    purchasedPlan: plan,
    days,
    nowISO: new Date().toISOString(),
  });

  await dbExecute(
    `UPDATE profiles
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = $3::timestamptz,
            plan_source = 'shopify',
            updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [identifier, newPlan, expiryISO]
  );

  const activated: ActivatedRow = { identifier, name: before.name, plan: newPlan };
  if (before.plan !== newPlan) {
    await notifyPlanActivated(activated, "shopify");
  }
  return activated;
}
```

- [ ] **Step 4: Esegui → passa**

Run: `npm test -- tests/shopify-grant.test.ts tests/plan-grant.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-grant.ts tests/shopify-grant.test.ts
git commit -m "feat(billing): activateShopifyPlan + guardia grandfather"
```

---

### Task 6: Webhook `/api/shopify/webhook` (orders/paid)

**Files:**
- Create: `app/api/shopify/webhook/route.ts`
- Test: `tests/shopify-webhook.test.ts` (unità sulla logica di handling, mockando `lib/db` e `lib/plan-grant` come fanno i test esistenti del repo)

**Interfaces:**
- Consumes: `verifyShopifyHmac`, `extractOrder`, `resolvePlanFromVariant` (Task 4); `activateShopifyPlan` (Task 5); `dbQueryStrict`/`dbExecute` (idempotenza, pattern Stripe).

- [ ] **Step 1: Scrivi il test (mock db + grant), verifica i tre comportamenti chiave**

```ts
// tests/shopify-webhook.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const activateShopifyPlan = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(), dbQueryStrict, dbExecute }));
vi.mock("@/lib/plan-grant", () => ({ activateShopifyPlan }));

const SECRET = "whsec_test_123";
function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}
function req(body: string, hmac: string | null) {
  return new Request("https://x/api/shopify/webhook", {
    method: "POST",
    headers: hmac ? { "x-shopify-hmac-sha256": hmac } : {},
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
  process.env.SHOPIFY_VARIANT_BASE = "111";
  process.env.SHOPIFY_VARIANT_PREMIUM = "222";
  dbQueryStrict.mockResolvedValue([]); // non ancora visto
});

it("rifiuta firma non valida con 401", async () => {
  const { POST } = await import("../app/api/shopify/webhook/route");
  const res = await POST(req('{"id":1}', "bad"));
  expect(res.status).toBe(401);
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});

it("concede il piano su orders/paid valido", async () => {
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "premium" });
  const body = JSON.stringify({ id: 900, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("../app/api/shopify/webhook/route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "premium", "monthly");
});

it("è idempotente: evento già visto → no grant", async () => {
  dbQueryStrict.mockResolvedValue([{ event_id: "900" }]);
  const body = JSON.stringify({ id: 900, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("../app/api/shopify/webhook/route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Esegui → fallisce**

Run: `npm test -- tests/shopify-webhook.test.ts`
Expected: FAIL (route inesistente).

- [ ] **Step 3: Implementa la route** (modella su `app/api/stripe/webhook/route.ts`)

```ts
import { NextResponse } from "next/server";
import { verifyShopifyHmac, extractOrder, resolvePlanFromVariant, isShopifyConfigured } from "@/lib/shopify";
import { activateShopifyPlan } from "@/lib/plan-grant";
import { dbQueryStrict, dbExecute } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: "shopify not configured" }, { status: 503 });
  }

  const raw = await req.text(); // raw body obbligatorio per l'HMAC
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyHmac(raw, hmac)) {
    console.error("[shopify/webhook] bad signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const order = extractOrder(payload);
  if (!order) {
    return NextResponse.json({ received: true, skipped: "no order id" });
  }

  // Idempotenza per order id (pattern stripe_events). SELECT-prima (fail-loud),
  // poi INSERT ON CONFLICT DO NOTHING; rollback della riga se l'handler throwa.
  try {
    const seen = await dbQueryStrict<{ event_id: string }>(
      `SELECT event_id FROM shopify_events WHERE event_id = $1 LIMIT 1`,
      [order.orderId]
    );
    if (seen.length > 0) return NextResponse.json({ received: true, duplicate: true });
    await dbExecute(
      `INSERT INTO shopify_events (event_id, event_type) VALUES ($1, 'orders/paid')
       ON CONFLICT (event_id) DO NOTHING`,
      [order.orderId]
    );
  } catch (e) {
    console.error("[shopify/webhook] idempotency unavailable:", String(e));
    return NextResponse.json({ error: "idempotency unavailable" }, { status: 500 });
  }

  try {
    const plan = resolvePlanFromVariant(order.variantId);
    if (!order.identifier || !plan) {
      // Non mappabile: NON scartare in silenzio → resta senza grant per la reconcile.
      console.error("[shopify/webhook] unresolved order", { order });
      return NextResponse.json({ received: true, unresolved: true });
    }
    const granted = await activateShopifyPlan(order.identifier, plan, "monthly");
    if (!granted) {
      console.error("[shopify/webhook] grant null (utente inesistente o grandfather)", {
        identifier: order.identifier,
      });
    }
  } catch (e) {
    console.error("[shopify/webhook] handler error:", String(e));
    // Rollback idempotenza così Shopify ritenta (pattern Stripe).
    try {
      await dbExecute(`DELETE FROM shopify_events WHERE event_id = $1`, [order.orderId]);
    } catch (delErr) {
      console.error("[shopify/webhook] idempotency rollback failed:", String(delErr));
    }
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Esegui → passa**

Run: `npm test -- tests/shopify-webhook.test.ts`
Expected: PASS (3 test verdi).

- [ ] **Step 5: Commit**

```bash
git add app/api/shopify/webhook/route.ts tests/shopify-webhook.test.ts
git commit -m "feat(billing): webhook /api/shopify/webhook (orders/paid, HMAC, idempotente)"
```

---

### Task 7: Entry-point checkout Shopify (front-end, nuovi abbonati)

**Files:**
- Modify: la CTA di acquisto piano (localizzala — vedi Step 1)

- [ ] **Step 1: Localizza la CTA attuale di acquisto**

Run: `grep -rn "paygate/checkout\|requested_plan\|Abbonati\|/api/paygate" app components | grep -iv node_modules`
Individua il/i componente/i che oggi avviano il checkout PayGate per base/premium.

- [ ] **Step 2: Aggiungi il ramo Shopify per i NUOVI abbonati**

Per un utente senza `plan_source='paygate'` attivo, la CTA base/premium apre il **permalink checkout Shopify** (da Task 1) con email pre-compilata e `identifier` in `note_attributes` (via URL param `attributes[identifier]=<email>` o `checkout[email]=<email>` secondo il permalink). Gli abbonati PayGate attivi mantengono il rinnovo PayGate finché non scadono.

- [ ] **Step 3: Recepisci le condizioni di copy del Task 0** (posizionamento non-gambling: nessun claim vietato nella pagina di checkout/prezzi).

- [ ] **Step 4: Visual check** (regola progetto: no deploy UI senza visual check, da loggato — desktop + mobile via Playwright/webapp-testing).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(billing): CTA checkout Shopify per nuovi abbonati (grandfather PayGate)"
```

---

### Task 8: Cron reconcile `/api/cron/shopify-reconcile`

**Files:**
- Create: `app/api/cron/shopify-reconcile/route.ts` (modella su `app/api/cron/paygate-reconcile/route.ts`)
- Modify: `vercel.json` (aggiungi la schedule del cron)

- [ ] **Step 1:** Implementa la route gated da `CRON_SECRET` (stesso `verifyBearer` di paygate-reconcile): rileva `shopify_events` senza grant applicato (o ordini paid senza piano) e ri-tenta `activateShopifyPlan`; fail-loud → `opsAlert`. Riusa l'impianto del cron PayGate.
- [ ] **Step 2:** Aggiungi la schedule in `vercel.json` (es. ogni 6h).
- [ ] **Step 3:** Test manuale con header `Authorization: Bearer $CRON_SECRET` su preview.
- [ ] **Step 4: Commit**

```bash
git add app/api/cron/shopify-reconcile/route.ts vercel.json
git commit -m "feat(billing): cron shopify-reconcile (self-heal grant)"
```

---

### Task 9: Email di migrazione grandfather (CRM)

**Files:**
- Modify: impianto CRM/email esistente (`lib/email.ts` + il cron CRM lifecycle già attivo)

- [ ] **Step 1:** Aggiungi un template "riabbonati su Shopify" (brandedShell esistente) con link al checkout.
- [ ] **Step 2:** Segmento: `profiles.plan_source='paygate' AND plan_expires_at` entro N giorni. Invio via il cron CRM esistente (opt-in enforced).
- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(billing): email migrazione PayGate→Shopify (grandfather)"
```

---

### Task 10: Verifica end-to-end (gate pre-deploy)

**Files:** nessuno (checklist di verifica).

- [ ] **Step 1:** Suite completa verde: `npm test`
- [ ] **Step 2:** E2E su preview con **bogus gateway** Shopify: signup → checkout base → webhook `orders/paid` → `profiles.plan='base'`, `plan_source='shopify'`, board sbloccata al tier corretto.
- [ ] **Step 3:** Idempotenza: redelivery dello stesso `orders/paid` → nessuna doppia estensione (verifica `plan_expires_at` invariata).
- [ ] **Step 4:** Regressione grandfather: profilo di test `plan_source='paygate'`, `plan_expires_at` futura → un `orders/paid` Shopify NON lo sovrascrive (`activateShopifyPlan` ritorna null, log conflitto).
- [ ] **Step 5:** Scadenza: metti `plan_expires_at` nel passato → `lib/auth.ts effectivePlan` declassa a `free` alla lettura (board bloccata).
- [ ] **Step 6:** **PROPOSAL + APPROVE** prima del deploy prod (branch+PR, migration additive prima del codice, PayGate resta acceso).
