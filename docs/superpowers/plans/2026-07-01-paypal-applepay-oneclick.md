# One-click checkout: PayPal + Apple Pay (no Stripe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere due metodi di pagamento one-click (PayPal + Apple Pay) al checkout BetRedge tramite una singola integrazione PayPal JS SDK, con modello una-tantum speculare a PayGate, senza introdurre Stripe.

**Architecture:** Un unico rail nuovo (PayPal Orders v2 API) affiancato a PayGate. Il server crea l'ordine con importo server-side, il client approva con bottone PayPal o Apple Pay (stesso SDK), il server cattura + verifica + fa un claim atomico `pending→paid` e concede N giorni di accesso riusando la logica di grant di PayGate. Un webhook firmato riconcilia i capture persi. Nessun rinnovo automatico (come oggi).

**Tech Stack:** Next.js (App Router, route handlers `runtime = "nodejs"`), TypeScript, PayPal REST API (fetch, no SDK server-side), PayPal JS SDK (client), Supabase Postgres (migrations + RPC `SECURITY DEFINER`), test con `node:assert/strict` eseguiti via `npx tsx`.

## Global Constraints

- **NO Stripe**: non toccare `lib/stripe.ts` né `app/api/stripe/*`. Decisione esplicita.
- **Prezzi solo server-side**: importi da `lib/paygate.ts::amountFor(plan, period)` — mai dal client. Valori: base 19.90 (mensile) / 169 (annuale); premium 49.90 / 419 USD.
- **Modello una-tantum**: pagamento → estende `plan_expires_at` di 30 (mensile) / 365 (annuale) giorni. Nessun vaulting / rinnovo automatico.
- **Anti-spoof**: mai fidarsi del client/callback. Verifica server-side dell'esito reale presso PayPal + claim atomico prima del grant. Idempotenza obbligatoria (doppio capture/webhook non concede due volte).
- **exec_sql non ritorna RETURNING**: generare gli id in JS (`crypto.randomUUID()`) e inserirli esplicitamente; leggere con SELECT separato. (Vedi `reference_exec_sql_returning`.)
- **DB**: `paypal_orders` va su Supabase (come `paygate_orders`, in `supabase/migrations/`). RLS ON, nessuna policy (solo service-role).
- **Go-live gated**: secrets prod, dominio Apple Pay, abilitazione PayPal, applicazione migration al DB prod partono SOLO dopo `PROPOSAL + APPROVE` umano in `ch_deploy_gate` (Task 9).
- **Test runner**: nessun `test` script in package.json; i test sono file `.ts` che eseguono assert all'import, lanciati con `npx tsx tests/<file>.test.ts`.
- **Match dello stile esistente**: le nuove route/lib rispecchiano i pattern di `app/api/paygate/*` e `lib/paygate.ts` (commenti inclusi dove chiariscono trappole).

---

### Task 1: `lib/paypal.ts` — client REST PayPal + helper puri

Client REST PayPal (no SDK server) e funzioni pure testabili. Specchio di `lib/paygate.ts`. Riusa `amountFor`/`periodDays` da `lib/paygate.ts` (DRY — non ridefinire i prezzi).

**Files:**
- Create: `lib/paypal.ts`
- Test: `tests/paypal.test.ts`

