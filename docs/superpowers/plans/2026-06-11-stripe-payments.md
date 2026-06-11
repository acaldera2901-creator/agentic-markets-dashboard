# Stripe Subscription Payments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere pagamento fiat con carta via Stripe Subscriptions a BetRedge, affiancando il checkout USDT esistente, con attivazione automatica via webhook e Customer Portal.

**Architecture:** Secondo binario di pagamento parallelo all'USDT. Dove oggi attiva un admin, lì subentra il webhook Stripe (`invoice.paid` → attiva, `subscription.deleted` → downgrade immediato). `plan_expires_at` riallineato a `current_period_end` di Stripe. Helper `activatePlan()` condiviso tra admin e webhook (DRY).

**Tech Stack:** Next.js 16 (App Router, route handlers nodejs runtime), `stripe` Node SDK, Supabase/Postgres via `dbQuery`, test plain Node con `node:assert/strict` eseguiti con `tsx`.

**Spec di riferimento:** `docs/superpowers/specs/2026-06-11-stripe-payments-design.md`

**Branch:** lavorare su un branch dedicato (es. `feat/stripe-payments`). `app/app/page.tsx` e `app/globals.css` hanno modifiche non committate di altre sessioni — toccare **solo** i propri hunk, mai `git add -A`.

**Convenzione test (esistente nel repo):** ogni test è uno script `.ts` che usa `import assert from "node:assert/strict"`, termina con `console.log("<nome> ok")`, e si esegue con `npx tsx tests/<file>.test.ts`. Non esiste vitest/jest. "Fail" = lo script lancia/non logga ok.

---

## File Structure

| File | Responsabilità | Create/Modify |
|---|---|---|
| `package.json` | dipendenza `stripe` | Modify |
| `supabase/migrations/20260611140000_profiles_stripe.sql` | colonne `stripe_customer_id`, `stripe_subscription_id` + indici | Create |
| `lib/stripe.ts` | client Stripe + mapping piano↔Price + `isStripeConfigured()` + `resolvePlanFromPriceId()` + `periodEndToIso()` | Create |
| `lib/plan-grant.ts` | `activatePlan()` condiviso (UPDATE plan/expiry + evento + email best-effort) | Create |
| `app/api/admin/activations/route.ts` | rewire per usare `activatePlan()` | Modify |
| `app/api/stripe/checkout/route.ts` | crea Checkout Session subscription | Create |
| `app/api/stripe/webhook/route.ts` | verifica firma + gestione eventi | Create |
| `app/api/stripe/portal/route.ts` | crea Billing Portal session | Create |
| `app/app/page.tsx` | bottone "Paga con carta" + link "Gestisci abbonamento" | Modify |
| `tests/stripe-mapping.test.ts` | unit test helper puri di `lib/stripe.ts` | Create |
| `tests/plan-grant.test.ts` | unit test parte pura di `lib/plan-grant.ts` | Create |
| `docs/internal/stripe-setup-2026-06-11.md` | runbook config dashboard + env + checklist TEST mode | Create |

---

## Task 1: Dipendenza Stripe SDK

**Files:**
- Modify: `package.json` (+ `package-lock.json`)

- [ ] **Step 1: Installare il pacchetto**

Run: `cd ~/Desktop/agentic-markets && npm install stripe`
Expected: `stripe` compare in `dependencies` di `package.json`.

- [ ] **Step 2: Verificare l'import**

Run: `npx tsx -e "import Stripe from 'stripe'; console.log(typeof Stripe)"`
Expected: stampa `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add stripe SDK dependency"
```

---

## Task 2: Migration colonne Stripe su profiles

**Files:**
- Create: `supabase/migrations/20260611140000_profiles_stripe.sql`

- [ ] **Step 1: Scrivere la migration (additiva, idempotente)**

```sql
-- Stripe subscription linkage on profiles (fiat payments, GAP5).
-- Additive + idempotent: no data loss, safe to re-run.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription
  ON profiles (stripe_subscription_id);
```

- [ ] **Step 2: Verifica sintassi locale**

