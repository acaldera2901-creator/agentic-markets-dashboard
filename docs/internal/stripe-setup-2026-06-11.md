# Stripe Setup & TEST-mode Verification Runbook — BetRedge

**Data:** 2026-06-11
**Spec:** `docs/superpowers/specs/2026-06-11-stripe-payments-design.md`
**Piano:** `docs/superpowers/plans/2026-06-11-stripe-payments.md`
**Stato:** codice implementato su branch `feat/stripe-payments`. La configurazione dashboard/env e i test reali sono **gated** (richiedono APPROVE umano su `ch_deploy_gate`). Tutto parte in **TEST mode**; il live mode è un APPROVE separato.

## 1. Stripe Dashboard (account Maven, TEST mode)

1. **Products + Prices** (ricorrenti mensili, valuta USD):
   - BetRedge Base → Price ricorrente mensile **$19.90**. Annotare il `price_...` id → `STRIPE_PRICE_BASE`.
   - BetRedge Pro → Price ricorrente mensile **$49.90**. Annotare il `price_...` id → `STRIPE_PRICE_PREMIUM`.
2. **Customer Portal** (Settings → Billing → Customer portal):
   - Abilitare il portale.
   - Cancellazione abbonamento = **immediata** (non a fine periodo) — coerente con la decadenza immediata decisa.
   - Abilitare: aggiornamento metodo di pagamento, download fatture.
3. **Webhook** (Developers → Webhooks → Add endpoint):
   - URL: `https://<dominio-betredge>/api/stripe/webhook`
   - Eventi: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
   - Annotare il signing secret `whsec_...` → `STRIPE_WEBHOOK_SECRET`.

## 2. Env vars

Da impostare su Vercel (e in `.env.local` per lo sviluppo locale):

| Var | Origine |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (TEST: `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | dal webhook endpoint (`whsec_...`) — in dev usare quello stampato da `stripe listen` |
| `STRIPE_PRICE_BASE` | price id del Product Base |
| `STRIPE_PRICE_PREMIUM` | price id del Product Pro |

Se le env non sono presenti, i route `/api/stripe/*` rispondono **503** e l'USDT continua a funzionare (degradazione sicura).

## 3. GAP3 — blocker go-live (live mode)

Il passaggio da TEST a **live mode** richiede l'attivazione dell'account Stripe dell'entità **Maven Agency**: dati fiscali, business details e conto bancario di accredito. È un **APPROVE separato** e successivo alla verifica TEST mode. Non procedere al live senza OK umano.

## 4. Checklist verifica TEST mode

Setup locale:
```
npm run dev
stripe listen --forward-to localhost:3000/api/stripe/webhook
# usa il whsec_ stampato da `stripe listen` come STRIPE_WEBHOOK_SECRET locale
```

Casi (carte di test Stripe: success `4242 4242 4242 4242`, declinata `4000 0000 0000 0002`):

```
[ ] 1. Checkout Base → invoice.paid → profilo plan='base', plan_expires_at == current_period_end,
       stripe_customer_id e stripe_subscription_id valorizzati
[ ] 2. Checkout Pro  → idem con plan='premium'
[ ] 3. Rinnovo (stripe trigger invoice.paid, o avanzamento test clock) → plan_expires_at avanza
[ ] 4. Disdetta dal Customer Portal → customer.subscription.deleted →
       plan='free' IMMEDIATO, plan_expires_at=NULL, stripe_subscription_id=NULL
[ ] 5. Carta declinata (4000000000000002) → nessuna attivazione (resta pending_payment)
[ ] 6. Firma webhook errata → HTTP 400, nessuna mutazione DB
[ ] 7. Ri-consegna dello stesso invoice.paid → stato invariato (idempotenza)
[ ] 8. Env Stripe assenti → /api/stripe/checkout risponde 503, checkout USDT funziona
[ ] 9. Regressione: attivazione manuale admin USDT ancora funzionante (dopo refactor activatePlan)
```

Nessuna dichiarazione "funziona" finché tutti i casi sopra non sono verdi (Costruito ≠ Verificato ≠ Operativo).

## 5. Note implementazione (per chi verifica)

- **Stripe SDK v22**: i campi dell'`Invoice` sono cambiati rispetto a versioni precedenti. Il webhook ricava:
  - `priceId` da `line.pricing.price_details.price` (non più `line.price`),
  - `subscriptionId` da `invoice.parent.subscription_details.subscription` (non più `invoice.subscription`),
  - `period.end` dalla line item (invariato),
  - `identifier` da `subscription.metadata.identifier`, con fallback lookup per `stripe_customer_id`.
- `plan_expires_at` per i clienti carta è allineato a `current_period_end` di Stripe (fonte di verità). Il cron di scadenza resta come rete di sicurezza.
- L'helper `activatePlan()` (`lib/plan-grant.ts`) è condiviso tra attivazione admin (USDT) e webhook (Stripe).