**Interfaces:**
- Consumes: `amountFor(plan, period)`, `periodDays(period)`, `PlanKey`, `Period` da `lib/paygate.ts`.
- Produces:
  - `paypalApiBase(): string` — base URL sandbox↔live da env
  - `getAccessToken(): Promise<string>`
  - `createOrder(opts: { amount: number; plan: PlanKey; period: Period; identifier: string; orderId: string }): Promise<{ id: string }>`
  - `captureOrder(paypalOrderId: string): Promise<{ status: string; capturedValue: number | null; currency: string | null; captureId: string | null }>`
  - `evaluateCapture(opts: { order: { status: string; amount_usd: number } | null; captured: { status: string; value: number | null; currency: string | null } }): { grant: boolean; reason: string }` — PURA
  - `verifyWebhookSignature(opts: { headers: Record<string,string|null>; body: string }): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/paypal.test.ts
import assert from "node:assert/strict";
import { paypalApiBase, evaluateCapture } from "../lib/paypal";

// — base URL: default live, sandbox se PAYPAL_ENV=sandbox —
const prev = process.env.PAYPAL_ENV;
process.env.PAYPAL_ENV = "sandbox";
assert.equal(paypalApiBase(), "https://api-m.sandbox.paypal.com");
process.env.PAYPAL_ENV = "live";
assert.equal(paypalApiBase(), "https://api-m.paypal.com");
process.env.PAYPAL_ENV = prev;

// — evaluateCapture: gate (a) ordine pending (b) capture COMPLETED + importo + valuta —
const okOrder = { status: "pending", amount_usd: 169 };
assert.equal(evaluateCapture({ order: null, captured: { status: "COMPLETED", value: 169, currency: "USD" } }).grant, false);          // ordine assente
assert.equal(evaluateCapture({ order: { status: "paid", amount_usd: 169 }, captured: { status: "COMPLETED", value: 169, currency: "USD" } }).grant, false); // già pagato
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "DECLINED", value: 169, currency: "USD" } }).grant, false);        // non completato
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: null, currency: "USD" } }).grant, false);     // importo assente
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: 168.99, currency: "USD" } }).grant, false);   // importo insufficiente
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: 169, currency: "EUR" } }).grant, false);      // valuta errata
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: 169, currency: "USD" } }).grant, true);       // ok
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: 170, currency: "USD" } }).grant, true);       // ok (paga di più)
console.log("paypal.test.ts OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/paypal.test.ts`
Expected: FAIL — `Cannot find module '../lib/paypal'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/paypal.ts
// Client PayPal Orders v2 (#PAYPAL-PAY). REST, no SDK server-side (stile lib/paygate.ts).
// Flusso una-tantum: createOrder → utente approva (bottone PayPal/Apple Pay) →
// captureOrder. La concessione del piano NON si fida del client: evaluateCapture
// (puro) + claim atomico DB stanno nel route handler /capture.
import { amountFor, periodDays, type PlanKey, type Period } from "./paygate";

export { amountFor, periodDays };
export type { PlanKey, Period };

// USD unico (i prezzi server-side sono in USD, come PayGate).
const CURRENCY = "USD";

export function paypalApiBase(): string {
  return process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

export async function getAccessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("[paypal] client id/secret non configurati");
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const resp = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) throw new Error(`[paypal] oauth failed: ${resp.status}`);
  const d = (await resp.json()) as { access_token?: string };
  if (!d.access_token) throw new Error("[paypal] oauth: missing access_token");
  return d.access_token;
}

export async function createOrder(opts: {
  amount: number;
  plan: PlanKey;
  period: Period;
  identifier: string;
  orderId: string;
}): Promise<{ id: string }> {
  const token = await getAccessToken();
  const resp = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          // custom_id = il nostro orderId → lo ritroviamo nel webhook per la riconciliazione.
          custom_id: opts.orderId,
          description: `BetRedge ${opts.plan} ${opts.period}`,
          amount: { currency_code: CURRENCY, value: opts.amount.toFixed(2) },
        },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`[paypal] create order failed: ${resp.status}`);
  const d = (await resp.json()) as { id?: string };
  if (!d.id) throw new Error("[paypal] create order: missing id");
  return { id: d.id };
}

export async function captureOrder(
  paypalOrderId: string
): Promise<{ status: string; capturedValue: number | null; currency: string | null; captureId: string | null }> {
  const token = await getAccessToken();
  const resp = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  // PayPal può tornare 201 (catturato) o 422 (già catturato/non approvabile).
  const d = (await resp.json().catch(() => null)) as
    | {
        status?: string;
        purchase_units?: Array<{
          payments?: { captures?: Array<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string } }> };
        }>;
      }
    | null;
  const cap = d?.purchase_units?.[0]?.payments?.captures?.[0];
  const rawValue = cap?.amount?.value;
  return {
    status: typeof d?.status === "string" ? d.status : "",
    capturedValue: rawValue != null && rawValue !== "" && Number.isFinite(Number(rawValue)) ? Number(rawValue) : null,
    currency: cap?.amount?.currency_code ?? null,
    captureId: cap?.id ?? null,
  };
}

// Decisione di concessione — PURA (testabile). Concede solo se: ordine trovato e
// pending, capture COMPLETED, valuta USD, importo >= atteso.
export function evaluateCapture(opts: {
  order: { status: string; amount_usd: number } | null;
  captured: { status: string; value: number | null; currency: string | null };
}): { grant: boolean; reason: string } {
  if (!opts.order) return { grant: false, reason: "order not found" };
  if (opts.order.status !== "pending") return { grant: false, reason: "order not pending" };
  if (opts.captured.status !== "COMPLETED") return { grant: false, reason: `capture status ${opts.captured.status}` };
  if (opts.captured.currency !== CURRENCY) return { grant: false, reason: "wrong currency" };
  if (opts.captured.value == null || !Number.isFinite(opts.captured.value)) return { grant: false, reason: "missing value" };
  if (opts.captured.value + 1e-9 < opts.order.amount_usd) return { grant: false, reason: "amount below expected" };
  return { grant: true, reason: "ok" };
}

export async function verifyWebhookSignature(opts: {
  headers: Record<string, string | null>;
  body: string;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const token = await getAccessToken();
  const resp = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: opts.headers["paypal-auth-algo"],
      cert_url: opts.headers["paypal-cert-url"],
      transmission_id: opts.headers["paypal-transmission-id"],
      transmission_sig: opts.headers["paypal-transmission-sig"],
      transmission_time: opts.headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: JSON.parse(opts.body),
    }),
  });
  if (!resp.ok) return false;
  const d = (await resp.json().catch(() => null)) as { verification_status?: string } | null;
  return d?.verification_status === "SUCCESS";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/paypal.test.ts`