Run: `cat supabase/migrations/20260611140000_profiles_stripe.sql`
Expected: contenuto corretto. (L'apply effettivo sul DB è un'azione gated → §Gate, non eseguire qui.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260611140000_profiles_stripe.sql
git commit -m "feat(db): add stripe_customer_id/subscription_id to profiles"
```

---

## Task 3: `lib/stripe.ts` — client + helper puri (TDD)

**Files:**
- Create: `tests/stripe-mapping.test.ts`
- Create: `lib/stripe.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

`tests/stripe-mapping.test.ts`:

```ts
import assert from "node:assert/strict";
import { resolvePlanFromPriceId, periodEndToIso, planToPriceId } from "../lib/stripe";

// price id -> plan
process.env.STRIPE_PRICE_BASE = "price_base_123";
process.env.STRIPE_PRICE_PREMIUM = "price_premium_456";

assert.equal(resolvePlanFromPriceId("price_base_123"), "base");
assert.equal(resolvePlanFromPriceId("price_premium_456"), "premium");
assert.equal(resolvePlanFromPriceId("price_unknown"), null);
assert.equal(resolvePlanFromPriceId(undefined), null);

// plan -> price id
assert.equal(planToPriceId("base"), "price_base_123");
assert.equal(planToPriceId("premium"), "price_premium_456");

// unix seconds -> ISO string
assert.equal(periodEndToIso(1750000000), new Date(1750000000 * 1000).toISOString());
assert.equal(periodEndToIso(null), null);

console.log("stripe mapping ok");
```

- [ ] **Step 2: Eseguire il test (deve fallire)**

Run: `npx tsx tests/stripe-mapping.test.ts`
Expected: FAIL — `Cannot find module '../lib/stripe'`.

- [ ] **Step 3: Implementare `lib/stripe.ts`**

```ts
import Stripe from "stripe";
import type { Plan } from "./auth";

// Lazily-built singleton: env può non essere configurato (USDT-only) e in quel
// caso il modulo è "spento" — i route handler rispondono 503 senza crashare.
let _client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_BASE &&
      process.env.STRIPE_PRICE_PREMIUM
  );
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("[stripe] STRIPE_SECRET_KEY not configured");
  }
  if (!_client) _client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _client;
}

// Solo i due piani pagati pubblici hanno un Price Stripe.
export type StripePlan = Extract<Plan, "base" | "premium">;

export function planToPriceId(plan: StripePlan): string {
  const id =
    plan === "premium" ? process.env.STRIPE_PRICE_PREMIUM : process.env.STRIPE_PRICE_BASE;
  if (!id) throw new Error(`[stripe] missing price id for plan ${plan}`);
  return id;
}

export function resolvePlanFromPriceId(priceId: string | undefined | null): StripePlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_BASE) return "base";
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return "premium";
  return null;
}

export function periodEndToIso(periodEndUnixSeconds: number | null | undefined): string | null {
  if (!periodEndUnixSeconds) return null;
  return new Date(periodEndUnixSeconds * 1000).toISOString();
}
```

- [ ] **Step 4: Eseguire il test (deve passare)**

Run: `npx tsx tests/stripe-mapping.test.ts`
Expected: PASS — stampa `stripe mapping ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/stripe.ts tests/stripe-mapping.test.ts
git commit -m "feat(stripe): client + plan/price mapping helpers"
```

---

## Task 4: `lib/plan-grant.ts` — `activatePlan()` condiviso (TDD parte pura + refactor admin)

Estrae la logica di attivazione oggi inline in `app/api/admin/activations/route.ts` così admin e webhook usano un solo path. La parte testabile in isolamento è la risoluzione della finestra di scadenza (`computeExpiry`): admin = `NOW()+30d` (delega a SQL → `null` lato app), Stripe = ISO esplicito.

**Files:**
- Create: `tests/plan-grant.test.ts`
- Create: `lib/plan-grant.ts`
- Modify: `app/api/admin/activations/route.ts`

- [ ] **Step 1: Scrivere il test puro che fallisce**

`tests/plan-grant.test.ts`:

```ts
import assert from "node:assert/strict";
import { expirySqlExpr } from "../lib/plan-grant";

// Stripe passa una scadenza ISO esplicita -> usata come literal.
assert.equal(
  expirySqlExpr("2026-07-11T00:00:00.000Z"),
  "'2026-07-11T00:00:00.000Z'::timestamptz"
);
// Admin (nessuna scadenza esplicita) -> finestra 30 giorni lato DB.
assert.equal(expirySqlExpr(null), "NOW() + INTERVAL '30 days'");

console.log("plan-grant ok");
```

- [ ] **Step 2: Eseguire il test (deve fallire)**

Run: `npx tsx tests/plan-grant.test.ts`
Expected: FAIL — `Cannot find module '../lib/plan-grant'`.

- [ ] **Step 3: Implementare `lib/plan-grant.ts`**

```ts
import { dbQuery } from "./db";
import { sendEmail, planActivatedEmail } from "./email";

export type GrantablePlan = "base" | "premium";

// Espressione SQL per plan_expires_at:
// - ISO esplicito (Stripe current_period_end) -> literal timestamptz
// - null (admin manuale USDT) -> finestra 30 giorni calcolata dal DB
export function expirySqlExpr(expiresAtIso: string | null): string {
  if (expiresAtIso) {
    const safe = expiresAtIso.replace(/'/g, ""); // ISO non contiene apici; difensivo
    return `'${safe}'::timestamptz`;
  }
  return "NOW() + INTERVAL '30 days'";
}

type ActivatedRow = { identifier: string; name: string | null; plan: GrantablePlan };

// Attiva (o rinnova) un piano pagato. Path unico per admin e webhook Stripe.
// - expiresAtIso null  => USDT/admin: 30 giorni dal DB, richiede plan='pending_payment'
// - expiresAtIso set   => Stripe: scadenza = current_period_end, idempotente sui rinnovi
export async function activatePlan(
  identifier: string,
  plan: GrantablePlan,
  expiresAtIso: string | null
): Promise<ActivatedRow | null> {
  const guard = expiresAtIso
    ? "" // Stripe: la fonte di verità è il webhook, attiva/rinnova senza guardia pending
    : "AND plan = 'pending_payment' AND requested_plan IN ('base','premium')";

  const rows = await dbQuery<ActivatedRow>(
    `UPDATE profiles
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = ${expirySqlExpr(expiresAtIso)},
            updated_at = NOW()
      WHERE (identifier = $1 OR LOWER(TRIM(identifier)) = $1)
        ${guard}
      RETURNING identifier, name, plan`,
    [identifier, plan]
  );

  const activated = rows[0];
  if (!activated) return null;

  await dbQuery(
    `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
     VALUES ('admin_profile_plan_changed', 'system', NULL, NULL, $1, NULL, 0, $2)`,
    [activated.plan, JSON.stringify({ identifier: activated.identifier, name: activated.name })]
  );

  if (activated.identifier.includes("@")) {
    const exp = await dbQuery<{ plan_expires_at: string | null }>(
      "SELECT plan_expires_at::text FROM profiles WHERE identifier = $1 LIMIT 1",
      [activated.identifier]
    );
    const mail = planActivatedEmail(exp[0]?.plan_expires_at ?? null);
    sendEmail({ to: activated.identifier, subject: mail.subject, html: mail.html, text: mail.text })
      .catch((e) => console.error("[plan-grant] plan-activated email failed:", String(e)));
  }

  return activated;
}
```

- [ ] **Step 4: Eseguire il test (deve passare)**

Run: `npx tsx tests/plan-grant.test.ts`
Expected: PASS — stampa `plan-grant ok`.

- [ ] **Step 5: Rewire `app/api/admin/activations/route.ts` per usare `activatePlan()`**

Sostituire il blocco UPDATE+evento+email (righe ~46-86) con la chiamata al helper. Il `POST` mantiene auth/CSRF/parse invariati; cambia solo il corpo dopo aver ricavato `identifier`:

```ts
// import in cima al file
import { activatePlan } from "@/lib/plan-grant";

// ...dentro POST, dopo aver validato `identifier`:
const activated = await activatePlan(identifier, "base" /* placeholder */, null);
```

ATTENZIONE: l'admin attiva il `requested_plan` corrente, non un piano fisso. Mantenere la semantica leggendo prima il `requested_plan` e passandolo. Implementazione esatta:

```ts
const pending = await dbQuery<{ requested_plan: GrantablePlan | null }>(
  "SELECT requested_plan FROM profiles WHERE identifier = $1 LIMIT 1",
  [identifier]
);
const wanted = pending[0]?.requested_plan;
if (wanted !== "base" && wanted !== "premium") {
  return NextResponse.json(
    { error: "profile is not pending activation or requested plan is missing" },
    { status: 409 }
  );
}
const activated = await activatePlan(identifier, wanted, null);
if (!activated) {
  return NextResponse.json(
    { error: "profile is not pending activation or requested plan is missing" },
    { status: 409 }
  );
}
return NextResponse.json({ ok: true, profile: activated });
```

Aggiungere l'import `GrantablePlan` se serve il tipo: `import { activatePlan, type GrantablePlan } from "@/lib/plan-grant";`. Rimuovere gli import ora orfani (`planActivatedEmail` se non più usato direttamente — verificarlo nel file).

- [ ] **Step 6: Type-check del progetto**

Run: `npx tsc --noEmit`
Expected: nessun errore relativo a `plan-grant`/`activations`.

- [ ] **Step 7: Commit**

```bash
git add lib/plan-grant.ts tests/plan-grant.test.ts app/api/admin/activations/route.ts
git commit -m "refactor: extract activatePlan() shared by admin + future webhook"
```

---

## Task 5: `POST /api/stripe/checkout`

Crea una Checkout Session subscription per l'utente loggato e segna `pending_payment` (coerente con USDT).

**Files:**
- Create: `app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Implementare il route handler**

```ts
import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { getStripe, isStripeConfigured, planToPriceId, type StripePlan } from "@/lib/stripe";
import { normalizeCheckoutPlan } from "@/lib/commercial-plan";
import { siteOrigin } from "@/lib/activation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  const ctx = await getSessionPlan(req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown };
  try {
    body = (await req.json()) as { requested_plan?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const plan = normalizeCheckoutPlan(body.requested_plan) as StripePlan | null;
  if (plan !== "base" && plan !== "premium") {
    return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  }

  // Riusa il customer Stripe se già presente.
  const existing = await dbQuery<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM profiles WHERE identifier = $1 LIMIT 1",
    [ctx.identifier]
  );
  const customerId = existing[0]?.stripe_customer_id ?? undefined;

  // Segna pending_payment (UI mostra "in attesa"), come il path USDT.
  await dbQuery(
    `UPDATE profiles
        SET plan = 'pending_payment', requested_plan = $2, updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [ctx.identifier, plan]
  );

  const origin = siteOrigin(req);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: planToPriceId(plan), quantity: 1 }],
    client_reference_id: ctx.identifier,
    ...(customerId ? { customer: customerId } : { customer_email: ctx.identifier }),
    subscription_data: { metadata: { plan, identifier: ctx.identifier } },
    metadata: { plan, identifier: ctx.identifier },
    success_url: `${origin}/app?stripe=success`,
    cancel_url: `${origin}/app?stripe=cancel`,
    allow_promotion_codes: false,
  });

  if (!session.url) {
    return NextResponse.json({ error: "stripe session has no url" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore in `checkout/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/checkout/route.ts
git commit -m "feat(stripe): checkout session route (subscription mode)"
```

---

## Task 6: `POST /api/stripe/webhook`

Verifica firma sul raw body e applica gli eventi.

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Implementare il webhook**

```ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured, resolvePlanFromPriceId, periodEndToIso } from "@/lib/stripe";
import { activatePlan } from "@/lib/plan-grant";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await req.text(); // raw body obbligatorio per la verifica firma
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("[stripe/webhook] bad signature:", String(e));
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const identifier = s.client_reference_id ?? s.customer_email ?? null;
        if (identifier) {
          await dbQuery(
            `UPDATE profiles
                SET stripe_customer_id = $2, stripe_subscription_id = $3, updated_at = NOW()
              WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
            [identifier, String(s.customer ?? ""), String(s.subscription ?? "")]
          );
        }
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const priceId = inv.lines?.data?.[0]?.price?.id;
        const plan = resolvePlanFromPriceId(priceId);
        // current_period_end è sulla subscription line item
        const periodEnd = inv.lines?.data?.[0]?.period?.end ?? null;
        // identifier: da subscription metadata (preferito) o lookup per customer
        let identifier: string | null = null;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(inv.subscription));
          identifier = (sub.metadata?.identifier as string) ?? null;
        }
        if (!identifier && inv.customer) {
          const rows = await dbQuery<{ identifier: string }>(
            "SELECT identifier FROM profiles WHERE stripe_customer_id = $1 LIMIT 1",
            [String(inv.customer)]
          );
          identifier = rows[0]?.identifier ?? null;
        }
        if (identifier && plan) {
          await activatePlan(identifier, plan, periodEndToIso(periodEnd));
        } else {
          console.error("[stripe/webhook] invoice.paid unresolved", { identifier, priceId });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await dbQuery(
          `UPDATE profiles
              SET plan = 'free', plan_expires_at = NULL, stripe_subscription_id = NULL, updated_at = NOW()
            WHERE stripe_subscription_id = $1`,
          [String(sub.id)]
        );
        break;
      }
      default:
        break; // eventi non gestiti: ack 200 per non far ritentare
    }
  } catch (e) {
    console.error("[stripe/webhook] handler error:", String(e));
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

NOTA per l'implementatore: i campi esatti dell'oggetto `Invoice`/`Subscription` possono variare tra versioni del SDK Stripe — al momento dell'implementazione verificare i tipi reali (`inv.lines.data[0].price`, `period.end`, `inv.subscription`) e, se necessario, leggere la doc del pacchetto installato (`node_modules/stripe`). Lo scopo non cambia: ricavare priceId, periodEnd e identifier.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore in `webhook/route.ts` (eventualmente adeguare gli accessi ai campi ai tipi del SDK installato).

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(stripe): webhook (activate on invoice.paid, downgrade on cancel)"
```

---

## Task 7: `POST /api/stripe/portal`

**Files:**
- Create: `app/api/stripe/portal/route.ts`

- [ ] **Step 1: Implementare il route handler**

```ts
import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { siteOrigin } from "@/lib/activation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  const ctx = await getSessionPlan(req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await dbQuery<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM profiles WHERE identifier = $1 LIMIT 1",
    [ctx.identifier]
  );
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "no stripe customer" }, { status: 409 });
  }

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteOrigin(req)}/app`,
  });
  return NextResponse.json({ url: portal.url });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/portal/route.ts
git commit -m "feat(stripe): customer billing portal route"
```

---

## Task 8: UI — bottone "Paga con carta" + "Gestisci abbonamento"

**Files:**
- Modify: `app/app/page.tsx` (SOLO i propri hunk; non toccare le modifiche pendenti di altre sessioni)

- [ ] **Step 1: Individuare il modale checkout USDT esistente**

Run: `grep -n "checkout\|requested_plan\|USDT\|TRC20\|/api/auth" app/app/page.tsx | head -30`
Expected: trovare il punto dove parte il checkout USDT (fetch a `/api/auth` con `action:"checkout"`).

- [ ] **Step 2: Aggiungere l'handler e il bottone Stripe accanto a USDT**

Accanto al flusso USDT, aggiungere un bottone che chiama il nuovo route e redirige:

```tsx
async function payWithCard(plan: "base" | "premium") {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requested_plan: plan }),
  });
  if (!res.ok) {
    // 503 = stripe non configurato: nascondere/disabilitare il bottone in quel caso
    console.error("stripe checkout failed", res.status);
    return;
  }
  const { url } = (await res.json()) as { url?: string };
  if (url) window.location.href = url;
}
```

Bottone (dentro il modale, accanto a "Paga in USDT"), con `plan` = piano selezionato dal modale:

```tsx
<button type="button" onClick={() => payWithCard(selectedPlan)}>
  Paga con carta
