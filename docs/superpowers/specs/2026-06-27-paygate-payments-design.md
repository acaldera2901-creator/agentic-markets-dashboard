# PayGate.to — Gateway di pagamento unico BetRedge — Design Spec

**Data:** 2026-06-27
**Branch:** `feat/paygate-payments`
**Owner:** Andrea (+ Michele) — profilo aziendale Agentic Markets / BetRedge
**Stato:** design approvato, spec in review

> ⚠️ **Gate di approvazione.** Lavoro **high-risk** (soldi + prod + tabella `profiles`). Lo spec e il piano **non vengono eseguiti** in produzione (env reali, wallet reale, callback pubblico, primo pagamento reale) senza `APPROVE #id` umano. Costruito ≠ Verificato ≠ Operativo.

---

## 1. Obiettivo

Integrare **PayGate.to** come **unico gateway di pagamento** di BetRedge: il cliente paga con carta / Apple Pay / Google Pay / SEPA (tramite i provider licenziati che PayGate aggrega) e noi riceviamo **payout in USDC (Polygon)** sul wallet self-custodial.

**Decisioni (brainstorming 2026-06-27):**

| Tema | Decisione |
|------|-----------|
| Ruolo | **Unico gateway.** La UI viene ripuntata da Stripe a PayGate. Codice Stripe/CoinsPaid lasciato **dormiente** (non cablato alla UI), non rimosso (surgical; rimozione = follow-up). |
| Modello | **Mensile + Annuale (−30%)**, per Base e Pro. PayGate fa pagamenti **one-off** → niente auto-rinnovo. |
| Consenso legale | **OK attestato da Andrea** (2026-06-27): parte legale/fiscale valutata e approvata. Resta il gate APPROVE sull'esecuzione. |
| Wallet payout | `PAYGATE_PAYOUT_WALLET = 0x72e348d948e984c7d57d8ccb93fdd52710e47fa2` — USDC (Polygon), self-custodial (confermato Andrea). |
| Modalità checkout | **`pay.php` multi-provider** (il cliente sceglie il metodo). |

### Prezzi

| Piano | Mensile (+30 gg) | Annuale −30% (+365 gg) |
|---|---|---|
| Base | $19.90 | **$169** |
| Pro | $49.90 | **$419** |

- Importi in **USD** (`currency=USD`). Annuali arrotondati (richiesta Andrea: $169 / $419).
- ⚠️ **Mensile = one-off che sblocca 30 giorni, SENZA auto-rinnovo** (limite del gateway): l'utente ri-paga manualmente. L'annuale è il caso naturale per questo rail.

---

## 2. Stato attuale (contesto verificato)

- **App:** `~/Desktop/agentic-markets` (Next.js App Router, repo `agentic-markets-dashboard`).
- **Flusso pagamento attuale (Stripe, NON live — gated):**
  - UI "Upgrade" → `POST /api/stripe/checkout`: valida sessione (`getSessionPlan`), segna `profiles.plan='pending_payment'` + `requested_plan`, crea sessione Stripe, ritorna `{url}` → redirect.
  - `POST /api/stripe/webhook` → `activateStripePlan(...)` in `lib/plan-grant.ts` → flip `plan` + `plan_expires_at` + notifica.
- **Path manuale USDT/admin:** `activateAdminPlan(identifier)` (pending_payment → requested_plan, +30 gg), innescato dalle attivazioni nel BO.
- **`lib/plan-grant.ts`** già fornisce: `expirySqlExpr(iso|null)`, `notifyPlanActivated(row, source)` (audit `events` + email `plan_activated`), `activateAdminPlan`, `activateStripePlan`. **Riusiamo `notifyPlanActivated` e il pattern, non lo riscriviamo.**
- **Piani:** `lib/commercial-plan.ts` → `base` ($19.90), `premium` ($49.90); `normalizeCheckoutPlan`.
- **Tabella `profiles`:** `identifier (email), plan (free|pending_payment|base|premium|admin_full), requested_plan, plan_expires_at, ...`.

### PayGate.to — modello (dalla doc fornita + repo ufficiali)

Due step obbligatori, REST senza API key, no SDK:

1. **`GET https://api.paygate.to/control/wallet.php?address=<payout>&callback=<callback urlencoded>`**
   → ritorna `address_in` (wallet cifrato temporaneo), `polygon_address_in` (decifrato, per tracking), `callback_url`, `ipn_token`.
   - Il `callback` **deve avere un parametro unico per ogni richiesta** (riusare lo stesso → stesso indirizzo temporaneo). `ipn_token` serve **solo al supporto** per investigare callback falliti (NON è una firma).
2. **`GET https://checkout.paygate.to/pay.php?address=<address_in>&amount=<n>&email=<urlenc>&currency=USD`** (multi-provider)
   → redirige il cliente alla pagina di scelta provider. **Vietato in iframe**: redirect diretto.

**Callback di pagamento:** quando il cliente paga, PayGate invia un **GET al nostro `callback_url`** con tutti i nostri parametri + `value_coin` (USDC effettivi inviati dal provider). **Nessuna firma HMAC** documentata.

Endpoint accessori citati (params esatti **da confermare in implementazione**): **Check Payment Status**, **Convert to USD** (non necessario: prezziamo già in USD).

---

## 3. Architettura

PayGate rimpiazza i due punti del flusso Stripe (init checkout + conferma async), riusando il resto.

### 3.1 Modello dati — tabella `paygate_orders`

```sql
CREATE TABLE IF NOT EXISTS paygate_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier    TEXT NOT NULL,                  -- email utente (profiles.identifier)
  plan          TEXT NOT NULL CHECK (plan IN ('base','premium')),
  period        TEXT NOT NULL CHECK (period IN ('monthly','annual')),
  amount_usd    NUMERIC(10,2) NOT NULL,         -- importo atteso passato a PayGate
  token_hash    TEXT NOT NULL UNIQUE,           -- hash (sha256) del token random per-ordine nel callback
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  value_coin    NUMERIC(20,6),                  -- USDC ricevuti, dal callback verificato
  polygon_address_in TEXT,                       -- per tracking/riconciliazione
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_paygate_orders_identifier ON paygate_orders (identifier);
ALTER TABLE paygate_orders ENABLE ROW LEVEL SECURITY;   -- operator/service-role only; nessuna policy
-- Rollback: DROP TABLE IF EXISTS paygate_orders;
```

Si memorizza **solo `token_hash`** (mai il token in chiaro): il callback porta il token in chiaro, noi lo hashiamo e cerchiamo l'ordine.

### 3.2 `POST /api/paygate/checkout`

Mirror di `stripe/checkout`:
1. `getSessionPlan(req)` → 401 se assente; blocca cross-site come fa Stripe.
2. Body: `requested_plan` (`base|premium`), `period` (`monthly|annual`). Valida con whitelist.
3. Calcola `amount_usd` da una **tabella prezzi server-side** (`lib/paygate.ts`), mai dal client:
   `base/monthly=19.90, base/annual=169, premium/monthly=49.90, premium/annual=419`.
4. Genera **token random ad alta entropia** (32 byte, base64url); salva l'ordine `pending` con `token_hash=sha256(token)`.
5. `UPDATE profiles SET plan='pending_payment', requested_plan=$plan` (come Stripe).
6. Chiama `wallet.php(address=PAYGATE_PAYOUT_WALLET, callback=<SITE>/api/paygate/callback?token=<token>&order=<id>)`.
   - Se `PAYGATE_PAYOUT_WALLET` manca → 503 esplicito (nessun ordine creato).
   - Salva `polygon_address_in` sull'ordine.
7. Costruisce `pay.php?address=<address_in>&amount=<amount_usd>&email=<enc>&currency=USD` → ritorna `{ url }`.

### 3.3 `GET /api/paygate/callback` — verifica anti-spoof a 3 strati

Il callback è un GET **non firmato** → il callback grezzo **non è fonte di verità**. Concessione del piano **solo** se TUTTO torna:

1. **(a) Autenticità — token monouso.** `token` dalla query → `sha256` → cerca `paygate_orders` per `token_hash` con `status='pending'`. Assente/non-pending → 200 ok ma **nessuna azione** (no leak, no retry-storm). Un attaccante non può indovinare il token a 32 byte → non può simulare un "pagato".
2. **(b) Importo.** `value_coin` (USDC) ≥ `amount_usd` − tolleranza fee (es. 2%). Sotto soglia → ordine resta `pending`, log, niente grant.
3. **(c) Conferma server-side (difesa in profondità).** Ri-verifica via **Check Payment Status** PayGate (params esatti da confermare in impl.) usando `polygon_address_in`/`ipn_token`. Se non confermato → niente grant.
4. Se (a)+(b)+(c) ok → **transazione idempotente**: marca l'ordine `paid` (guard `WHERE status='pending'` → un secondo callback non concede 2 volte) e chiama `activatePaygatePlan(identifier, plan, period)`.