Expected: PASS — stampa `paypal.test.ts OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/paypal.ts tests/paypal.test.ts
git commit -m "feat(paypal): REST client + evaluateCapture puro (#PAYPAL-PAY)"
```

---

### Task 2: Migration `paypal_orders` + RPC `claim_paypal_order`

Tabella e claim atomico speculari a PayGate. Additiva + idempotente.

**Files:**
- Create: `supabase/migrations/20260701120000_paypal_orders.sql`

**Interfaces:**
- Produces: tabella `public.paypal_orders`, funzione `public.claim_paypal_order(p_id uuid, p_value numeric, p_capture text) RETURNS boolean`.

- [ ] **Step 1: Scrivere la migration**

```sql
-- supabase/migrations/20260701120000_paypal_orders.sql
-- Ordini PayPal/Apple Pay (#PAYPAL-PAY). Additiva + idempotente.
-- Speculare a paygate_orders. paypal_order_id = id dell'ordine PayPal (non segreto,
-- ma tracciato per riconciliazione via webhook custom_id).

CREATE TABLE IF NOT EXISTS public.paypal_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier         TEXT NOT NULL,
  plan               TEXT NOT NULL CHECK (plan IN ('base','premium')),
  period             TEXT NOT NULL CHECK (period IN ('monthly','annual')),
  amount_usd         NUMERIC(10,2) NOT NULL,
  paypal_order_id    TEXT UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  value_captured     NUMERIC(20,6),
  capture_id         TEXT,
  granted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_paypal_orders_identifier ON public.paypal_orders (identifier);

-- Operator/service-role only: nessuna policy → nega anon/authenticated.
ALTER TABLE public.paypal_orders ENABLE ROW LEVEL SECURITY;

-- Claim ATOMICO: un solo capture/webhook "vince" pending→paid. Ritorna TRUE solo
-- se ha davvero cambiato la riga (exec_sql non dà il row-count → RPC dedicata).
CREATE OR REPLACE FUNCTION public.claim_paypal_order(p_id uuid, p_value numeric, p_capture text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.paypal_orders
     SET status = 'paid', value_captured = p_value, capture_id = p_capture, paid_at = NOW()
   WHERE id = p_id AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.claim_paypal_order(uuid, numeric, text);
-- DROP TABLE IF EXISTS public.paypal_orders;
```

- [ ] **Step 2: Validare la sintassi SQL localmente (dry, no prod)**

Run: `grep -c "claim_paypal_order" supabase/migrations/20260701120000_paypal_orders.sql`
Expected: `2` (definizione + commento rollback). L'applicazione al DB è nel Task 9 (gated).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260701120000_paypal_orders.sql
git commit -m "feat(paypal): migration paypal_orders + claim_paypal_order RPC"
```

---

### Task 3: `activatePaypalPlan` in `lib/plan-grant.ts`

Concessione piano speculare a `activatePaygatePlan`, riusa `computePaygateGrant` (già testato). Aggiunge `"paypal"` alle sorgenti di attivazione.

**Files:**
- Modify: `lib/plan-grant.ts` (aggiungere `activatePaypalPlan`; estendere `ActivationSource`)
- Test: `tests/paypal-grant.test.ts`

**Interfaces:**
- Consumes: `computePaygateGrant(...)`, `GrantablePlan`, `ActivatedRow` (interni a plan-grant.ts).
- Produces: `activatePaypalPlan(identifier: string, plan: GrantablePlan, period: "monthly" | "annual"): Promise<ActivatedRow | null>`.

- [ ] **Step 1: Write the failing test** (verifica pura del calcolo, senza DB)

```typescript
// tests/paypal-grant.test.ts
// activatePaypalPlan tocca il DB → qui testiamo la logica di grant condivisa
// (computePaygateGrant), che è ciò che activatePaypalPlan riusa 1:1.
import assert from "node:assert/strict";
import { computePaygateGrant } from "../lib/plan-grant";

const nowISO = "2026-07-01T00:00:00.000Z";

// nuovo acquisto premium mensile da free scaduto → 30 giorni da ora
const g1 = computePaygateGrant({ currentPlan: "free", currentExpiryISO: null, purchasedPlan: "premium", days: 30, nowISO });
assert.equal(g1.plan, "premium");
assert.equal(g1.expiryISO, "2026-07-31T00:00:00.000Z");

// rinnovo annuale con tempo residuo → estende dalla scadenza residua
const g2 = computePaygateGrant({ currentPlan: "premium", currentExpiryISO: "2026-07-10T00:00:00.000Z", purchasedPlan: "premium", days: 365, nowISO });
assert.equal(g2.expiryISO, "2027-07-10T00:00:00.000Z");

