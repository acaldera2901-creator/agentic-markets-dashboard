# Migrazione billing → Shopify (headless commerce)

- **Data:** 2026-07-24
- **Autore:** Andrea + Claude (profilo aziendale)
- **Stato:** design approvato in brainstorming, in attesa di review spec
- **Rischio:** ALTO / irreversibile su prod → deploy branch+PR, prod = **APPROVE** umano
- **Driver:** semplificare la **gestione** degli abbonamenti (fatture/ricevute + ciclo abbonamento). NON è un problema di conversione.

---

## 1. Obiettivo e non-obiettivi

**Obiettivo.** Spostare lo **strato commerce** (checkout, abbonamenti, fatture, portale cliente, dunning, rimborsi) su **Shopify**, mantenendo il prodotto BetRedge su Vercel + Supabase. Shopify diventa la sorgente degli eventi di pagamento; Supabase resta **l'unica fonte di verità del piano** che sblocca la board.

**Successo (verificabile).**
1. Un utente loggato su betredge.com può abbonarsi (base o premium) via checkout Shopify con carta e, entro pochi secondi dal pagamento, la board si sblocca al tier corretto (`profiles.plan` aggiornato).
2. Shopify emette fattura/ricevuta al cliente e la disdetta/il pagamento fallito riportano l'utente a `free` alla scadenza.
3. Gli abbonati PayGate esistenti **non** vengono toccati e continuano a rinnovare su PayGate finché non migrano (grandfather).
4. Nessuna regressione sul gate esistente (`lib/auth.ts`, `lib/access-projection.ts`).

**Non-obiettivi.**
- NON si migra l'app (ML, board, gating) su Shopify: Shopify è solo commerce.
- NON si tocca il Free tier: resta in-app, senza pagamento.
- NON si costruisce nulla finché lo **STEP 0 legale** non è chiuso (vedi §8).
- NON si spegne PayGate al go-live: convivenza temporanea (grandfather).

---

## 2. Vincoli noti (dal contesto)

- **Gate gambling (AUP).** Shopify vieta betting/gambling. L'apertura del merchant dipende dal posizionamento **non-gambling** (prodotto dati/predizioni). È un **blocco duro**: se non regge, questa spec non parte.
- **Addio crypto sui nuovi abbonati.** Shopify = carta/Apple Pay. Chi vuole solo crypto resta su PayGate durante il grandfather.
- **Tier reali nel DB:** `free` / `base` / `premium` (+ stati `pending_payment`, `admin_full`). "Pro" del marketing = `premium`. Prezzi correnti: Base 19.90 / Premium 49.90.

---

## 3. Stato attuale del codice (ancoraggio)

Sorgente di verità del gate — **da NON rompere**:

- **Piano:** `profiles.plan` ∈ {`free`,`pending_payment`,`base`,`premium`,`admin_full`}; scadenza `profiles.plan_expires_at` (`timestamptz`, nullable); `requested_plan` per il tier scelto in checkout.
  - `db/migrations/002_profiles.sql`, `supabase/migrations/20260605182000_plan_expires_at.sql`, `supabase/migrations/20260611140000_profiles_stripe.sql` (aggiunge `stripe_subscription_id`, `tx_hash`).
- **Lettura piano (fresh dal DB, mai da cookie), per `identifier` (= email lowercased+trim):** `lib/auth.ts`
  - `effectivePlan(plan, expiresAt)` — applica scadenza alla lettura, fail-closed.
  - `getSessionPlan(req)`, `planHasAccess`, `planHasPremium`, `resolveAccessState(req)`.
- **Proiezione a strati per tier:** `lib/access-projection.ts` (`showcaseAllowance`, `isUnlocked`, `projectPrediction`). Consumo board: `app/api/v2/predictions/route.ts`, client `lib/use-has-access.ts`, `app/api/auth/route.ts`.
- **Middleware:** `middleware.ts` gate SOLO `/admin` (HMAC). Nessun gating di piano nel middleware.