</button>
```

- [ ] **Step 3: Aggiungere "Gestisci abbonamento" per chi ha un sub Stripe**

Dove si mostra lo stato account dell'utente loggato:

```tsx
async function openBillingPortal() {
  const res = await fetch("/api/stripe/portal", { method: "POST" });
  if (!res.ok) return;
  const { url } = (await res.json()) as { url?: string };
  if (url) window.location.href = url;
}
// <button type="button" onClick={openBillingPortal}>Gestisci abbonamento</button>
```

(Mostrarlo condizionatamente: il profilo espone già il piano; il link al portale ritorna 409 se non c'è customer, quindi è sicuro mostrarlo ai paganti.)

- [ ] **Step 4: Type-check + lint dei propri hunk**

Run: `npx tsc --noEmit && npx eslint app/app/page.tsx`
Expected: nessun nuovo errore introdotto dalle proprie modifiche.

- [ ] **Step 5: Commit (solo page.tsx, verificando il diff)**

```bash
git add -p app/app/page.tsx   # selezionare SOLO i propri hunk
git commit -m "feat(ui): stripe card payment + manage subscription buttons"
```

---

## Task 9: Runbook config + verifica TEST mode (manuale, gated)

Le verifiche end-to-end richiedono Stripe TEST mode e configurazione dashboard/env: sono azioni gated (vedi §Gate). Questo task produce il runbook e la checklist; l'esecuzione reale avviene dopo APPROVE.

**Files:**
- Create: `docs/internal/stripe-setup-2026-06-11.md`

- [ ] **Step 1: Scrivere il runbook**

Contenuto:
- Creare in Stripe (Maven, TEST mode) 2 Product + Price ricorrenti mensili USD: 19.90 (Base), 49.90 (Pro). Annotare i `price_...` id.
- Customer Portal: abilitare, cancellazione **immediata**, update carta + fatture ON.
- Webhook endpoint → `https://<dominio>/api/stripe/webhook`, eventi: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`. Annotare il `whsec_...`.
- Env (Vercel + `.env.local` per dev): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASE`, `STRIPE_PRICE_PREMIUM`.
- GAP3: dati fiscali/bancari Maven per live mode (blocker go-live, APPROVE separato).

- [ ] **Step 2: Checklist di verifica TEST mode** (da spec §6)

```
Local: npm run dev + `stripe listen --forward-to localhost:3000/api/stripe/webhook`
[ ] 1. Checkout Base → invoice.paid → profilo plan='base', plan_expires_at==current_period_end, customer/subscription id valorizzati
[ ] 2. Checkout Pro  → idem con 'premium'
[ ] 3. Rinnovo (stripe trigger invoice.paid o avanzamento clock) → plan_expires_at avanza
[ ] 4. Disdetta dal Customer Portal → subscription.deleted → plan='free' IMMEDIATO, plan_expires_at=NULL, stripe_subscription_id=NULL
[ ] 5. Carta declinata (4000000000000002) → nessuna attivazione
[ ] 6. Firma webhook errata → 400, nessuna mutazione
[ ] 7. Ri-consegna stesso invoice.paid → stato invariato (idempotenza)
[ ] 8. Chiavi assenti (env vuoto) → checkout 503, USDT funziona
[ ] 9. Regressione: attivazione manuale admin USDT ancora funzionante (dopo refactor activatePlan)
```

- [ ] **Step 3: Commit**

```bash
git add docs/internal/stripe-setup-2026-06-11.md
git commit -m "docs: stripe setup runbook + TEST mode verification checklist"
```

---

## Gate di approvazione (CLAUDE.md aziendale)

Task medium/high (pagamenti/soldi/prod). **Prima dell'esecuzione del piano** va postata una PROPOSAL change-spec su `ch_deploy_gate` e atteso `APPROVE` umano. Azioni che NON si eseguono senza APPROVE:
- apply della migration Task 2 sul DB,
- set delle env Stripe su Vercel,
- merge/deploy del branch,
- passaggio a Stripe **live mode** (APPROVE separato + GAP3 Maven).

Lo sviluppo del codice (Task 1,3–9 a livello di file/commit su branch) e i test in TEST mode locale sono il deliverable; il deploy in prod è gated.

---

## Self-Review (coverage vs spec)

- Spec §2 colonne `profiles` → Task 2. ✔
- Spec §3.2 `lib/stripe.ts` → Task 3. ✔
- Spec §3.2 `lib/plan-grant.ts` + rewire admin → Task 4. ✔
- Spec §3.2 checkout route → Task 5. ✔
- Spec §3.3 webhook (3 eventi) → Task 6. ✔
- Spec §3.2 portal route → Task 7. ✔
- Spec §3.2 UI page.tsx → Task 8. ✔
- Spec §4 config/env/GAP3 + §6 testing → Task 9. ✔
- Spec §5 error handling → 503 chiavi assenti (Task 5/6/7), 400 firma (Task 6), fail-loud/email best-effort (Task 4). ✔
- Spec §7 gate → sezione Gate. ✔
- Type consistency: `StripePlan`/`GrantablePlan` = `"base"|"premium"`, `activatePlan(identifier, plan, expiresAtIso)`, `resolvePlanFromPriceId`, `periodEndToIso` coerenti tra Task 3/4/6. ✔