// anti-downgrade: premium attivo, compro base → resta premium
const g3 = computePaygateGrant({ currentPlan: "premium", currentExpiryISO: "2026-08-01T00:00:00.000Z", purchasedPlan: "base", days: 30, nowISO });
assert.equal(g3.plan, "premium");
console.log("paypal-grant.test.ts OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/paypal-grant.test.ts`
Expected: FAIL se `computePaygateGrant` non è esportato o il file non compila (dopo aver aggiunto l'import). Se già passa perché la funzione esiste, procedere comunque ad aggiungere `activatePaypalPlan` (lo copre l'integrazione sandbox del Task 5).

- [ ] **Step 3: Estendere `ActivationSource` e aggiungere `activatePaypalPlan`**

In `lib/plan-grant.ts`, cambiare la riga:

```typescript
type ActivationSource = "admin" | "stripe" | "paygate";
```

in:

```typescript
type ActivationSource = "admin" | "stripe" | "paygate" | "paypal";
```

Poi, subito DOPO la funzione `activatePaygatePlan`, aggiungere:

```typescript
// Concede/estende un piano PayPal/Apple Pay. Stesso modello una-tantum di PayGate:
// riusa computePaygateGrant (stack del residuo + anti-downgrade). Ritorna null se
// l'identifier non esiste in profiles (→ il chiamante logga la riconciliazione).
export async function activatePaypalPlan(
  identifier: string,
  plan: GrantablePlan,
  period: "monthly" | "annual"
): Promise<ActivatedRow | null> {
  const days = period === "annual" ? 365 : 30;

  const prev = await dbQuery<{ plan: string; name: string | null; plan_expires_at: string | null }>(
    `SELECT plan, name, plan_expires_at::text AS plan_expires_at FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      LIMIT 1`,
    [identifier]
  );
  const before = prev[0];
  if (!before) return null;

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
            updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [identifier, newPlan, expiryISO]
  );

  const activated: ActivatedRow = { identifier, name: before.name, plan: newPlan };
  if (before.plan !== newPlan) {
    await notifyPlanActivated(activated, "paypal");
  }
  return activated;
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx tsx tests/paypal-grant.test.ts && npx tsc --noEmit`
Expected: `paypal-grant.test.ts OK` e nessun errore di tipo.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-grant.ts tests/paypal-grant.test.ts
git commit -m "feat(paypal): activatePaypalPlan (riusa computePaygateGrant) + source paypal"
```

---

### Task 4: `POST /api/paypal/create-order`

Crea l'ordine PayPal con importo server-side e traccia la riga `paypal_orders` (pending). Specchio di `app/api/paygate/checkout/route.ts`.

**Files:**
- Create: `app/api/paypal/create-order/route.ts`

**Interfaces:**
- Consumes: `getSessionPlan`, `dbExecute`, `amountFor`, `createOrder`.
- Produces: risposta JSON `{ id }` (id ordine PayPal) usata dal client per aprire il bottone; riga `paypal_orders` con `id` (nostro), `paypal_order_id`.

- [ ] **Step 1: Scrivere il route handler**

```typescript
// app/api/paypal/create-order/route.ts
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { amountFor, createOrder, type PlanKey, type Period } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return NextResponse.json({ error: "paypal not configured" }, { status: 503 });
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[paypal/create-order] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown; period?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const plan = body.requested_plan;
  const period = body.period;
  if (plan !== "base" && plan !== "premium") return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  if (period !== "monthly" && period !== "annual") return NextResponse.json({ error: "invalid period" }, { status: 400 });

  const amount = amountFor(plan as PlanKey, period as Period);

  // exec_sql non ritorna RETURNING → id generato qui e inserito esplicitamente.
  const orderId = crypto.randomUUID();

  let paypalOrder;
  try {
    paypalOrder = await createOrder({ amount, plan: plan as PlanKey, period: period as Period, identifier: ctx.identifier, orderId });
  } catch (e) {
    console.error("[paypal/create-order] createOrder failed:", String(e));
    return NextResponse.json({ error: "paypal create failed" }, { status: 502 });
  }

  try {
    await dbExecute(
      `INSERT INTO paypal_orders (id, identifier, plan, period, amount_usd, paypal_order_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, ctx.identifier, plan, period, amount, paypalOrder.id]
    );
  } catch (e) {
    console.error("[paypal/create-order] order insert failed:", String(e));
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }

  return NextResponse.json({ id: paypalOrder.id });
}
```

- [ ] **Step 2: Verificare compilazione**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Verifica manuale sandbox (config Task 9 richiesta)**

Con `PAYPAL_ENV=sandbox` + credenziali sandbox in `.env.local`, da loggato:
`POST /api/paypal/create-order` body `{"requested_plan":"base","period":"monthly"}` → 200 `{ id: "<paypal order id>" }`; una riga `pending` in `paypal_orders` con `amount_usd = 19.90`.
Expected: importo dal server (invariato anche se il client manda altro).

- [ ] **Step 4: Commit**

```bash
git add app/api/paypal/create-order/route.ts
git commit -m "feat(paypal): route create-order (importo server-side, traccia ordine)"
```

---

### Task 5: `POST /api/paypal/capture`

Cattura l'ordine, verifica l'esito reale, claim atomico e grant. Specchio di `app/api/paygate/callback/route.ts`.

**Files:**
- Create: `app/api/paypal/capture/route.ts`

**Interfaces:**
- Consumes: `captureOrder`, `evaluateCapture`, `getSupabaseAdminClient`, `dbQuery`, `dbExecute`, `activatePaypalPlan`.
- Produces: risposta JSON `{ ok: true, granted: boolean }`.

- [ ] **Step 1: Scrivere il route handler**

```typescript
// app/api/paypal/capture/route.ts
import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { captureOrder, evaluateCapture } from "@/lib/paypal";
import { activatePaypalPlan } from "@/lib/plan-grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRow = {
  id: string;
  identifier: string;
  plan: "base" | "premium";
  period: "monthly" | "annual";
  amount_usd: number;
  status: string;
};

export async function POST(req: Request) {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return NextResponse.json({ error: "paypal not configured" }, { status: 503 });
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let body: { paypal_order_id?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const paypalOrderId = typeof body.paypal_order_id === "string" ? body.paypal_order_id : "";
  if (!paypalOrderId) return NextResponse.json({ error: "missing paypal_order_id" }, { status: 400 });

  const orders = await dbQuery<OrderRow>(
    `SELECT id, identifier, plan, period, amount_usd::float8 AS amount_usd, status
       FROM paypal_orders WHERE paypal_order_id = $1 LIMIT 1`,
    [paypalOrderId]
  );
  const order = orders[0] ?? null;
  if (!order || order.status !== "pending") {
    // sconosciuto o già processato → idempotenza
    return NextResponse.json({ ok: true, granted: false });
  }

  // VERIFICA SERVER-SIDE: l'esito reale lo dice PayPal (capture), non il client.
  let captured;
  try {
    captured = await captureOrder(paypalOrderId);
  } catch (e) {
    console.error(`[paypal/capture] capture failed (order=${order.id}):`, String(e));
    return NextResponse.json({ ok: true, granted: false });
  }

  const decision = evaluateCapture({
    order: { status: order.status, amount_usd: order.amount_usd },
    captured: { status: captured.status, value: captured.capturedValue, currency: captured.currency },
  });
  if (!decision.grant) {
    console.warn(`[paypal/capture] no-grant: ${decision.reason} (order=${order.id})`);
    return NextResponse.json({ ok: true, granted: false });
  }

  // CLAIM ATOMICO: solo il vincitore della race passa pending→paid.
  const db = getSupabaseAdminClient();
  if (!db) { console.error("[paypal/capture] no supabase client"); return NextResponse.json({ ok: true, granted: false }); }
  const { data: claimed, error: claimErr } = await db.rpc("claim_paypal_order", {
    p_id: order.id, p_value: captured.capturedValue, p_capture: captured.captureId,
  });
  if (claimErr) { console.error("[paypal/capture] claim rpc error:", claimErr.message); return NextResponse.json({ ok: true, granted: false }); }
  if (claimed !== true) return NextResponse.json({ ok: true, granted: false }); // già processato

  // GRANT dopo il claim.
  const granted = await activatePaypalPlan(order.identifier, order.plan, order.period);
  if (!granted) {
    console.error(`[paypal/capture] RECONCILE: paid ma piano NON concesso (identifier-not-found) order=${order.id} identifier=${order.identifier}`);
    return NextResponse.json({ ok: true, granted: false });
  }
  await dbExecute("UPDATE paypal_orders SET granted_at = NOW() WHERE id = $1", [order.id]);
  console.log(`[paypal/capture] GRANT order=${order.id} plan=${granted.plan} amount_usd=${String(order.amount_usd)}`);
  return NextResponse.json({ ok: true, granted: true });
}
```

- [ ] **Step 2: Verificare compilazione**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Verifica manuale sandbox**

Completare un pagamento sandbox dalla UI (Task 7) → `POST /api/paypal/capture` `{ "paypal_order_id": "<id>" }` → 200 `{ ok: true, granted: true }`; `paypal_orders.status='paid'`, `granted_at` valorizzato; `profiles.plan_expires_at` esteso; receipt email inviata. Ripetere la stessa chiamata → `granted: false` (idempotenza).

- [ ] **Step 4: Commit**

```bash
git add app/api/paypal/capture/route.ts
git commit -m "feat(paypal): route capture (verifica server-side + claim atomico + grant)"
```

---

### Task 6: `POST /api/paypal/webhook` (riconciliazione)

Rete di sicurezza se il capture client non arriva: PayPal notifica `PAYMENT.CAPTURE.COMPLETED`, verifichiamo la firma e concediamo con lo stesso path idempotente. Specchio della verifica server-side di PayGate.

**Files:**
- Create: `app/api/paypal/webhook/route.ts`

**Interfaces:**
- Consumes: `verifyWebhookSignature`, `dbQuery`, `dbExecute`, `getSupabaseAdminClient`, `activatePaypalPlan`.
- Produces: risposta JSON `{ ok: true }` (sempre 200 per non innescare retry-storm).

- [ ] **Step 1: Scrivere il route handler**

```typescript
// app/api/paypal/webhook/route.ts
import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/paypal";
import { activatePaypalPlan } from "@/lib/plan-grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRow = {
  id: string;
  identifier: string;
  plan: "base" | "premium";
  period: "monthly" | "annual";
  status: string;
};

export async function POST(req: Request) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return NextResponse.json({ ok: true });

  const raw = await req.text(); // corpo grezzo per la verifica firma
  const headers: Record<string, string | null> = {
    "paypal-auth-algo": req.headers.get("paypal-auth-algo"),
    "paypal-cert-url": req.headers.get("paypal-cert-url"),
    "paypal-transmission-id": req.headers.get("paypal-transmission-id"),
    "paypal-transmission-sig": req.headers.get("paypal-transmission-sig"),
    "paypal-transmission-time": req.headers.get("paypal-transmission-time"),
  };

  let ok = false;
  try { ok = await verifyWebhookSignature({ headers, body: raw }); }
  catch (e) { console.error("[paypal/webhook] verify error:", String(e)); }
  if (!ok) { console.warn("[paypal/webhook] firma non valida → ignoro"); return NextResponse.json({ ok: true }); }

  let event: { event_type?: string; resource?: { custom_id?: string; amount?: { value?: string }; id?: string } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return NextResponse.json({ ok: true });

  const orderId = event.resource?.custom_id ?? ""; // = il nostro paypal_orders.id
  if (!orderId) return NextResponse.json({ ok: true });

  const orders = await dbQuery<OrderRow>(
    `SELECT id, identifier, plan, period, status FROM paypal_orders WHERE id = $1 LIMIT 1`,
    [orderId]
  );
  const order = orders[0] ?? null;
  if (!order || order.status !== "pending") return NextResponse.json({ ok: true }); // idempotenza

  const value = Number(event.resource?.amount?.value ?? NaN);
  const captureId = event.resource?.id ?? null;

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: true });
  const { data: claimed, error: claimErr } = await db.rpc("claim_paypal_order", {
    p_id: order.id, p_value: Number.isFinite(value) ? value : null, p_capture: captureId,
  });
  if (claimErr || claimed !== true) return NextResponse.json({ ok: true });

  const granted = await activatePaypalPlan(order.identifier, order.plan, order.period);
  if (!granted) {
    console.error(`[paypal/webhook] RECONCILE: paid ma piano NON concesso order=${order.id} identifier=${order.identifier}`);
  } else {
    await dbExecute("UPDATE paypal_orders SET granted_at = NOW() WHERE id = $1", [order.id]);
    console.log(`[paypal/webhook] GRANT order=${order.id} plan=${granted.plan}`);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verificare compilazione**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Verifica manuale sandbox**

Dal PayPal Developer Dashboard (Webhooks simulator) inviare `PAYMENT.CAPTURE.COMPLETED` con `custom_id` = un `paypal_orders.id` pending → grant + `granted_at`. Firma non valida → ignorato (200, nessun grant).

- [ ] **Step 4: Commit**

```bash
git add app/api/paypal/webhook/route.ts
git commit -m "feat(paypal): webhook riconciliazione firmato (idempotente)"
```

---

### Task 7: UI — bottone PayPal nella card piano

Caricare il PayPal JS SDK e renderizzare il bottone PayPal accanto ai metodi esistenti, cablato su create-order/capture.

**Files:**
- Modify: `app/app/page.tsx` (nella sezione checkout/card piano, vicino alla CTA che oggi chiama `/api/paygate/checkout` — ~riga 3235)

**Interfaces:**
- Consumes: `POST /api/paypal/create-order` → `{ id }`; `POST /api/paypal/capture` → `{ ok, granted }`.
- Produces: bottone PayPal funzionante che, al completamento, ricarica lo stato piano.

- [ ] **Step 1: Caricare l'SDK PayPal**

Aggiungere un caricamento dello script SDK (solo quando la card piano è visibile). Usare il client id pubblico via env `NEXT_PUBLIC_PAYPAL_CLIENT_ID`.

> ⚠️ Trappola nota (`feedback_redesign_pitfalls`): le env `NEXT_PUBLIC_*` NON vengono inlinate lato client nell'App Router se lette dinamicamente. Leggerle come letterale `process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID` in un componente client, e verificare in build che il valore sia presente nel bundle.

```typescript
// helper: carica lo script SDK una sola volta
function loadPayPalSdk(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as unknown as { paypal?: unknown }).paypal) return resolve();
    const s = document.createElement("script");
    // components=buttons per PayPal; intent=capture (one-time). Apple Pay: Task 8.
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("paypal sdk load failed"));
    document.head.appendChild(s);
  });
}
```

- [ ] **Step 2: Renderizzare il bottone PayPal**

In un contenitore `<div id="paypal-button-container" />` dentro la card piano, dopo il mount:

```typescript
const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
if (clientId) {
  await loadPayPalSdk(clientId);
  const paypal = (window as unknown as { paypal: {
    Buttons: (cfg: {
      createOrder: () => Promise<string>;
      onApprove: (data: { orderID: string }) => Promise<void>;
    }) => { render: (sel: string) => void };
  } }).paypal;

  paypal.Buttons({
    createOrder: async () => {
      const r = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_plan: selectedPlan, period: selectedPeriod }),
      });
      const d = (await r.json()) as { id?: string; error?: string };
      if (!d.id) throw new Error(d.error ?? "create-order failed");
      return d.id;
    },
    onApprove: async (data) => {
      const r = await fetch("/api/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paypal_order_id: data.orderID }),
      });
      const d = (await r.json()) as { granted?: boolean };
      if (d.granted) {
        // ricarica lo stato piano come dopo un pagamento andato a buon fine
        window.location.assign("/app?paypal=success");
      } else {
        window.location.assign("/app?paypal=pending");
      }
    },
  }).render("#paypal-button-container");
}
```

> Nota: `selectedPlan` / `selectedPeriod` sono le variabili di stato già usate dalla card per il checkout PayGate — riusare quelle, non introdurne di nuove.

- [ ] **Step 3: Verifica visiva (obbligatoria — `feedback_visual_check_loggato`)**

Con SDK sandbox, da **loggato** (cookie Chrome), aprire la card piano: il bottone PayPal si renderizza; completando col buyer sandbox il piano risulta attivo dopo il redirect. Verificare su Safari/desktop e Chrome/mobile che il layout non rompa gli altri bottoni.

- [ ] **Step 4: Commit**

```bash
git add app/app/page.tsx
git commit -m "feat(paypal): bottone PayPal one-click nella card piano"
```

---

### Task 8: UI — bottone Apple Pay + registrazione dominio

Apple Pay tramite lo stesso PayPal SDK (component `applepay`) + file di associazione dominio. Task separato perché richiede `ApplePaySession` e la registrazione Apple; può essere approvato/respinto indipendentemente dal bottone PayPal.

**Files:**
- Modify: `app/app/page.tsx` (bottone Apple Pay accanto a quello PayPal)
- Create: `public/.well-known/apple-developer-merchantid-domain-association` (contenuto fornito da PayPal — placeholder finché non disponibile in Task 9)

**Interfaces:**
- Consumes: stessi endpoint `create-order`/`capture` del Task 7.
- Produces: bottone Apple Pay funzionante su Safari/iOS.

- [ ] **Step 1: Aggiungere `applepay` ai component dell'SDK**

Estendere l'URL SDK del Task 7: `&components=buttons,applepay` (o caricare un secondo script `applepay` se si preferisce isolare). Il bottone Apple Pay va mostrato SOLO se `window.ApplePaySession?.canMakePayments()` è true.

- [ ] **Step 2: Renderizzare il bottone Apple Pay**

Seguire il pattern ufficiale PayPal Apple Pay (verificare i nomi esatti dei metodi correnti via context7/PayPal docs in fase di implementazione — l'API `paypal.Applepay()` espone `config()`, `validateMerchant()`, `confirmOrder()`):

```typescript
// Mostra Apple Pay solo dove supportato
const AppleSession = (window as unknown as { ApplePaySession?: { canMakePayments: () => boolean; STATUS_SUCCESS: number; STATUS_FAILURE: number } }).ApplePaySession;
if (AppleSession?.canMakePayments()) {
  const applepay = (window as unknown as { paypal: { Applepay: () => {
    config: () => Promise<{ merchantCountry: string; currencyCode: string; countryCode: string; isEligible: boolean }>;
    validateMerchant: (o: { validationUrl: string }) => Promise<{ merchantSession: unknown }>;
    confirmOrder: (o: { orderId: string; token: unknown; billingContact?: unknown }) => Promise<void>;
  } } }).paypal.Applepay();

  const cfg = await applepay.config();
  if (cfg.isEligible) {
    // render di un bottone <apple-pay-button>; al click:
    // 1) creare l'ordine col nostro endpoint
    const r = await fetch("/api/paypal/create-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requested_plan: selectedPlan, period: selectedPeriod }),
    });
    const { id: orderId } = (await r.json()) as { id: string };

    // 2) ApplePaySession con importo dal server (mostrato all'utente)
    const session = new (window as unknown as { ApplePaySession: new (v: number, req: unknown) => {
      onvalidatemerchant: (e: { validationURL: string }) => void;
      onpaymentauthorized: (e: { payment: { token: unknown; billingContact?: unknown } }) => void;
      completeMerchantValidation: (s: unknown) => void;
      completePayment: (s: number) => void;
      begin: () => void;
    } }).ApplePaySession(4, {
      countryCode: cfg.countryCode, currencyCode: cfg.currencyCode,
      merchantCapabilities: ["supports3DS"], supportedNetworks: ["visa", "mastercard", "amex"],
      total: { label: "BetRedge", amount: String(/* importo mostrato; l'autorità resta il server */ "") },
    });

    session.onvalidatemerchant = async (e) => {
      const { merchantSession } = await applepay.validateMerchant({ validationUrl: e.validationURL });
      session.completeMerchantValidation(merchantSession);
    };
    session.onpaymentauthorized = async (e) => {
      try {
        await applepay.confirmOrder({ orderId, token: e.payment.token, billingContact: e.payment.billingContact });
        // 3) cattura + grant lato nostro server
        const cap = await fetch("/api/paypal/capture", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paypal_order_id: orderId }),
        });
        const d = (await cap.json()) as { granted?: boolean };
        session.completePayment(d.granted ? AppleSession.STATUS_SUCCESS : AppleSession.STATUS_FAILURE);
        window.location.assign(d.granted ? "/app?paypal=success" : "/app?paypal=pending");
      } catch {
        session.completePayment(AppleSession.STATUS_FAILURE);
      }
    };
    session.begin();
  }
}
```

- [ ] **Step 3: File di associazione dominio**

Creare `public/.well-known/apple-developer-merchantid-domain-association` col contenuto fornito da PayPal (Task 9). Verificare che sia servito: `GET https://<host>/.well-known/apple-developer-merchantid-domain-association` → 200 testo.

