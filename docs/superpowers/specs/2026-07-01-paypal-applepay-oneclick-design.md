# One-click checkout: PayPal + Apple Pay (NO Stripe) — Design

- **Data:** 2026-07-01
- **Autore:** Andrea via Claude Code
- **Stato:** Design approvato (2026-07-01) → spec per implementation plan
- **Rischio:** HIGH (pagamenti / env / prod) → esecuzione go-live dietro `PROPOSAL + APPROVE` in `ch_deploy_gate`

## Obiettivo

Aggiungere **almeno 2 metodi di pagamento one-click** al checkout BetRedge: **PayPal** e **Apple Pay**, integrati **accanto** all'infrastruttura di pagamento attuale (PayGate.to card→USDC + USDT manuale). **Niente Stripe** (decisione esplicita di Andrea).

## Contesto attuale (verificato nel codice)

- Il checkout live usa **PayGate.to** (`app/api/paygate/checkout` → pagina hosted `pay.php`, card→USDC) + un flusso **USDT manuale** (copia wallet, incolla TX hash, attivazione manuale). CTA piano in `app/app/page.tsx:3235` chiama `/api/paygate/checkout`.
- Esiste codice Stripe (`lib/stripe.ts`, `app/api/stripe/*`) ma **non è collegato ai bottoni** e non è live → **fuori scope**, non lo tocchiamo.
- **Modello di grant = una-tantum, non abbonamento auto-rinnovante.** `lib/plan-grant.ts::activatePaygatePlan(identifier, plan, period)` concede accesso per N giorni: `plan_expires_at = NOW() + INTERVAL '30/365 days'` (30 mensile / 365 annuale). L'utente ripaga alla scadenza. Nessun rinnovo automatico oggi.
- Prezzi **server-side** già centralizzati: `lib/paygate.ts::PAYGATE_PRICES` e `lib/commercial-plan.ts` (base 19.90 / premium 49.90 USD, mensile/annuale). Mai dal client.
- Pattern anti-spoof PayGate (da rispecchiare): callback **non fidato** → verifica server-side dell'esito reale + **claim atomico** `pending→paid` (RPC `claim_paygate_order`) prima del grant, idempotente.

## Vincolo tecnico chiave

**Apple Pay non è un processore a sé**: tokenizza una carta che ha bisogno di un PSP per l'incasso. Senza Stripe, il PSP è **PayPal**: il **PayPal JS SDK (Complete/Advanced Payments)** renderizza in un'unica integrazione **sia il bottone PayPal sia il bottone Apple Pay**. Fonte verificata: PayPal Developer — Apple Pay for Checkout, e recurring via Vault (qui NON serve, restiamo one-time).

## Architettura

Un **unico rail nuovo (PayPal JS SDK)** che porta PayPal + Apple Pay, affiancato a PayGate. Modello **cattura una-tantum**, specchio esatto del flusso PayGate.

### Flusso

1. **UI** (`app/app/page.tsx`, card piano): aggiungere i bottoni **PayPal + Apple Pay** (renderizzati dal PayPal JS SDK) accanto ai metodi attuali (carta/PayGate + USDT manuale).
2. `POST /api/paypal/create-order` — server crea l'ordine PayPal con **importo dai prezzi server-side** (`commercial-plan.ts` / `PAYGATE_PRICES`), mai dal client. Salva riga in `paypal_orders` (status `pending`).
3. Utente approva nel bottone PayPal/Apple Pay (SDK client).
4. `POST /api/paypal/capture` — server:
   - cattura l'ordine via PayPal REST API (`/v2/checkout/orders/{id}/capture`);
   - **verifica server-side**: `status = COMPLETED` + importo catturato = importo atteso per (plan, period);
   - **claim atomico** `pending→paid` sull'ordine (idempotenza + anti doppio-grant), sul modello `claim_paygate_order`;
   - concede il piano via nuova `activatePaypalPlan(identifier, plan, period)`.
5. **Webhook PayPal** (`POST /api/paypal/webhook`, opzionale ma consigliato) per riconciliazione: verifica firma webhook (`PAYPAL_WEBHOOK_ID`) e rigioca lo stesso path di grant se il capture client non è arrivato. Non fidarsi del client.