Pattern pagamenti esistente da **riusare** (PayGate):
- Callback/IPN: `app/api/paygate/callback/route.ts` (risponde sempre 200; difesa via `token_hash` monouso + verifica server-side dell'esito + verifica importo).
- Grant: `lib/plan-grant.ts` → `activatePaygatePlan(identifier, plan, period)`, `activatePaypalPlan(...)`, `computePaygateGrant(...)` (stacking tempo residuo su rinnovo + anti-downgrade, `PLAN_RANK base=1 premium=2`).
- Idempotenza: RPC atomica `claim_paygate_order` (`SECURITY DEFINER`, ritorna TRUE solo al vincitore della race) + marcatore `granted_at`; ordini in `paygate_orders` (`supabase/migrations/20260627130000_paygate_orders.sql`).
- Reconcile: `app/api/cron/paygate-reconcile/route.ts` (gated da `CRON_SECRET`, self-heal grant + settle pending).
- **Handler firmati già esistenti come modello per l'HMAC Shopify:** `app/api/stripe/webhook/`, `app/api/paypal/webhook/`.

---

## 4. Architettura target (headless commerce)

```
Utente loggato (betredge.com, Vercel)
        │  clic "Abbonati" (base|premium)
        ▼
Shopify checkout (carta / Apple Pay)
   - 2 prodotti in abbonamento (selling plan) via app subscription
   - email cliente = identifier BetRedge; user id in note/cart attribute
        │  pagamento OK
        ▼
Webhook Shopify  ──HMAC──▶  /api/shopify/webhook (Next.js su Vercel)
   - verifica X-Shopify-Hmac-Sha256
   - idempotenza (dedup per event id) via shopify_orders + claim RPC
   - mappa cliente → identifier (email)
   - activateShopifyPlan(identifier, plan, period)  → riusa computeGrant
        │
        ▼
Supabase  profiles.plan / plan_expires_at / plan_source='shopify'
        │  (fonte di verità INVARIATA)
        ▼
lib/auth.ts + lib/access-projection.ts → board sbloccata al tier
```

PayGate resta in parallelo per i soli abbonati `plan_source='paygate'` (grandfather).

---

## 5. Componenti

### 5.1 Setup Shopify (config, no codice repo)
- Store + **Shopify Payments** (carta/Apple Pay). Verifica disponibilità nel paese del merchant.
- App **subscription** (Shopify Subscriptions nativo oppure Appstle/Recharge) — 2 selling plan: Base 19.90/mese, Premium 49.90/mese (+ eventuale annuale in futuro, fuori scope v1).
- App **fatture** (es. Sufio) per ricevute/fatture tax-compliant.
- Branding checkout minimo (logo/colori BetRedge). Portale cliente self-service per gestione/disdetta.
- **Segreto webhook** (HMAC) generato e messo in env Vercel.

### 5.2 Schema Supabase (nuove strutture, additive)
- **`profiles.plan_source`** `TEXT CHECK (plan_source IN ('paygate','shopify','stripe','paypal','manual') OR plan_source IS NULL)` — chi "possiede" il piano attivo. Backfill: righe con piano attivo esistente → `'paygate'` (o `'manual'` per admin). Invariante grandfather: il webhook Shopify scrive/declassa **solo** righe con `plan_source='shopify'` o `plan_source IS NULL` (utenti free/mai paganti); **non tocca** righe `plan_source='paygate'` con `plan_expires_at` futura.
- **`shopify_orders`** (analogo a `paygate_orders`): `id`, `identifier`, `plan`, `period`, `amount`, `shopify_customer_id`, `shopify_subscription_id`, `event_id UNIQUE` (idempotenza redelivery), `status`, `granted_at`, `created_at`.
- **RPC `claim_shopify_event(p_event_id)`** (`SECURITY DEFINER`) sul modello di `claim_paygate_order`: concede il grant solo al vincitore della race sull'`event_id`.
- `profiles.shopify_customer_id` / `shopify_subscription_id` per il mapping stabile (in aggiunta all'email).

### 5.3 Webhook handler `/api/shopify/webhook` (Next.js, Vercel)
- **Verifica HMAC** `X-Shopify-Hmac-Sha256` col segreto webhook (modello: `app/api/stripe/webhook/`). Firma non valida → 401.
- **Idempotenza:** dedup per `event_id`/`X-Shopify-Webhook-Id` via `shopify_orders.event_id UNIQUE` + `claim_shopify_event`. Redelivery → no-op 200.
- **Eventi gestiti:**
  - `orders/paid` (o `subscription_billing_attempts/success`) → **grant/rinnovo**: `activateShopifyPlan(identifier, plan, period)`.
  - `subscription_contracts/update` con stato `cancelled` / billing attempt `failure` finale → nessun downgrade immediato: la scadenza è già gestita da `plan_expires_at` + `effectivePlan` (fail-closed alla lettura). Su cancellazione, si lascia scadere naturalmente a fine periodo (coerente col comportamento attuale).
- **Mapping utente:** per email (`identifier`), case-insensitive come PayGate; fallback su `shopify_customer_id` se l'email non matcha. Se l'utente non esiste ancora → ordine `status='paid' granted_at IS NULL` per reconcile (stesso pattern PayGate).
- Risponde **200** anche sui no-grant (evita retry-storm); recupero via claim + reconcile.

### 5.4 Grant `activateShopifyPlan` (`lib/plan-grant.ts`)
- Riusa `computePaygateGrant`-style: stacking del tempo residuo su rinnovo + anti-downgrade (`PLAN_RANK`).
- Scrive su `profiles`: `plan`, `requested_plan=NULL`, `plan_expires_at`, `plan_source='shopify'`, `shopify_subscription_id`, `updated_at`.
- **Guardia grandfather:** se la riga target ha `plan_source='paygate'` con `plan_expires_at` futura → NON sovrascrivere; logga conflitto + alert (caso raro: utente con doppio abbonamento).

### 5.5 Entry-point checkout (front-end)
- Per i **nuovi** abbonamenti (base/premium): il bottone "Abbonati" apre il **checkout Shopify** (link permalink al selling plan) con email dell'utente loggato pre-compilata e `identifier` in note/cart attribute.
- Gli abbonati PayGate esistenti continuano a vedere il rinnovo via PayGate finché `plan_source='paygate'`.
- Redirect post-pagamento → betredge.com; la board legge il piano fresco (nessuna modifica al gate).

### 5.6 Cron reconcile `/api/cron/shopify-reconcile`
- Gated da `CRON_SECRET` (modello PayGate). Passata: `shopify_orders` `status='paid' AND granted_at IS NULL` → ri-tenta `activateShopifyPlan` (self-heal quando il profilo compare). Fail-loud → `opsAlert`.
- (Opzionale v1.1) confronto abbonati attivi Shopify (via Admin API) vs `profiles` `plan_source='shopify'` per drift detection.

### 5.7 Migrazione grandfather (comms)
- Email agli abbonati `plan_source='paygate'` vicino a `plan_expires_at`: "riabbonati su Shopify" con link. Usa il CRM/email brandizzato esistente.
- PayGate si spegne quando `COUNT(*) FROM profiles WHERE plan_source='paygate' AND plan_expires_at > now() = 0`.

---

## 6. Flussi dati

**Nuovo abbonato.** login → "Abbonati" (base/premium) → checkout Shopify (email+identifier agganciati) → pagamento carta → webhook `orders/paid` → HMAC ok → `claim_shopify_event` → `activateShopifyPlan` → `profiles.plan/plan_expires_at/plan_source='shopify'` → redirect → board sbloccata.

**Rinnovo.** billing attempt success → webhook → `activateShopifyPlan` (stack tempo) → `plan_expires_at` esteso.

**Disdetta / pagamento fallito finale.** webhook update `cancelled` → nessuna scrittura distruttiva; a `plan_expires_at` scaduta `effectivePlan` declassa a `free` alla lettura.

**Grandfather (crypto esistente).** invariato su PayGate; webhook Shopify non tocca `plan_source='paygate'`.

---

## 7. Gestione errori

- HMAC non valido → **401**, nessuna scrittura.
- Redelivery / doppio evento → idempotente (`event_id UNIQUE` + claim RPC).
- Email non mappabile → **non scartare in silenzio**: ordine `paid/granted_at NULL` + `opsAlert` + coda reconcile.
- Pagamento fallito → dunning dell'app subscription; al fallimento finale, downgrade naturale a scadenza.
- Conflitto `plan_source='paygate'` attivo vs grant Shopify → non sovrascrivere, log + alert.
- Cron reconcile fail-loud (500 + alert), come PayGate.

---

## 8. Gate & sequenza (bloccante)

**STEP 0 — LEGALE (blocca tutto).** `legale-compliance` verifica che Shopify accetti BetRedge col posizionamento non-gambling (AUP + Shopify Payments). Output: GO / NO-GO scritto.
- NO-GO → la spec si ferma qui; si resta su PayGate o si valuta un Merchant-of-Record. Nessun codice, nessuno store aperto.
- GO → si procede con §5.

**Deploy.** Ogni modifica: branch + PR. Prod = **PROPOSAL + APPROVE** umano (Andrea/Michele). Migration Supabase additive prima, codice dopo. PayGate resta acceso.

---

## 9. Testing

- **Unit:** `activateShopifyPlan` (grant, rinnovo-stacking, anti-downgrade, guardia grandfather); verifica HMAC; idempotenza `claim_shopify_event`.
- **Webhook:** payload di test Shopify su preview deploy → HMAC ok/ko, redelivery no-op, mapping email/customer_id, caso utente-non-esistente.
- **E2E:** signup → checkout (bogus/test gateway Shopify) → webhook → board sbloccata al tier → disdetta → downgrade a scadenza.
- **Regressione grandfather:** utente `plan_source='paygate'` attivo → un evento Shopify **non** lo declassa/sovrascrive.
- **Gate invariato:** i test esistenti su `lib/auth.ts` / `access-projection.ts` restano verdi.

---

## 10. Aperti / decisioni future (fuori scope v1)

- Scelta puntuale app subscription (nativo vs Appstle vs Recharge) e app fatture → in fase di setup, prima del codice.
- Piani annuali su Shopify.
- Spegnimento definitivo PayGate (data condizionata al churn dei crypto).
- Eventuale drift-detection avanzata (§5.6 v1.1).
