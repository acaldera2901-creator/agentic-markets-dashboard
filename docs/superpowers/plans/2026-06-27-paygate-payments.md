# PayGate.to Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrare PayGate.to come unico gateway: checkout (carta/Apple/Google Pay/SEPA via `pay.php`) con payout USDC su wallet self-custodial, e attivazione del piano via callback verificato anti-spoof — mensile (+30gg) e annuale −30% (+365gg) per Base e Pro.

**Architecture:** Rimpiazza i due punti del flusso Stripe (init checkout + conferma async) riusando `lib/plan-grant.ts`. Nuova tabella `paygate_orders` con token monouso per-ordine. `POST /api/paygate/checkout` crea l'ordine, segna `pending_payment`, chiama `wallet.php`, costruisce l'URL `pay.php`. `GET /api/paygate/callback` verifica (token + importo + ri-check opzionale) e concede il piano in modo idempotente.

**Tech Stack:** Next.js App Router (route handlers), TypeScript, Supabase (`lib/db` RPC `exec_sql`), PayGate.to REST (no SDK, no API key), `node:crypto`, test `tsx` + `node:assert/strict`.

## Global Constraints

- **Gate aziendale:** nessuna esecuzione in produzione (migration su DB reale, deploy, env wallet reale, callback pubblico, primo pagamento reale) senza `APPROVE #id` umano. I task producono codice + test locali.
- **Sicurezza pagamenti (trust boundary):** il callback PayGate è un GET **non firmato** → non è fonte di verità. Concedere il piano **solo** dopo: (a) match del **token monouso** a 32 byte dell'ordine, (b) `value_coin` ≥ importo atteso − tolleranza fee, (c) ri-verifica stato server-side (strato extra, attivo via env `PAYGATE_STATUS_CHECK=1` una volta confermati i params in Task 7). Grant **idempotente** (un secondo callback non concede 2 volte).
- **Importi server-side:** gli importi vengono SEMPRE da `lib/paygate.ts` (`amountFor`), mai dal client. Base: 19.90/169 · Pro: 49.90/419 (mensile/annuale USD).
- **Auth:** `/api/paygate/checkout` valida `getSessionPlan` + blocca cross-site (come `stripe/checkout`). Il callback non è autenticato (lo chiama PayGate) → la sicurezza è il token monouso.
- **No SDK / no API key:** chiamate REST a `api.paygate.to` / `checkout.paygate.to` con `fetch` (stile `lib/email.ts`).
- **Mai iframe:** il checkout è un redirect diretto (vincolo PayGate).
- **Surgical:** non rimuovere il codice Stripe/CoinsPaid (resta dormiente); ripuntare solo i call-site UI. Non toccare `lib/email.ts` né le lifecycle.
- **Test command:** `npx tsx <file>`. Lint: `npm run lint`. Build: `npm run build`.
- **Env nuove:** `PAYGATE_PAYOUT_WALLET=0x72e348d948e984c7d57d8ccb93fdd52710e47fa2` (USDC Polygon, self-custodial). `PAYGATE_STATUS_CHECK` (off finché Task 7 non conferma l'endpoint).

---

### Task 1: Migration `paygate_orders`

**Files:**
- Create: `supabase/migrations/20260627130000_paygate_orders.sql`

**Interfaces:**
- Produces: tabella `paygate_orders` (id, identifier, plan, period, amount_usd, token_hash UNIQUE, status, value_coin, polygon_address_in, created_at, paid_at).

- [ ] **Step 1: Scrivere la migration**

```sql
-- Ordini PayGate.to (#PAYGATE-PAY). Additiva + idempotente.
-- token_hash = sha256 del token random per-ordine presente nel callback URL
-- (anti-spoof: il callback PayGate non è firmato). Si salva SOLO l'hash.

CREATE TABLE IF NOT EXISTS public.paygate_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier         TEXT NOT NULL,
  plan               TEXT NOT NULL CHECK (plan IN ('base','premium')),
  period             TEXT NOT NULL CHECK (period IN ('monthly','annual')),
  amount_usd         NUMERIC(10,2) NOT NULL,
  token_hash         TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  value_coin         NUMERIC(20,6),
  polygon_address_in TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_paygate_orders_identifier ON public.paygate_orders (identifier);

-- Operator/service-role only: nessuna policy → nega anon/authenticated.
ALTER TABLE public.paygate_orders ENABLE ROW LEVEL SECURITY;

-- Rollback:
-- DROP TABLE IF EXISTS public.paygate_orders;
```

- [ ] **Step 2: Verifica sintattica**

Run: `grep -c "CREATE TABLE IF NOT EXISTS public.paygate_orders" supabase/migrations/20260627130000_paygate_orders.sql`
Expected: `1`

> ⚠️ **GATED:** apply su DB reale solo dopo APPROVE (Task 7).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260627130000_paygate_orders.sql
git commit -m "feat(pay): migration paygate_orders (#PAYGATE-PAY)"
```

---

### Task 2: `lib/paygate.ts` — pricing, token, URL, verifica callback (TDD)

**Files:**
- Create: `lib/paygate.ts`
- Test: `tests/paygate.test.ts`

**Interfaces:**
- Produces:
  - `type PlanKey = "base" | "premium"`, `type Period = "monthly" | "annual"`
  - `amountFor(plan: PlanKey, period: Period): number`
  - `periodDays(period: Period): number` (30 | 365)
  - `newOrderToken(): { token: string; tokenHash: string }`
  - `hashToken(token: string): string`
  - `evaluateCallback(opts: { order: { status: string; amount_usd: number } | null; valueCoin: number | null; feeTolerance?: number }): { grant: boolean; reason: string }`
  - `createReceivingWallet(payoutAddress: string, callbackUrl: string): Promise<{ addressIn: string; polygonAddressIn: string; ipnToken: string }>`
  - `buildPayUrl(opts: { addressIn: string; amount: number; email: string }): string`
  - `checkPaymentStatus(opts: { polygonAddressIn: string; ipnToken: string }): Promise<{ confirmed: boolean; valueCoin?: number }>`

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// tests/paygate.test.ts
import assert from "node:assert/strict";
import { amountFor, periodDays, hashToken, newOrderToken, buildPayUrl, evaluateCallback } from "../lib/paygate";

// — prezzi server-side —
assert.equal(amountFor("base", "monthly"), 19.9);
assert.equal(amountFor("base", "annual"), 169);
assert.equal(amountFor("premium", "monthly"), 49.9);
assert.equal(amountFor("premium", "annual"), 419);
// @ts-expect-error combinazione invalida
assert.throws(() => amountFor("enterprise", "monthly"), /plan/i);

// — giorni per periodo —
assert.equal(periodDays("monthly"), 30);
assert.equal(periodDays("annual"), 365);

// — token: hash deterministico, token random diverso ogni volta —
const t = newOrderToken();
assert.equal(t.tokenHash, hashToken(t.token));
assert.notEqual(newOrderToken().token, newOrderToken().token);

// — buildPayUrl: currency=USD, address re-encodato una volta (%2F -> %252F) —
const u = buildPayUrl({ addressIn: "abc%2Fdef%3D%3D", amount: 169, email: "a@b.com" });
assert.match(u, /^https:\/\/checkout\.paygate\.to\/pay\.php\?/);
assert.match(u, /currency=USD/);
assert.match(u, /amount=169/);
assert.match(u, /address=abc%252Fdef%253D%253D/);
assert.match(u, /email=a%40b\.com/);

// — evaluateCallback: gate (a)+(b) —
const okOrder = { status: "pending", amount_usd: 169 };
assert.equal(evaluateCallback({ order: null, valueCoin: 169 }).grant, false);                  // ordine assente
assert.equal(evaluateCallback({ order: { status: "paid", amount_usd: 169 }, valueCoin: 169 }).grant, false); // già pagato
assert.equal(evaluateCallback({ order: okOrder, valueCoin: null }).grant, false);              // value_coin assente
assert.equal(evaluateCallback({ order: okOrder, valueCoin: 100 }).grant, false);               // sotto soglia
assert.equal(evaluateCallback({ order: okOrder, valueCoin: 169 }).grant, true);                // ok
assert.equal(evaluateCallback({ order: okOrder, valueCoin: 166 }).grant, true);                // entro tolleranza 2%
assert.equal(evaluateCallback({ order: okOrder, valueCoin: 150 }).grant, false);               // oltre tolleranza

console.log("paygate ok");
```

- [ ] **Step 2: Eseguire il test e verificare che fallisce**

Run: `npx tsx tests/paygate.test.ts`
Expected: FAIL (modulo inesistente).

- [ ] **Step 3: Implementare `lib/paygate.ts`**

```ts
// lib/paygate.ts
// Client PayGate.to (#PAYGATE-PAY). REST, no SDK, no API key (stile lib/email.ts).
// Due step: wallet.php (genera address_in cifrato + callback unico) → pay.php
// (redirect multi-provider). Il callback di pagamento NON è firmato: la verifica
// anti-spoof vive in evaluateCallback (token monouso + importo) + checkPaymentStatus.

import crypto from "node:crypto";

const WALLET_ENDPOINT = "https://api.paygate.to/control/wallet.php";
const PAY_ENDPOINT = "https://checkout.paygate.to/pay.php";
const DEFAULT_FEE_TOLERANCE = 0.02; // 2%: copre lo scostamento fee/cambio sul value_coin

export type PlanKey = "base" | "premium";
export type Period = "monthly" | "annual";

// Prezzi server-side (USD). Mai dal client. Annuali arrotondati (decisione Andrea).
export const PAYGATE_PRICES: Record<PlanKey, Record<Period, number>> = {
  base: { monthly: 19.9, annual: 169 },
  premium: { monthly: 49.9, annual: 419 },
};

export function amountFor(plan: PlanKey, period: Period): number {
  const byPeriod = PAYGATE_PRICES[plan];
  if (!byPeriod) throw new Error(`invalid plan: ${String(plan)}`);
  const amt = byPeriod[period];
  if (amt == null) throw new Error(`invalid period: ${String(period)}`);
  return amt;
}

export function periodDays(period: Period): number {
  if (period === "monthly") return 30;
  if (period === "annual") return 365;
  throw new Error(`invalid period: ${String(period)}`);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newOrderToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

// Decisione di concessione — PURA (testabile). Strati (a) token già risolto dal
// caller (qui riceve l'ordine trovato per token_hash) e (b) importo.
export function evaluateCallback(opts: {
  order: { status: string; amount_usd: number } | null;
  valueCoin: number | null;
  feeTolerance?: number;
}): { grant: boolean; reason: string } {
  const tol = opts.feeTolerance ?? DEFAULT_FEE_TOLERANCE;
  if (!opts.order) return { grant: false, reason: "order not found" };
  if (opts.order.status !== "pending") return { grant: false, reason: "order not pending" };
  if (opts.valueCoin == null || !Number.isFinite(opts.valueCoin)) return { grant: false, reason: "missing value_coin" };
  if (opts.valueCoin < opts.order.amount_usd * (1 - tol)) return { grant: false, reason: "amount below threshold" };
  return { grant: true, reason: "ok" };
}

export async function createReceivingWallet(
  payoutAddress: string,
  callbackUrl: string
): Promise<{ addressIn: string; polygonAddressIn: string; ipnToken: string }> {
  const url = `${WALLET_ENDPOINT}?address=${encodeURIComponent(payoutAddress)}&callback=${encodeURIComponent(callbackUrl)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`paygate wallet.php failed: ${resp.status}`);
  const data = (await resp.json()) as { address_in?: string; polygon_address_in?: string; ipn_token?: string };
  if (!data.address_in) throw new Error("paygate wallet.php: missing address_in");
  return {
    addressIn: data.address_in,
    polygonAddressIn: data.polygon_address_in ?? "",
    ipnToken: data.ipn_token ?? "",
  };
}