### 3.4 `activatePaygatePlan` (in `lib/plan-grant.ts`)

Nuova funzione, expiry parametrico per periodo, riusa `notifyPlanActivated(row, 'paygate')`:
```
period 'monthly' → plan_expires_at = NOW() + INTERVAL '30 days'
period 'annual'  → plan_expires_at = NOW() + INTERVAL '365 days'
```
UPDATE atomico (no pending-guard: la fonte di verità è il callback già verificato + il guard sull'ordine), `requested_plan=NULL`, notifica solo su transizione reale (come `activateStripePlan`). `source='paygate'` → aggiungere `'paygate'` al tipo `ActivationSource`.

### 3.5 `lib/paygate.ts`

Unità isolata, REST no-SDK:
- `PAYGATE_PRICES`: tabella prezzi server-side (sopra) + `amountFor(plan, period)`.
- `createReceivingWallet(payout, callbackUrl)`: GET wallet.php → `{ address_in, polygon_address_in, ipn_token }` (throw su !ok).
- `buildPayUrl({ addressIn, amount, email })`: stringa `pay.php?...currency=USD`.
- `checkPaymentStatus(...)`: GET check-status (params da confermare in impl.) → `{ confirmed: boolean, valueCoin?: number }`.

### 3.6 UI — `PlansTab` (in `app/app/page.tsx`)
- Toggle **Mensile / Annuale (−30%)**; mostra i 4 prezzi.
- "Upgrade/Scegli" → `POST /api/paygate/checkout` con `{ requested_plan, period }` → redirect a `url`.
- Ripunta i call-site che oggi chiamano `/api/stripe/checkout`. Stile invariato (surgical).

---

## 4. Verifica (Goal-Driven)

**Unit (tsx + node:assert):**
1. `amountFor`: ritorna 19.90/169/49.90/419 per le 4 combinazioni; combinazione invalida → throw.
2. `buildPayUrl`: encoding corretto di email/amount, `currency=USD`, `address` cifrato passato as-is.
3. Verifica callback (pura, con fetch/db stubbati): token sconosciuto → no-grant; importo sotto soglia → no-grant; tutto ok → grant una sola volta (secondo callback idempotente).

**Integrazione/gated (Task finale, dopo APPROVE):**
4. Migration `paygate_orders` applicata (idempotente, rollback testato).
5. **Verifica-perno live PayGate:** confermare params di Check Payment Status; eseguire un pagamento test su importo minimo; verificare callback→grant; verificare che un callback con token errato NON conceda; verificare arrivo USDC sul wallet.
6. Minimi d'ordine per provider (il mensile Base $19.90 potrebbe essere sotto soglia).
7. Visual check `PlansTab` da utente loggato.

---

## 5. Rischi / blast radius
- **Soldi/prod:** Fase build non incassa nulla; go-live gated.
- **Spoofing callback:** mitigato da token monouso a 32 byte + check importo + ri-verifica stato; il grant è idempotente.
- **Gateway anonimo no-KYC:** rischio compliance/affidabilità payout accettato da Andrea (OK legale attestato); payout su wallet self-custodial.
- **DB:** una tabella nuova additiva, RLS-deny, rollback fornito; `profiles` toccato solo via UPDATE già esistenti come pattern.
- **Mensile senza auto-rinnovo:** UX nota; mostrare chiaramente "rinnovo manuale" nella UI.

## 6. Out of scope (YAGNI)
- Auto-rinnovo (gateway one-off), white-label dominio (`domain=`), affiliate split, rimozione fisica del codice Stripe/CoinsPaid (resta dormiente), Convert-to-USD (prezziamo in USD).

## 7. Env nuove
- `PAYGATE_PAYOUT_WALLET` = `0x72e348d948e984c7d57d8ccb93fdd52710e47fa2`.
- (Riusa `NEXT_PUBLIC_SITE_URL` per costruire il callback pubblico.)
