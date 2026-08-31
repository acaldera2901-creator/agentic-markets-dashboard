# Misurazione del funnel BetRedge — base line e strumentazione minima

**Data:** 2026-08-13 · **Owner:** marketing (CMO) · **Esecuzione:** programmatore-andrea (gated APPROVE)

## 1. Baseline letta in produzione (13/08/2026)

Fonte: Supabase prod `izscgffubtakzvwxchqt`, tabella `profiles`, count esatti via PostgREST.

| Metrica | Valore | Note |
|---|---|---|
| Profili totali | **19** | erano 18 l'08/08 |
| Piano `base` o `premium` attivo (non scaduto) | **8** | include account team/comp: non è "8 clienti paganti" |
| Piano `free` | **10** | |
| Altro / non classificato | **1** | |
| Creati prima del 01/07 | 5 | |
| Creati 01/07 → 13/07 | 5 | |
| Creati 14/07 → 31/07 | 7 | |
| Creati 01/08 → 13/08 | **2** | ~0,15 signup/giorno |

**Il lancio di 132 URL `/tools` (08/08) non ha ancora prodotto signup misurabili.** Non si può dire se non porta traffico o se porta traffico che non converte: non lo misuriamo.

## 2. Cosa NON sappiamo (e perché è il problema, non il traffico)

- **Sorgente di acquisizione: ignota per tutti e 19 i profili.** Nessuna colonna, nessun cookie, nessun parametro catturato in ingresso.
- **Visite sulle pagine pubbliche:** non misurate. Nessun vendor analytics (verificato: zero occorrenze di `@vercel/analytics`, `gtag`, GTM, Plausible, PostHog). Gli unici `utm_*` presenti sono in *uscita* verso gli affiliati (`lib/affiliate.ts`, `lib/partners.ts`).
- **Drop landing → signup:** non misurato.
- **Attivazione (prima pick vista):** non misurata.

Conseguenza pratica: qualsiasi piano di canale è cieco. Non possiamo distinguere "nessuno arriva" da "arrivano e non si iscrivono", che richiedono lavori opposti.

## 3. Cosa esiste già (e non va comprato)

**Un sistema di tracking di prima parte, completo e in prod:**
- `lib/track-event.ts:18-35` — `trackEvent(type, extra)` fire-and-forget verso `/api/track`; `session_id` inviato **solo** con `gdpr_consent === "accepted"`, l'evento parte comunque anonimo.
- `app/api/track/route.ts` — rate-limit 60/min per IP, allowlist eventi (`:16-21`), meta capped a 2048 byte, `INSERT INTO events`.
- Tabella `events` — `supabase/migrations/20260524000000_initial_schema.sql:59-70`.

**I due difetti che lo rendono inutile per il marketing:**
1. **È montato solo dentro il desk `/app`** e in 3 componenti. La home (`app/landing-client.tsx`), `/tools`, `/weekly-pick`, `/partners`, `/blog` non emettono **nessun** evento. Cioè: misuriamo chi è già entrato, non chi arriva.
2. **Tre eventi già emessi vengono droppati in silenzio** perché fuori allowlist (`route.ts:45-47` risponde `{ok:true, ignored:true}`): `referral_code_claimed`, `referral_link_copied`, `withdrawal_consent`. Il referral V2 è quindi cieco sui suoi due eventi chiave.

**Conclusione:** non serve né PostHog né Vercel Analytics. Serve montare quello che c'è dove conta e aggiungere una colonna di attribuzione.

## 4. Cosa misuriamo — il minimo, non 13 eventi

| Domanda | Come | Costo |
|---|---|---|
| Quante visite, su quali pagine, da quale referrer/UTM? | `page_view` globale via componente montato nel root layout | zero |
| Da dove viene *questo* utente che si è registrato? | attribuzione first-touch in `localStorage` → colonna `profiles.acquisition` (jsonb) all'INSERT | zero |
| Quanti iniziano il signup e non lo finiscono? | eventi `signup_started` / `signup_completed` in allowlist | zero |
| Il referral converte? | sblocco dei 3 eventi già emessi e droppati | zero |