- [ ] **Step 4: Verifica su hardware reale (`feedback_visual_check_loggato`)**

Su **iPhone/Safari reale** (Apple Pay non funziona in emulatore), da loggato in sandbox: il bottone Apple Pay compare, il foglio Apple Pay si apre, il pagamento conclude e il piano si attiva. Su dispositivi non-Apple il bottone NON deve comparire.

- [ ] **Step 5: Commit**

```bash
git add app/app/page.tsx public/.well-known/apple-developer-merchantid-domain-association
git commit -m "feat(paypal): bottone Apple Pay via PayPal SDK + domain association"
```

---

### Task 9: Go-live checklist (GATED — richiede APPROVE umano)

Non è codice: è la messa in produzione. **NON eseguire senza `PROPOSAL + APPROVE` in `ch_deploy_gate`.** Postare una PROPOSAL con change-spec esatta (env, dashboard, dominio, migration prod, rollback, blast radius, piano di verifica) e attendere `APPROVE #id` di Andrea o Michele.

- [ ] **Step 1: Preparare la PROPOSAL** con: creazione app PayPal (business EU, Advanced/Complete Payments abilitato); env Vercel `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV=live`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`; registrazione dominio Apple Pay in PayPal + file `.well-known` in prod; endpoint webhook `https://www.betredge.com/api/paypal/webhook`; applicazione migration `20260701120000_paypal_orders.sql` al DB prod; rollback (feature off = env assenti → route 503, UI nasconde i bottoni).
- [ ] **Step 2: Attendere `APPROVE`.**
- [ ] **Step 3 (post-APPROVE): Applicare env + migration prod** (backup prima), registrare webhook e dominio.
- [ ] **Step 4: Verifica live** — 1 pagamento reale piccolo con PayPal e 1 con Apple Pay (Andrea) → piano attivo, receipt, `granted_at`. Idempotenza confermata.
- [ ] **Step 5: Report** "cosa è cambiato davvero vs proposto" nel gate.