### Componenti (unità isolate)

- `lib/paypal.ts` — client REST PayPal (no SDK server): OAuth token, create order, capture order, verifica webhook. Prezzi/`amountFor` riusati da `commercial-plan.ts`. Speculare a `lib/paygate.ts`.
- `app/api/paypal/create-order/route.ts` — crea ordine + riga `paypal_orders`.
- `app/api/paypal/capture/route.ts` — cattura + verifica + claim + grant.
- `app/api/paypal/webhook/route.ts` — riconciliazione firmata.
- `lib/plan-grant.ts` — aggiungere `activatePaypalPlan(...)` che riusa lo stesso SQL `plan_expires_at` di `activatePaygatePlan`/`computePaygateGrant` (generalizzazione minima, no duplicazione).
- **DB**: nuova tabella `paypal_orders` speculare a `paygate_orders` (`id`, `identifier`, `plan`, `period`, `amount_usd`, `status`, `paypal_order_id`, `granted_at`, `created_at`) + RPC di claim atomico speculare a `claim_paygate_order`.
- **UI**: bottoni PayPal + Apple Pay nella card piano di `app/app/page.tsx`.

### Riuso (refusal ladder)

- Prezzi server-side → **già esistono** (`commercial-plan.ts` / `PAYGATE_PRICES`).
- Grant piano → **riuso** dello stesso SQL `plan_expires_at` (nuova `activatePaypalPlan` sottile).
- Ordine + claim atomico + verifica server-side → **copiati** dal pattern PayGate (già collaudato anti-spoof).
- Nessuna astrazione speculativa: si specchia la struttura PayGate esistente.

## Apple Pay — requisiti reali (config, non codice)

- Il bottone Apple Pay gira su `betredge.com` (non su pagina hosted) → **registrazione dominio con Apple via PayPal**: hostare il file `.well-known/apple-developer-merchantid-domain-association` fornito da PayPal.
- Account PayPal business con **Advanced/Complete Payments** abilitato ed eleggibile.

## Configurazione / Go-live (GATED)

- Secrets su Vercel: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, base URL sandbox↔live.
- File `.well-known` Apple Pay servito dal dominio.
- Endpoint webhook registrato nel dashboard PayPal → `https://www.betredge.com/api/paypal/webhook`.
- Migration `paypal_orders` + RPC claim applicata al DB (Supabase/Neon come da split esistente).

## Verifica (Costruito ≠ Verificato ≠ Operativo)

1. **Sandbox** PayPal: buyer sandbox completa un acquisto → ordine `paid` → `plan_expires_at` esteso correttamente per (plan, period) → receipt email inviata.
2. **Apple Pay** su iOS/Safari reale in sandbox → stesso esito.
3. **Idempotenza**: doppio capture/webhook non concede due volte.
4. **Live**: 1 pagamento reale piccolo (Andrea) prima di dichiarare operativo.

## Fuori scope (YAGNI / surgical)

- Nessun **rinnovo automatico**: si mantiene il modello una-tantum attuale (no vaulting/merchant-initiated).
- **Nessuno Stripe** (né si tocca il codice Stripe esistente).
- **Google Pay** non richiesto ora (aggiungibile poi con lo stesso PayPal SDK, path identico ad Apple Pay).
- Non si toccano PayGate né il flusso USDT manuale (restano come sono).
- Pre-existing: gestione `pending_payment` su abbandono checkout resta invariata.

## Gate di approvazione

Task HIGH-risk. Il **codice** (route/lib/UI/migration su branch) è implementabile; il **go-live** (secrets prod, dominio Apple, abilitazione PayPal, applicazione migration al DB prod) parte **solo** dopo `PROPOSAL + APPROVE` di un umano in `ch_deploy_gate`. Dopo l'esecuzione: report "cosa è cambiato davvero vs proposto".

## Domande aperte (per l'implementation plan)

- `paypal_orders` su Supabase o Neon? (seguire lo split esistente di `paygate_orders`).
- Layout UI definitivo dei bottoni (ordine/peso PayPal vs Apple Pay vs metodi esistenti) — da decidere in fase UI.
