# Spec — Stripe (Subscription) su BetRedge

**Data:** 2026-06-11
**Stato:** design approvato (Andrea) — pre-implementazione
**Rischio:** medium/high (pagamenti, soldi, prod). Soggetto a gate `ch_deploy_gate` (APPROVE umano prima dell'esecuzione; live mode = APPROVE separato).

## 1. Obiettivo

Aggiungere un metodo di pagamento **fiat tramite carta** (Stripe) a BetRedge, in modalità **abbonamento ricorrente mensile**, che **affianca** (non sostituisce) il checkout USDT TRC20 manuale esistente. Copre il GAP5 (fiat) della gap-analysis pagamenti.

Decisioni recepite in brainstorming:
- **Modello:** Stripe Subscriptions (rinnovo automatico mensile).
- **Coesistenza:** affianca USDT; l'utente sceglie carta o crypto.
- **Prezzo:** USD, ~19.90 (Base) / ~49.90 (Pro), allineati 1:1 al valore USDT attuale.
- **Entità incasso:** Maven Agency (live mode); sviluppo/test in TEST mode.
- **Self-service:** Stripe Customer Portal (disdetta, aggiorna carta, fatture).
- **Decadenza:** immediata alla disdetta (no pro-rata, no attesa fine periodo).

## 2. Stato attuale (codice esistente, da non rompere)

- Identità utente = `identifier` (email), con sessione firmata (`lib/auth.ts`, cookie `SESSION_COOKIE`).
- Tipo piano: `Plan = "free" | "pending_payment" | "base" | "premium" | "admin_full"` (`lib/auth.ts:8`).
- Tabella `profiles`: campi rilevanti `identifier`, `name`, `plan`, `requested_plan`, `plan_expires_at`, `tx_hash`, `activation_token_hash`, `activation_token_expires`, `updated_at`.
- Flusso USDT oggi:
  1. `POST /api/auth` `action=checkout` (autenticato) → `plan='pending_payment'`, `requested_plan=base|premium`, salva `tx_hash`; email "ricevuta" best-effort (`app/api/auth/route.ts`).
  2. **Admin attiva a mano** `POST /api/admin/activations` → `plan=requested_plan`, `requested_plan=NULL`, `plan_expires_at=NOW()+30d`, logga evento `admin_profile_plan_changed`, email "piano attivo" (`app/api/admin/activations/route.ts`).
  3. Cron `/api/cron/subscriptions` fa scadere i piani contro `plan_expires_at`.
- Piani definiti in `lib/commercial-plan.ts` (`PUBLIC_PAID_PLANS`, importi in USDT).
- Proiezione accesso in `lib/access-projection.ts` (free=top1/sport, base=top5, premium/admin=∞).

**Stripe non è ancora presente nel codice** (nessun match `stripe`).

## 3. Architettura

Secondo binario di pagamento "carta" parallelo all'USDT. Dove oggi attiva l'admin, lì subentra il **webhook Stripe** che attiva in automatico. Modello dati invariato salvo l'aggancio agli oggetti Stripe.

**Fonte di verità (deciso):** per i clienti carta, **Stripe è la fonte di verità della scadenza**: `plan_expires_at` viene riallineato a `current_period_end` a ogni `invoice.paid`. Il cron di scadenza resta come rete di sicurezza e non deve declassare un sub Stripe attivo.

### 3.1 Modello dati — colonne nuove su `profiles`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription ON profiles (stripe_subscription_id);
```

Entrambe nullable. Migration in `supabase/` (additiva, non distruttiva, idempotente).

### 3.2 Componenti (unità isolate)

| Unità | Responsabilità | Dipendenze |
|---|---|---|
| `lib/stripe.ts` | Inizializza il client Stripe da `STRIPE_SECRET_KEY`. Mappa piano→Price ID (`base`→`STRIPE_PRICE_BASE`, `premium`→`STRIPE_PRICE_PREMIUM`). Espone `isStripeConfigured()`; se chiavi assenti il modulo è "spento". | `stripe` SDK, env |
| `lib/plan-grant.ts` | **Refactor**: estrae `activatePlan(identifier, plan, expiresAt)` dalla logica oggi in `admin/activations` (UPDATE plan/requested_plan/plan_expires_at + evento + email best-effort). Usato da **admin e webhook**. | `lib/db`, `lib/email` |
| `app/api/stripe/checkout/route.ts` | `POST` autenticato. Crea Checkout Session `mode=subscription` con `client_reference_id=identifier`, `customer`/`customer_email`, `metadata.plan`, `success_url`/`cancel_url` da `NEXT_PUBLIC_SITE_URL`. Setta `plan='pending_payment'`+`requested_plan` (coerente con USDT). Ritorna `{url}`. | `lib/stripe`, `lib/auth`, `lib/db`, `lib/commercial-plan` |
| `app/api/stripe/webhook/route.ts` | `POST` pubblico. Verifica firma con `STRIPE_WEBHOOK_SECRET` sul **raw body** (`req.text()`, runtime nodejs). Gestisce gli eventi (§3.3). Idempotente. | `lib/stripe`, `lib/plan-grant`, `lib/db` |
| `app/api/stripe/portal/route.ts` | `POST` autenticato. Crea Billing Portal session per `stripe_customer_id`. Ritorna `{url}`. 409 se nessun customer. | `lib/stripe`, `lib/auth`, `lib/db` |
| UI `app/app/page.tsx` | Bottone "Paga con carta (Stripe)" accanto a USDT nel modale checkout; link "Gestisci abbonamento" per chi ha `stripe_customer_id`. Surgical: branch dedicato, toccare solo i propri hunk (page.tsx ha modifiche non committate di altre sessioni). | route sopra |

### 3.3 Flusso eventi webhook

| Evento Stripe | Azione |
|---|---|
| `checkout.session.completed` | Match profilo via `client_reference_id` (fallback `customer_email`). Salva `stripe_customer_id` + `stripe_subscription_id`. |
| `invoice.paid` | **Attiva/rinnova**: `activatePlan(identifier, plan, current_period_end)`. `plan` derivato da `subscription.metadata.plan` (o dal Price ID). `plan_expires_at = current_period_end`. Vale per primo pagamento e rinnovi. |
| `customer.subscription.deleted` | **Downgrade immediato**: `plan='free'`, `plan_expires_at=NULL`, `stripe_subscription_id=NULL`. |

Customer Portal configurato con **cancellazione immediata** (non a fine periodo), coerente con la decadenza immediata.

Idempotenza: gli handler sono UPDATE idempotenti per stato; ri-consegne dello stesso evento non producono effetti divergenti. (Niente tabella eventi dedicata in v1 — gli UPDATE sono già convergenti.)

### 3.4 Mapping piano ↔ Price

`metadata.plan` portato nella Checkout Session e copiato sulla Subscription è la fonte primaria. Fallback difensivo: lookup inverso `STRIPE_PRICE_BASE`/`STRIPE_PRICE_PREMIUM` → `base`/`premium`. Se nessun match → log error, no-op (non attivare un piano sconosciuto).

## 4. Configurazione fuori-codice

### 4.1 Stripe Dashboard (Maven)
- 2 Product + Price ricorrenti mensili USD: 19.90 (Base), 49.90 (Pro).
- Customer Portal abilitato, cancellazione = **immediata**, update carta + fatture ON.
- Webhook endpoint → `https://<dominio>/api/stripe/webhook`, eventi: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`.

### 4.2 Env Vercel
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASE`
- `STRIPE_PRICE_PREMIUM`
- (success/cancel URL derivati da `NEXT_PUBLIC_SITE_URL` esistente)

### 4.3 GAP3 (blocker go-live, umano/Maven)
Dati fiscali + bancari dell'entità Maven per attivare il **live mode** di Stripe. Tutto lo sviluppo e i test girano in **TEST mode**; il passaggio a chiavi live è un APPROVE separato e successivo.

## 5. Gestione errori

- Chiavi Stripe assenti (`!isStripeConfigured()`) → checkout/portal rispondono **503** "stripe not configured"; l'USDT resta intatto.
- Firma webhook invalida → **400**, nessuna mutazione.
- Scritture DB **fail-loud** (come il pattern esistente in `auth/route.ts`).
- Email "piano attivo" sempre **best-effort** (catch + log, mai bloccante).
- Piano non risolvibile da metadata/price → log error, no-op.

## 6. Testing (Costruito ≠ Verificato)

Tutto in **Stripe TEST mode**, con `stripe listen --forward-to localhost:3000/api/stripe/webhook` e carte di test:

1. Checkout Base → `invoice.paid` → profilo `plan='base'`, `plan_expires_at == current_period_end`, `stripe_customer_id`/`stripe_subscription_id` valorizzati.
2. Checkout Pro → idem con `premium`.
3. Rinnovo simulato (`invoice.paid` successivo) → `plan_expires_at` avanza.
4. Disdetta via Customer Portal → `customer.subscription.deleted` → `plan='free'` **immediato**, `plan_expires_at=NULL`.
5. Carta che fallisce (test card declinata) → nessuna attivazione.
6. Firma webhook errata → 400, nessuna mutazione.
7. Ri-consegna dello stesso `invoice.paid` → stato invariato (idempotenza).
8. Chiavi assenti → checkout 503, USDT funziona.
9. Regressione: admin manual activation USDT ancora funzionante dopo il refactor `activatePlan()`.

Nessuna dichiarazione "funziona" senza questi verdi.

## 7. Gate di approvazione

Task medium/high. Dopo l'OK sullo spec:
1. PROPOSAL change-spec su `ch_deploy_gate` (file/tabelle/endpoint toccati, prima→dopo, comandi, reversibilità, blast radius, piano di verifica) → attesa `APPROVE` umano (Andrea o Michele).
2. Esecuzione in TEST mode.
3. Report "cosa è cambiato davvero vs proposto".
4. Go-live (chiavi live + entità Maven + GAP3) = **APPROVE separato**.

## 8. Fuori scope (YAGNI v1)

- Free trial / coupon / codici sconto.
- Cambio piano in-app self-service (upgrade/downgrade) oltre a quanto offre il Customer Portal.
- Fatturazione fiscale custom (delegata a Stripe/Maven).
- Proration / rimborsi pro-rata (decisione: decadenza immediata, no rimborso).
- Tabella eventi webhook dedicata (gli UPDATE sono già idempotenti).
