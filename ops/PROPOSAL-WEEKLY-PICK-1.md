# PROPOSAL — Weekly Pick (multipla della casa) one-off · #WEEKLY-PICK-1

> Canale: `ch_council_main` (decisione prezzo/go). NON è un deploy: nessuna
> esecuzione prima di OK Michele (prezzo) + APPROVE `ch_deploy_gate` (tocca
> DB + pagamenti). Bozza preparata da Andrea via Claude Code, 2026-07-06.

## Task
Aggiungere una **"Weekly Pick"**: la **multipla della casa** = le migliori pick
della settimana combinate nella schedina **più probabile** secondo il modello.
Venduta **one-off** a chi non è Pro (Free + Base); **inclusa** nel piano Pro.

## Prezzo — DECISO da Andrea: **€12.99** (upsell della weekly pick)
Il pricing è **lane di Michele** ed è stato **deployato oggi** (`9ec9943`,
`#PRICING-CREATORS-0706`): Base **$14.99/mese**, Pro **$29.99/mese**. Il 06/07 alle
12:11 il modello definitivo aveva scartato "weekly pick come prodotto"; Andrea la
**reintroduce come upsell one-off a €12.99**. Questa PROPOSAL serve quindi per
**allineare Michele** (non per decidere il prezzo, già deciso) + per l'APPROVE del
deploy (DB/pagamenti).

**⚠️ Nota di cannibalizzazione da monitorare (non blocca):** €12.99 one-off sta a
ridosso di **un mese intero di Base a 14.99** → tenere il weekly pick chiaramente
**inferiore a Base** (1 multipla vs 5 pick/sport) e usarlo come **gancio verso
Base/Pro** (es. "con Base hai questa + molto altro a 2€ in più"). KPI da guardare
dopo il lancio: take-rate weekly pick vs conversioni Base.

## Cos'è il prodotto (design)
- **1 multipla/settimana**, generata deterministicamente dal motore Match Builder:
  top pick per prob del modello attraverso gli sport → schedina combinata.
- **Scade** a fine settimana (nuova multipla ogni lunedì).
- Chi la compra sblocca **quella** multipla (pick + prob) per la settimana corrente.
- **Pro**: inclusa, nessun paywall.
- Nessuna quota, nessun edge promesso (coerente FTC / copy esistente).

Aperto: **chi/come genera** la multipla (job settimanale deterministico vs
selezione curata). Raccomando job deterministico (zero curation manuale).

## COSA CAMBIEREBBE ESATTAMENTE (change-spec, SOLO se approvato)
Rail consigliato = **PayGate** (già one-shot; Stripe è hardcoded `subscription`).

- **DB** (migration nuova, gate):
  - opz.1 tabella `weekly_pick_purchases(identifier, week, purchased_at)` — pulita.
  - opz.2 estendere `paygate_orders` con colonna `kind` (oggi CHECK ammette solo
    base/premium): prima→dopo del CHECK.
  - `profiles` non tocca schema.
- **Prezzo**: `lib/paygate.ts` `PAYGATE_PRICES`/`amountFor` → aggiungere il prodotto
  weekly_pick a **€12.99**. Mai prezzo dal client.
- **Checkout**: `app/api/paygate/checkout/route.ts` accetta `kind=weekly_pick`
  (oggi hard-limita a base/premium, righe ~31-34) e scrive l'ordine col kind.
- **Callback**: `app/api/paygate/callback/route.ts` → al posto di `activatePaygatePlan`
  chiama nuova `grantWeeklyPick()` (analoga a `lib/plan-grant.ts`).
- **Gating**: `lib/access-projection.ts` sblocca la multipla della settimana per
  chi ha acquistato (oltre a `AccessState` passare "ha weekly pick attivo");
  Pro/admin già inclusi.
- **Generazione**: job/endpoint settimanale che calcola la multipla (riusa la
  logica prob del Match Builder) e la persiste.
- **UI**: CTA acquisto in `PlansTab`/`LockedGate` per Free/Base; **nascosta** per
  Pro (`profileHasPremium`).
- **Reversibilità**: feature dietro env flag (es. `NEXT_PUBLIC_WEEKLY_PICK_ENABLED`)
  → spegnibile senza rollback codice. Rollback DB: drop tabella/colonna.
- **Blast radius**: pagamenti + DB + gating. **APPROVE obbligatorio** pre-deploy.
- **Verifica**: test checkout sandbox PayGate → grant → sblocco lato board da
  loggato su prod (preview non fa login); scadenza settimanale.

## Owner esecuzione
Dev: Andrea (via Claude Code). Prezzo (€12.99) e go: **deciso da Andrea**.

## Serve OK da
1. **Michele** — allineamento (prezzo già deciso da Andrea); flag se confligge col
   pricing appena deployato.
2. **APPROVE `ch_deploy_gate`** (umano) prima del deploy DB+pagamenti.

---

## AGGIORNAMENTO 2026-07-07 — UI strutturata FATTA, resta il GO-LIVE (gate)

La pagina è stata ridisegnata e resa raggiungibile. **Fatto su branch
`feat/weekly-pick-page` (frontend/read-only, NON deployato, NON mergiato):**
- `/weekly-pick` riscritta in 4 sezioni: hero+spiegazione, card multipla con **stato
  live delle legs** (✓/✗/⏱ — chi compra a metà settimana vede cosa ha già giocato e
  cosa manca), come funziona, storico settimane precedenti.
- Endpoint `/api/weekly-pick/history` (read-time, join su `unified_predictions.result`,
  **nessuna nuova tabella**) + `/api/weekly-pick` arricchito con lo stato per-leg.
- Funzione pura `resolveWeeklyPickOutcomes` + 6 unit test (verdi).
- Entry point: link nel **rail "Featured"** (glyph SVG `g-ticket`) + benefit "Weekly
  Pick inclusa" nella card **Pro** dei Piani.
- No-leak enforced: utenti lockati vedono solo label + `N ancora da giocare`, mai
  pick/prob/esito per-leg.
- Build verde, tsc pulito, visual check locale OK (con flag OFF mostra "in arrivo").

### COSA CAMBIA al GO-LIVE (change-spec, SOLO se approvato — nulla di ciò segue prima)
1. **Merge/deploy** del branch `feat/weekly-pick-page` su main → prod (Vercel).
   Reversibile: revert del merge.
2. **DB**: apply `db/migrations/014_weekly_pick.sql` su prod (crea `weekly_pick`,
   `weekly_pick_orders`, `weekly_pick_purchases` + RPC `claim_weekly_pick_order`).
   Reversibile: drop tabelle/RPC.
3. **Env**: `WEEKLY_PICK_ENABLED=true` su Vercel (prod). Reversibile: `false`.
4. **Cron**: aggiungere in `vercel.json`
   `{ "path": "/api/weekly-pick/generate", "schedule": "0 6 * * 1" }` (lun 06:00 UTC).
   Usa `CRON_SECRET` (già presente).
5. **Pagamenti**: verificare rail PayGate one-off €12.99 (checkout→callback→grant) in
   sandbox prima del GO.
- **Blast radius**: DB + pagamenti + deploy prod. **APPROVE `ch_deploy_gate` (umano) +
  OK Michele sul prezzo OBBLIGATORI.**
- **Verifica post-GO**: dopo il primo `generate` (o trigger manuale con `CRON_SECRET`),
  da loggato su prod la card mostra la multipla con stato live; acquisto one-off
  sblocca; lo storico popola dalla 2ª settimana.