export function buildPayUrl(opts: { addressIn: string; amount: number; email: string }): string {
  // URLSearchParams ri-encoda il valore address_in (che contiene già %2F/%3D)
  // una volta, come richiede PayGate (es. %2F -> %252F).
  const p = new URLSearchParams({
    address: opts.addressIn,
    amount: String(opts.amount),
    email: opts.email,
    currency: "USD",
  });
  return `${PAY_ENDPOINT}?${p.toString()}`;
}

// Difesa in profondità: ri-verifica lo stato lato PayGate. Params esatti da
// confermare con la doc in Task 7 (gated). Finché PAYGATE_STATUS_CHECK non è "1"
// il caller NON usa questo strato (token+importo restano il gate hard).
export async function checkPaymentStatus(_opts: {
  polygonAddressIn: string;
  ipnToken: string;
}): Promise<{ confirmed: boolean; valueCoin?: number }> {
  // TODO-GATED (Task 7): cablare l'endpoint reale di Check Payment Status.
  return { confirmed: false };
}
```

- [ ] **Step 4: Eseguire il test e verificare che passa**

Run: `npx tsx tests/paygate.test.ts`
Expected: PASS → stampa `paygate ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/paygate.ts tests/paygate.test.ts
git commit -m "feat(pay): lib paygate (pricing/token/url/verifica) (#PAYGATE-PAY)"
```

---

### Task 3: `activatePaygatePlan` in `lib/plan-grant.ts`

**Files:**
- Modify: `lib/plan-grant.ts`

**Interfaces:**
- Consumes: `notifyPlanActivated`, `dbQuery`, `GrantablePlan` (già nel file).
- Produces: `activatePaygatePlan(identifier: string, plan: GrantablePlan, period: "monthly" | "annual"): Promise<ActivatedRow | null>`.

- [ ] **Step 1: Estendere `ActivationSource`**

In `lib/plan-grant.ts` cambiare:
```ts
type ActivationSource = "admin" | "stripe";
```
in:
```ts
type ActivationSource = "admin" | "stripe" | "paygate";
```

- [ ] **Step 2: Aggiungere `activatePaygatePlan`** (in fondo al file)

```ts
// PayGate activation: il callback è già verificato a monte (token monouso +
// importo) e l'ordine fa da lock di idempotenza, quindi nessun pending-guard qui.
// Expiry per periodo: monthly +30gg, annual +365gg. Notifica solo su transizione
// reale (come activateStripePlan). source 'paygate'.
export async function activatePaygatePlan(
  identifier: string,
  plan: GrantablePlan,
  period: "monthly" | "annual"
): Promise<ActivatedRow | null> {
  const days = period === "annual" ? 365 : 30;
  const rows = await dbQuery<ActivatedRow & { old_plan: string | null }>(
    `WITH prev AS (
       SELECT identifier, plan AS old_plan FROM profiles
        WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
        LIMIT 1
     )
     UPDATE profiles p
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = NOW() + make_interval(days => $3),
            updated_at = NOW()
       FROM prev
      WHERE p.identifier = prev.identifier
      RETURNING p.identifier, p.name, p.plan, prev.old_plan`,
    [identifier, plan, days]
  );

  const activated = rows[0];
  if (!activated) return null;

  if (activated.old_plan !== activated.plan) {
    await notifyPlanActivated(
      { identifier: activated.identifier, name: activated.name, plan: activated.plan },
      "paygate"
    );
  }
  return { identifier: activated.identifier, name: activated.name, plan: activated.plan };
}
```

- [ ] **Step 3: Verifica build + test esistenti plan-grant**

Run: `npm run build && npx tsx tests/plan-grant.test.ts`
Expected: build ok; il test esistente di plan-grant resta verde (non modificato).

- [ ] **Step 4: Commit**

```bash
git add lib/plan-grant.ts
git commit -m "feat(pay): activatePaygatePlan (+30/+365gg) (#PAYGATE-PAY)"
```

---

### Task 4: `POST /api/paygate/checkout`

**Files:**
- Create: `app/api/paygate/checkout/route.ts`

**Interfaces:**
- Consumes: `getSessionPlan` (`@/lib/auth`), `siteOrigin` (`@/lib/activation`), `dbQuery`/`dbExecute` (`@/lib/db`), `amountFor`/`newOrderToken`/`createReceivingWallet`/`buildPayUrl` (`@/lib/paygate`).
- Produces: `POST /api/paygate/checkout` → `{ url }` (302-target lato client) o errore.

- [ ] **Step 1: Implementare la route**

```ts
import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { siteOrigin } from "@/lib/activation";
import { amountFor, newOrderToken, createReceivingWallet, buildPayUrl, type PlanKey, type Period } from "@/lib/paygate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const payoutWallet = process.env.PAYGATE_PAYOUT_WALLET;
  if (!payoutWallet) return NextResponse.json({ error: "paygate not configured" }, { status: 503 });
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  const ctx = await getSessionPlan(req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown; period?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const plan = body.requested_plan;
  const period = body.period;
  if (plan !== "base" && plan !== "premium") return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  if (period !== "monthly" && period !== "annual") return NextResponse.json({ error: "invalid period" }, { status: 400 });

  const amount = amountFor(plan as PlanKey, period as Period);
  const { token, tokenHash } = newOrderToken();

  // Crea l'ordine pending (fonte dell'idempotenza + del token anti-spoof).
  const created = await dbExecute<{ id: string }>(
    `INSERT INTO paygate_orders (identifier, plan, period, amount_usd, token_hash)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ctx.identifier, plan, period, amount, tokenHash]
  );
  const orderId = created?.[0]?.id;
  if (!orderId) return NextResponse.json({ error: "order create failed" }, { status: 500 });

  // Segna pending_payment (come il path Stripe/USDT).
  await dbQuery(
    `UPDATE profiles SET plan = 'pending_payment', requested_plan = $2, updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [ctx.identifier, plan]
  );

  const origin = siteOrigin(req);
  const callbackUrl = `${origin}/api/paygate/callback?token=${encodeURIComponent(token)}&order=${orderId}`;

  let wallet;
  try {
    wallet = await createReceivingWallet(payoutWallet, callbackUrl);
  } catch (e) {
    console.error("[paygate/checkout] wallet.php failed:", String(e));
    return NextResponse.json({ error: "paygate wallet failed" }, { status: 502 });
  }

  await dbExecute(
    "UPDATE paygate_orders SET polygon_address_in = $2 WHERE id = $1",
    [orderId, wallet.polygonAddressIn]
  );

  const url = buildPayUrl({ addressIn: wallet.addressIn, amount, email: ctx.identifier });
  return NextResponse.json({ url });
}
```

- [ ] **Step 2: Verifica build + lint**

Run: `npm run lint && npm run build`
Expected: nessun errore sui nuovi file (l'errore lint pre-esistente in `app/app/page.tsx` su `Date.now()` non è nostro — NON toccarlo).

- [ ] **Step 3: Commit**

```bash
git add app/api/paygate/checkout/route.ts
git commit -m "feat(pay): route checkout PayGate (#PAYGATE-PAY)"
```

---

### Task 5: `GET /api/paygate/callback` — conferma idempotente verificata

**Files:**
- Create: `app/api/paygate/callback/route.ts`

**Interfaces:**
- Consumes: `hashToken`/`evaluateCallback`/`checkPaymentStatus` (`@/lib/paygate`), `dbQuery`/`dbExecute` (`@/lib/db`), `activatePaygatePlan` (`@/lib/plan-grant`).
- Produces: `GET /api/paygate/callback` → sempre `{ ok: true }` (200), con grant solo se verificato.

- [ ] **Step 1: Implementare la route**

```ts
import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { hashToken, evaluateCallback, checkPaymentStatus } from "@/lib/paygate";
import { activatePaygatePlan } from "@/lib/plan-grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRow = {
  id: string;
  identifier: string;
  plan: "base" | "premium";
  period: "monthly" | "annual";
  amount_usd: number;
  status: string;
  polygon_address_in: string | null;
};