**Escluso di proposito:** qualunque vendor esterno, cookie di terze parti, nuovo banner di consenso, i 13 eventi del piano GPT. L'attribuzione usa `localStorage` first-party, non un cookie: nessun nuovo perimetro di consenso, ma **va aggiunta una riga alla privacy policy** (dato di prima parte legato all'account).

## 5. Le soglie decisionali (a cosa serve il numero)

- **20/08** — ogni nuovo profilo ha una sorgente attribuita in DB. Se no, la strumentazione non è operativa e nient'altro parte.
- **26/08** — Search Console sui 132 URL `/tools`: impressioni e click organici. Sotto **50 click organici cumulati** nel primo mese post-indicizzazione, il canale SEO tools non giustifica altri tool: si passa a manutenzione.
- **Landing → signup < 2%** con traffico misurabile (>300 visite/settimana) → il problema è la landing, e si sistema quella *prima* di aprire qualunque canale nuovo.

## 6. Change-spec (PROPOSAL #FUNNEL-MEAS-0813 — attende APPROVE)

**Esecuzione:** `programmatore-andrea`. **Non parte senza APPROVE di Andrea.**

**A. Migration — 1 colonna, nullable**
`supabase/migrations/20260813HHMMSS_profiles_acquisition.sql`:
`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS acquisition JSONB;`
Da applicare a mano nel SQL Editor Supabase (stessa prassi di 015/016). Reversibile con `DROP COLUMN`. Blast radius: nessuno — nullable, nessun codice esistente la legge.

**B. `lib/attribution.ts` (nuovo, ~50 righe)**
First-touch: al primo caricamento salva in `localStorage['am_attrib']`, **solo se assente**, `{utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_path, first_seen}`. Export `getAttribution()`.

**C. `components/PageViewTracker.tsx` (nuovo) montato in `app/layout.tsx:92-97`**
Client component: chiama `initAttribution()` + `trackEvent("page_view", {path})` a ogni cambio di route. Per evitare doppioni va **rimossa** la chiamata `page_view` esistente al mount del desk (`app/app/page.tsx:8532`).

**D. `app/api/track/route.ts:16-21` — allowlist**
Aggiungere: `signup_started`, `signup_completed`, `first_pick_viewed`, `referral_code_claimed`, `referral_link_copied`, `withdrawal_consent`. (Gli ultimi tre sono già emessi dal codice e oggi scartati in silenzio.)

**E. `app/app/page.tsx:4289-4308` — form auth**
`trackEvent("signup_started")` all'apertura del tab register; `acquisition: getAttribution()` nel body del `fetch("/api/auth")`; `trackEvent("signup_completed")` sulla risposta 200/202.

**F. `app/api/auth/route.ts:367-371` — INSERT**
Aggiungere la colonna `acquisition` all'INSERT (valore sanificato: solo chiavi note, ogni valore troncato a 200 caratteri, l'intero oggetto scartato se > 2 KB). **Nessun'altra modifica al ramo register** — la logica anti-takeover di `:320` non si tocca.

**G. `/privacy`** — una riga: registriamo la sorgente di provenienza al momento della registrazione.

**Verifica (come si dimostra che funziona, non che è stato scritto):**
1. `npx vitest run` verde (baseline attuale 1367 test).
2. In preview: aprire `/?utm_source=test&utm_medium=qa` → registrare un utente di prova → la riga `profiles` ha `acquisition.utm_source = "test"`.
3. In preview: visitare `/tools` e `/weekly-pick` → due righe `page_view` in `events` con il path giusto.
4. In prod, entro 48h dal deploy: `events` contiene `page_view` da almeno 3 path pubblici distinti.

**Fuori scope dichiarato:** nessun vendor analytics, nessun cookie nuovo, nessun banner di consenso, nessuna modifica al desk oltre la riga duplicata del punto C, nessuna dashboard (i primi numeri si leggono in SQL).

## 7. Fuori perimetro (guardrail)

- Non si spinge volume sul funnel di pagamento finché la qualificazione non-gambling è ferma (`project_gambling_qualification`, owner Andrea/avvocato).
- Nessun contenuto di track record finché la semantica pick/confidence non è chiusa (`project_confidence_semantics`).
- Prezzi pubblici: **$14.99 Base / $29.99 Pro**, da `lib/commercial-plan.ts`. Unica fonte per qualunque copy.