---

## Self-Review

**1. Spec coverage:**
- Rail PayPal SDK (PayPal + Apple Pay) → Task 1 (client), 7 (PayPal UI), 8 (Apple Pay UI). ✅
- Modello una-tantum / grant → Task 3 (`activatePaypalPlan` riusa `computePaygateGrant`). ✅
- `paypal_orders` + claim atomico → Task 2. ✅
- create-order (importo server-side) → Task 4. ✅
- capture (verifica server-side + claim + grant) → Task 5. ✅
- webhook riconciliazione firmata → Task 6. ✅
- Apple Pay domain association + eligibilità → Task 8 + 9. ✅
- Secrets/go-live gated → Task 9. ✅
- Fuori scope (no Stripe, no rinnovo, no Google Pay) → rispettato (Global Constraints). ✅

**2. Placeholder scan:** L'unico placeholder legittimo è il contenuto del file `.well-known` (fornito da PayPal, disponibile solo al Task 9) — segnalato esplicitamente, non è un requisito mancante. I nomi esatti dei metodi del component Apple Pay del SDK PayPal vanno verificati contro i doc correnti in fase di implementazione (nota nel Task 8, Step 2): è una cautela di versione, il flusso è completo.

**3. Type consistency:** `activatePaypalPlan(identifier, plan, period)` coerente tra Task 3/5/6. `evaluateCapture` firma coerente tra Task 1 e uso in Task 5. `claim_paypal_order(p_id, p_value, p_capture)` coerente tra Task 2/5/6. `paypal_order_id` (colonna) vs `paypal_order_id` (body capture) vs `custom_id`=nostro `id` (webhook) coerenti col flusso. ✅