// PayGate chiama questo URL (GET, NON firmato) al pagamento. Risponde sempre 200
// per non innescare retry-storm; il grant avviene solo se la verifica passa.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const rawValue = url.searchParams.get("value_coin");
  const valueCoin = rawValue != null && rawValue !== "" ? Number(rawValue) : null;
  if (!token) return NextResponse.json({ ok: true });

  const tokenHash = hashToken(token);
  const orders = await dbQuery<OrderRow>(
    `SELECT id, identifier, plan, period, amount_usd::float8 AS amount_usd, status, polygon_address_in
       FROM paygate_orders WHERE token_hash = $1 LIMIT 1`,
    [tokenHash]
  );
  const order = orders[0] ?? null;

  // (a) token + (b) importo
  const decision = evaluateCallback({
    order: order ? { status: order.status, amount_usd: order.amount_usd } : null,
    valueCoin,
  });
  if (!decision.grant) {
    console.warn(`[paygate/callback] no-grant: ${decision.reason} (token_hash=${tokenHash.slice(0, 12)})`);
    return NextResponse.json({ ok: true });
  }

  // (c) difesa in profondità (attiva solo quando confermato l'endpoint, Task 7)
  if (process.env.PAYGATE_STATUS_CHECK === "1" && order) {
    const st = await checkPaymentStatus({ polygonAddressIn: order.polygon_address_in ?? "", ipnToken: "" });
    if (!st.confirmed) {
      console.warn(`[paygate/callback] status not confirmed (order=${order.id})`);
      return NextResponse.json({ ok: true });
    }
  }

  // Lock idempotente: solo il primo callback "vince" l'UPDATE pending→paid.
  const claimed = await dbExecute<{ id: string }>(
    `UPDATE paygate_orders SET status = 'paid', value_coin = $2, paid_at = NOW()
      WHERE id = $1 AND status = 'pending' RETURNING id`,
    [order!.id, valueCoin]
  );
  if (!claimed?.length) return NextResponse.json({ ok: true }); // già processato

  await activatePaygatePlan(order!.identifier, order!.plan, order!.period);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verifica build + lint**

Run: `npm run lint && npm run build`
Expected: nessun errore sui nuovi file (ignorare il lint pre-esistente in `app/app/page.tsx`).

- [ ] **Step 3: Commit**

```bash
git add app/api/paygate/callback/route.ts
git commit -m "feat(pay): callback PayGate verificato + idempotente (#PAYGATE-PAY)"
```

---

### Task 6: UI — ripuntare il checkout su PayGate + toggle Mensile/Annuale

**Files:**
- Modify: `app/app/page.tsx` (funzione `payWithCard`, ~riga 3229, dentro il modal di checkout)

**Interfaces:**
- Consumes: `POST /api/paygate/checkout` (Task 4).

- [ ] **Step 1: Aggiungere lo stato `period` + toggle nel modal di checkout**

Nel componente del modal di checkout (quello che contiene `payWithCard` e usa `plan`/`planAmountUsdt`), aggiungere uno stato periodo e i prezzi annuali client-side (solo display; l'importo reale lo calcola il server):

```tsx
const [period, setPeriod] = useState<"monthly" | "annual">("annual");
const ANNUAL_PRICE: Record<string, number> = { base: 169, premium: 419 };
const displayPrice = period === "annual" ? ANNUAL_PRICE[plan] : planAmountUsdt(plan);
```

Aggiungere, vicino al prezzo mostrato nel modal, un toggle (mantenendo lo stile/markup dei controlli già presenti nel modal — leggerli prima e rispecchiarli):

```tsx
<div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
  <button type="button" onClick={() => setPeriod("monthly")} aria-pressed={period === "monthly"}>Mensile</button>
  <button type="button" onClick={() => setPeriod("annual")} aria-pressed={period === "annual"}>Annuale −30%</button>
</div>
<p style={{ fontSize: 12, opacity: 0.7 }}>
  {period === "monthly" ? "Pagamento singolo, sblocca 30 giorni (rinnovo manuale)." : "Pagamento singolo, sblocca 12 mesi."}
</p>
```
(Mostrare `displayPrice` dove oggi viene mostrato `price`.)

- [ ] **Step 2: Ripuntare `payWithCard` su PayGate**

Sostituire il corpo di `payWithCard` con:
```tsx
  const payWithCard = async () => {
    const res = await fetch("/api/paygate/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requested_plan: plan, period }),
    });
    if (!res.ok) {
      console.error("paygate checkout failed", res.status);
      setError(t("checkout_error") || "Pagamento non disponibile, riprova.");
      return;
    }
    const { url } = (await res.json()) as { url?: string };
    if (url) window.location.href = url;
  };
```
(Se `t("checkout_error")` non esiste come chiave, usare la stringa italiana diretta — non aggiungere chiavi i18n in questo task.)

- [ ] **Step 3: Verifica build + lint**

Run: `npm run lint && npm run build`
Expected: build ok; nessun NUOVO errore introdotto da queste modifiche (l'errore pre-esistente su `Date.now()` resta, non è nostro).

- [ ] **Step 4: Commit**

```bash
git add app/app/page.tsx
git commit -m "feat(pay): UI checkout → PayGate + toggle mensile/annuale (#PAYGATE-PAY)"
```

---

### Task 7: Verifica reale end-to-end (GATED)

> Non è codice. Richiede `APPROVE` umano + accesso a Supabase prod, env Vercel e un pagamento di test reale. Trasforma "Costruito" in "Verificato/Operativo".

**Pre-requisiti (gated):**
- [ ] Impostare env Vercel (prod + preview): `PAYGATE_PAYOUT_WALLET=0x72e348d948e984c7d57d8ccb93fdd52710e47fa2`. Lasciare `PAYGATE_STATUS_CHECK` **non** impostato finché lo step "Check Status" non è confermato.
- [ ] Applicare la migration `paygate_orders` (Task 1) — `supabase db push` o MCP `apply_migration` — solo dopo APPROVE.

**Verifica funzionale:**
- [ ] **Unit verdi:** `npx tsx tests/paygate.test.ts` (stampa `paygate ok`) e `npx tsx tests/plan-grant.test.ts`.
- [ ] **Checkout:** da utente loggato, scegliere Pro/Annuale → `POST /api/paygate/checkout` crea una riga `paygate_orders` pending con `amount_usd=419`, `profiles.plan='pending_payment'`, e redirige a `checkout.paygate.to/pay.php`.
- [ ] **Pagamento test (importo minimo):** completare un pagamento reale; verificare che PayGate chiami `/api/paygate/callback?token=...&value_coin=...`, che l'ordine passi a `paid` e che `profiles.plan`/`plan_expires_at` (+365gg) vengano impostati una sola volta.
- [ ] **Anti-spoof:** chiamare il callback con un `token` casuale/errato → **nessun** cambiamento di piano (resta `pending`).
- [ ] **Idempotenza:** ripetere lo stesso callback valido → nessun doppio grant (ordine già `paid`).
- [ ] **Payout:** verificare l'arrivo di USDC sul wallet `0x72e3…7fa2` (Polygon).
- [ ] **VERIFICA-PERNO Check Status:** confermare params dell'endpoint Check Payment Status PayGate; cablarlo in `checkPaymentStatus`; poi impostare `PAYGATE_STATUS_CHECK=1` e ripetere la verifica.
- [ ] **Minimi d'ordine:** verificare che il mensile Base $19.90 non sia sotto il minimo dei provider mostrati; se lo è, decidere (alzare prezzo / nascondere mensile Base).
- [ ] **Visual check** del modal checkout (toggle + prezzi + nota rinnovo) da loggato.

**Report finale:** "cosa è cambiato davvero vs proposto" + aggiornare memoria progetto.

---

## Self-Review (eseguita)

**Spec coverage:**
- §3.1 tabella `paygate_orders` → Task 1 ✓
- §3.2 checkout (pending_payment, wallet.php, pay.php, importo server-side) → Task 4 ✓
- §3.3 callback 3 strati (token + importo + status gated) + idempotenza → Task 5 (+ evaluateCallback in Task 2) ✓
- §3.4 `activatePaygatePlan` (+30/+365, source 'paygate') → Task 3 ✓
- §3.5 `lib/paygate.ts` → Task 2 ✓
- §3.6 UI toggle + repoint → Task 6 ✓
- §4 verifica → Task 2 (unit) + Task 7 (gated) ✓
- §7 env `PAYGATE_PAYOUT_WALLET` → Task 7 ✓
- Stripe/CoinsPaid dormienti (non rimossi) → rispettato (solo repoint UI) ✓

**Placeholder scan:** l'unico TODO è `checkPaymentStatus` (strato (c)), consapevolmente env-gated e confermato in Task 7 — il gate hard (token+importo) è completo e testato. Nessun altro placeholder.

**Type consistency:** `PlanKey`/`Period`, `amountFor`, `newOrderToken`/`hashToken`, `evaluateCallback`, `createReceivingWallet`/`buildPayUrl`, `activatePaygatePlan(identifier, plan, period)` usati coerentemente tra Task 2/3/4/5. `ActivationSource` esteso a `'paygate'` in Task 3 prima dell'uso.

## Note di rischio (per il gate)
- **Soldi/prod:** build non incassa nulla; go-live gated (Task 7).
- **Anti-spoof:** token monouso 32B + check importo (testati) come gate hard; status-check come extra env-gated.
- **DB:** una tabella nuova additiva, RLS-deny, rollback fornito; `profiles` toccato con gli stessi UPDATE-pattern esistenti.
- **Gateway no-KYC:** rischio compliance/affidabilità accettato da Andrea (OK legale attestato); payout self-custodial.
- **Mensile senza auto-rinnovo:** esplicitato nella UI (nota "rinnovo manuale").
