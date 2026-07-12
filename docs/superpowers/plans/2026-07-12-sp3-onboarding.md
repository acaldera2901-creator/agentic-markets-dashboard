# SP3 — Onboarding value-first · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il muro-wizard (crea profilo → scegli piano → invia USDT → sblocca) con un onboarding **value-first** dentro il feed: signup/login frictionless in un `Sheet`, gate +18/ToS **enforced anche lato server**, e un paywall **contestuale** (`UpgradeSheet`) agganciato ai "Prova Pro" già presenti (card locked SP1, soft SP2) che instrada al checkout esistente.

**Architecture:** Strangler. Il feed (`/oggi`, dietro `NEXT_PUBLIC_UX_NEW`) resta intatto; SP3 aggiunge `features/onboarding/` (AuthProvider, SignupSheet, LoginSheet, PaywallProvider, UpgradeSheet) che chiamano il backend **esistente** (`/api/auth`, `/api/paygate/checkout`, `/api/stripe/checkout`). Nessun nuovo backend di pagamento. La generosità del free **non cambia** (`showcaseAllowance` invariato).

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind 4, Vitest + Testing Library.

**Fasi:**
- **Fase A** (task 1–7): email/password + fix compliance +18/ToS server-side + AuthProvider + PaywallProvider + UpgradeSheet + cablaggio. **Zero dipendenze esterne — eseguibile subito.**
- **Fase B** (task 8+): OAuth Google/Apple. **Gated su prerequisiti esterni** (vedi §Prerequisiti Fase B) + review sicurezza dedicata. Il piano dettagliato di B si finalizza quando le credenziali provider esistono.

## Global Constraints

- **Prerequisito:** SP0+SP1+SP2 su `main`. Branch `feat/sp3-onboarding` da `main`.
- **Decisioni approvate (Andrea):** (1) email/password **+ OAuth Google/Apple** (OAuth in Fase B); (2) UpgradeSheet instrada al **checkout esistente** (nessun nuovo backend pagamenti); (3) **generosità free invariata** (`showcaseAllowance` anon=0/free=1/base=5/premium=∞ — NON toccare).
- **Auth reale:** cookie HMAC `am_session` (`lib/session.ts`), endpoint `/api/auth` POST con `action`: `register` `{identifier(email), name, language, timezone, password, referred_by, marketing_opt_in}`, `login` `{identifier, password}`, `logout`, `forgot_password`. `GET /api/auth` → profilo sessione. Tabella utenti = **`profiles`**, plan default `'free'`. Tier: `anonymous|free|pending_payment|base|premium|admin_full`.
- **COMPLIANCE (legale, critico):** oggi il gate +18/ToS è **solo client-side** e i flag non arrivano al server. SP3 deve (a) inviarli nel payload di `register`, (b) **rifiutare la registrazione server-side** se mancano, (c) persistere il consenso con timestamp. Questo tocca `/api/auth` + una migration DB → **review legale-compliance prima del deploy**.
- **Pagamenti:** prezzi reali Base **$14.99/mo** ($164.99/yr), Pro/Premium **$29.99/mo** ($329.99/yr) (`lib/paygate.ts`, `lib/commercial-plan.ts`). Rail: PayGate (auto-attiva), Stripe (env-gated), PayPal/ApplePay. UpgradeSheet **non** implementa pagamenti — instrada al flusso esistente.
- **FTC/legale:** nessun claim di rendimento nel copy di upsell; "Prova Pro" vende accesso ai pick, non vincite. Disclaimer gioco responsabile persistente.
- **Sicurezza:** password mai loggate; SP3 non introduce storage password in chiaro; il consenso è un boolean+timestamp. Deploy che tocca auth/DB = **medium/high → APPROVE**.
- **Zero AI-slop, token `--am-coral*` (mai `--am-green`), TDD, commit frequenti, PR a fine SP.**

---

## FASE A — Email/password + compliance + paywall (eseguibile subito)

### Task 1: Migration consenso +18/ToS su `profiles`

Aggiunge le colonne per registrare il consenso (mirror di `marketing_opt_in_at`).

**Files:**
- Create: `supabase/migrations/<timestamp>_profiles_consent.sql` (allineare al pattern migration esistente del repo — verificare la cartella reale con `ls supabase/migrations` prima)

**Interfaces:**
- Produces: colonne `age_confirmed_at timestamptz`, `tos_accepted_at timestamptz` su `profiles` (nullable; valorizzate al register).

> **Nota DB (gate):** cambio schema su tabella prod-critica. Applicare con la procedura migration del progetto (mai a mano su prod), backup prima, e **APPROVE** prima del push. Verificare drift.

- [ ] **Step 1: Ispezionare il pattern migration esistente**

Run: `ls supabase/migrations | tail -5` e aprire l'ultima per copiarne lo stile/header.

- [ ] **Step 2: Scrivere la migration** (adattare allo stile reale)

```sql
-- profiles: consent +18 e Terms/Privacy (SP3 onboarding, compliance)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tos_accepted_at  timestamptz;
```

- [ ] **Step 3: Applicare in locale/staging e verificare** (procedura Supabase del progetto), poi commit della migration. NON applicare su prod senza APPROVE.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(sp3): migration consenso +18/ToS su profiles (age_confirmed_at, tos_accepted_at)"
```

---

### Task 2: Server-side enforcement del consenso in `/api/auth` register

Rende il gate +18/ToS reale (non solo client).

**Files:**
- Modify: `app/api/auth/route.ts` (branch `register`, ~riga 255-302)
- Test: `app/api/auth/consent.test.ts` (unit sul validator estratto, per non dipendere dal DB)

**Interfaces:**
- Il payload `register` accetta `age_confirmed: boolean` e `tos_accepted: boolean`. Se uno dei due ≠ `true` → risposta **400** `{ error: "consent_required" }`, nessuna INSERT. Su successo, l'INSERT valorizza `age_confirmed_at = NOW()`, `tos_accepted_at = NOW()`.
- Produces (estratto testabile): `assertConsent(body: { age_confirmed?: unknown; tos_accepted?: unknown }): void` — throw `ConsentError` se non entrambi `true`.

- [ ] **Step 1: Test che fallisce** — `app/api/auth/consent.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { assertConsent, ConsentError } from "./consent";

describe("assertConsent", () => {
  it("passa se age+tos true", () => { expect(() => assertConsent({ age_confirmed: true, tos_accepted: true })).not.toThrow(); });
  it("throw se manca age", () => { expect(() => assertConsent({ tos_accepted: true })).toThrow(ConsentError); });
  it("throw se manca tos", () => { expect(() => assertConsent({ age_confirmed: true })).toThrow(ConsentError); });
  it("throw se non booleani true", () => { expect(() => assertConsent({ age_confirmed: "1", tos_accepted: 1 } as never)).toThrow(ConsentError); });
});
```

- [ ] **Step 2: RED** — `npx vitest run app/api/auth/consent.test.ts` → FAIL.

- [ ] **Step 3: Implementare** `app/api/auth/consent.ts`

```ts
export class ConsentError extends Error {
  constructor() { super("consent_required"); this.name = "ConsentError"; }
}
export function assertConsent(body: { age_confirmed?: unknown; tos_accepted?: unknown }): void {
  if (body.age_confirmed !== true || body.tos_accepted !== true) throw new ConsentError();
}
```

- [ ] **Step 4: Cablare nel register di `app/api/auth/route.ts`** — all'inizio del branch `register`, prima dell'INSERT: `try { assertConsent(body); } catch { return NextResponse.json({ error: "consent_required" }, { status: 400 }); }` e aggiungere `age_confirmed_at`, `tos_accepted_at` (= `NOW()`) alle colonne/valori dell'INSERT esistente.

- [ ] **Step 5: GREEN + verifica manuale** — `npx vitest run app/api/auth/consent.test.ts` → PASS; verificare a mano (curl/dev) che un register senza flag torni 400.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/consent.ts app/api/auth/consent.test.ts app/api/auth/route.ts
git commit -m "feat(sp3): enforce +18/ToS server-side nel register (400 consent_required)"
```

---

### Task 3: `AuthProvider` (context sessione client)

Espone lo stato utente/piano al feed.

**Files:**
- Create: `features/onboarding/AuthProvider.tsx`
- Test: `features/onboarding/AuthProvider.test.tsx`

**Interfaces:**
- Produces: `useAuth(): { user: { identifier: string; name: string | null } | null; plan: string | null; loading: boolean; refresh: () => Promise<void> }`; `AuthProvider({ children })`. Fetch `GET /api/auth` (`credentials:"include"`) → `{ profile }` o null. `refresh()` ri-fetcha (dopo login/signup/upgrade).

- [ ] **Step 1: Test che fallisce** (mock fetch)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";

function Probe() { const { plan, loading } = useAuth(); return <div>{loading ? "load" : `plan:${plan ?? "none"}`}</div>; }

it("espone il piano dalla sessione", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: { identifier: "a@b.c", name: "A", plan: "premium" } }) }));
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("plan:premium")).toBeInTheDocument());
});
it("anonimo → plan none", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: null }) }));
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("plan:none")).toBeInTheDocument());
});
```

- [ ] **Step 2: RED** → FAIL. **Step 3: Implementare** `AuthProvider.tsx` (context + `useEffect` fetch + `refresh`). **Step 4: GREEN.**
- [ ] **Step 5: Commit** `feat(sp3): AuthProvider (context sessione: user/plan/refresh da /api/auth)`

---

### Task 4: `SignupSheet` (email/password + consenso)

**Files:**
- Create: `features/onboarding/SignupSheet.tsx`
- Test: `features/onboarding/SignupSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Button` (`@/components/ui`); `useAuth` (per `refresh`).
- Produces: `SignupSheet({ open, onClose, onLogin }: { open: boolean; onClose: () => void; onLogin?: () => void })`. Campi: email, password, nome (opz.), **checkbox +18 (obbligatoria)**, **checkbox ToS+Privacy con link /terms /privacy (obbligatoria)**, checkbox marketing (opz.). Submit disabilitato finché email+password+age+tos. POST `/api/auth {action:"register", identifier, password, name, language, age_confirmed, tos_accepted, marketing_opt_in}`; su ok → `refresh()` + `onClose()`; su 400 `consent_required`/errore → messaggio inline. Link "Hai già un account? Accedi" → `onLogin()`.

- [ ] **Step 1: Test** — render aperto: mostra i campi + le 2 checkbox obbligatorie; submit disabilitato senza consenso; con tutto compilato, click → chiama `fetch` con `action:"register"` e i flag `age_confirmed:true, tos_accepted:true`; su risposta ok chiama onClose. (mock fetch + `useAuth`).
- [ ] **Step 2-4: RED → implementare → GREEN.**
- [ ] **Step 5: Commit** `feat(sp3): SignupSheet email/password + gate +18/ToS`

---

### Task 5: `LoginSheet`

**Files:**
- Create: `features/onboarding/LoginSheet.tsx`
- Test: `features/onboarding/LoginSheet.test.tsx`

**Interfaces:**
- Produces: `LoginSheet({ open, onClose, onSignup }: {...})`. Campi email+password; POST `/api/auth {action:"login", identifier, password}`; ok → `refresh()`+`onClose()`; errore → inline. Link "forgot password" → `/reset-password`. Link "Crea account" → `onSignup()`.

- [ ] **Step 1-5:** test (submit → login fetch, ok→onClose) → RED → implementare → GREEN → commit `feat(sp3): LoginSheet email/password`.

---

### Task 6: `PaywallProvider` + `UpgradeSheet`

Paywall contestuale che instrada al checkout esistente.

**Files:**
- Create: `features/onboarding/PaywallProvider.tsx`
- Create: `features/onboarding/UpgradeSheet.tsx`
- Test: `features/onboarding/PaywallProvider.test.tsx`, `features/onboarding/UpgradeSheet.test.tsx`

**Interfaces:**
- Produces:
  - `usePaywall(): { openUpgrade: (reason?: string) => void }` + `PaywallProvider({ children })` che monta l'`UpgradeSheet` e gestisce open/close.
  - `UpgradeSheet({ open, onClose, reason })`: mostra valore ("Sblocca tutti i pick / big match / mercati soft") + 2 piani (**Base $14.99/mo**, **Pro $29.99/mo**, prezzi da `@/lib/commercial-plan` — importare, non hardcodare) + CTA che **instrada al checkout esistente**. Poiché il checkout vive nel monolite, in SP3 la CTA naviga alla pagina piani/checkout esistente (es. `/app` con query `?upgrade=1`/tab plans) — **shortcut marcato**: reindirizza al flusso legacy finché SP7 non porta il checkout in `features/`. Nessun pagamento gestito qui.

> **Nota shortcut (marcata):** UpgradeSheet non processa pagamenti; instrada al checkout legacy. Upgrade path: checkout casual in `features/` in SP7. FTC: copy senza promesse di vincita.

- [ ] **Step 1: Test** — `usePaywall().openUpgrade()` monta un dialog; UpgradeSheet mostra i prezzi reali (import da commercial-plan) e la CTA punta al flusso checkout esistente; copy senza claim di rendimento.
- [ ] **Step 2-4: RED → implementare → GREEN.**
- [ ] **Step 5: Commit** `feat(sp3): PaywallProvider + UpgradeSheet (upsell contestuale → checkout esistente)`

---

### Task 7: Cablaggio nel feed + verifica end-to-end (Fase A)

Aggancia signup/login/upgrade al feed, senza toccare il monolite.

**Files:**
- Modify: `features/feed/FeedScreen.tsx` (wrappa in `AuthProvider`+`PaywallProvider`; entry "Accedi/Crea account"; passa un handler ai "Prova Pro")
- Modify: `features/feed/PickCard.tsx` (il bottone "Prova Pro" della card locked chiama `usePaywall().openUpgrade` invece di essere inerte)
- Modify: `features/feed/PickCardExpanded.tsx` (il "Prova Pro" del gruppo soft chiama `openUpgrade`)
- Test: estendere `FeedScreen.test.tsx`

**Interfaces:**
- `FeedScreen` è avvolto da `AuthProvider` + `PaywallProvider`. Header: se anonimo → bottone "Accedi" (apre LoginSheet) + "Crea account" (SignupSheet); se loggato → nome/plan. I "Prova Pro" (card locked + soft) chiamano `openUpgrade`.

- [ ] **Step 1: Test** — anonimo: click "Crea account" → dialog SignupSheet appare; click "Prova Pro" su card locked → dialog UpgradeSheet appare. (mock use-picks + fetch).
- [ ] **Step 2-3: RED → implementare** (provider wrapping + wiring dei bottoni).
- [ ] **Step 4: Verifica** — `npm test && npx tsc --noEmit && npm run build` verdi.
- [ ] **Step 5: Visual check (da loggato E anonimo)** — `/oggi`: anonimo apre Signup/Login/Upgrade; registrazione senza +18/ToS bloccata; loggato mostra stato piano. **Il flusso di pagamento reale va confermato da Andrea loggato.**
- [ ] **Step 6: Commit** `feat(sp3): cabla signup/login/upgrade nel feed (Prova Pro → paywall)`

---

## FASE B — OAuth Google/Apple (gated su prerequisiti esterni)

> **Non eseguibile finché non esistono le credenziali provider.** Richiede una review di sicurezza dedicata prima del merge. Il piano TDD dettagliato di questi task si finalizza quando i prerequisiti sono soddisfatti — di seguito scope, prerequisiti e vincoli.

### Prerequisiti Fase B (li fornisce Andrea — NON automatizzabili)
- **Google:** creare OAuth 2.0 Client (Google Cloud Console), redirect URI `https://<dominio>/api/auth/oauth/google/callback`, e mettere in env `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
- **Apple:** Apple Developer account → "Sign in with Apple" (Service ID, Key ID, private key .p8, Team ID) per generare il **client-secret JWT** (ES256), redirect URI dedicato. In env: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.

### Scope task (Fase B)
- **B1 — Google OAuth:** route `GET /api/auth/oauth/google` (start: genera `state`+PKCE, cookie di stato, redirect a Google) + `GET /api/auth/oauth/google/callback` (verifica `state`, scambia code→token con PKCE, legge email verificata, **upsert `profiles`** con plan `'free'` + consenso: mostrare/registrare +18/ToS al primo accesso OAuth, poi `issueSession` (riusa `signSession`/`issueSession` di `app/api/auth/route.ts`)). Bottone "Continua con Google" in Signup/Login sheet.
- **B2 — Apple OAuth:** analogo, con client-secret JWT ES256 e gestione del `form_post` response mode + del nome fornito solo al primo consenso.

### Vincoli di sicurezza (Fase B)
- CSRF: `state` random legato a cookie httpOnly; PKCE su Google. Validazione stretta del redirect URI. Fidarsi solo di email **verificata** dal provider. Nessun token provider persistito oltre il necessario. **+18/ToS**: anche via OAuth il consenso va raccolto e persistito (stesse colonne del Task 1) prima di creare l'account.
- **Review sicurezza obbligatoria** (security-review / cso) prima del merge di B.

---

## Self-Review (Fase A)

- **Copertura spec §5 (primo giorno):** signup frictionless = Task 4; login = Task 5; +18/ToS (ora anche server) = Task 1+2; upgrade contestuale = Task 6; cablaggio value-first nel feed = Task 7. OAuth (frictionless social) = Fase B. ✔
- **Decisioni approvate:** email/password (Task 4-5) + OAuth (Fase B); UpgradeSheet→checkout esistente (Task 6, shortcut marcato); generosità free NON toccata (nessun edit a `showcaseAllowance`). ✔
- **Compliance:** gap +18/ToS chiuso lato server (Task 2) + persistenza (Task 1) → review legale-compliance prima del deploy. ✔
- **Placeholder:** Task 1-3 hanno codice/contratti concreti; Task 4-7 danno interfacce + contratto di test puntuale (i componenti seguono il pattern Sheet/primitive già consolidato in SP1/SP2). Se un implementer trova ambiguità, si ferma e chiede.
- **Tipi/endpoint reali:** `/api/auth` actions, `profiles`, `am_session`, prezzi da `commercial-plan`, `showcaseAllowance` invariato. ✔

## Rischi / questioni aperte
1. **Compliance +18/ToS** (Task 1-2): cambio DB + auth → APPROVE + review legale-compliance prima del deploy.
2. **OAuth (Fase B)**: prerequisiti esterni (Andrea) + review sicurezza; Apple è il pezzo più complesso. Non blocca la Fase A.
3. **UpgradeSheet→legacy checkout**: shortcut finché SP7 non porta il checkout in `features/`.
4. **Generosità free**: invariata per decisione; se in futuro si loosen, è 1 riga in `showcaseAllowance` (decisione Andrea/Michele).

## Prossimo passo
Gate: SP3 tocca auth + DB + denaro = medium/high → **APPROVE SP3 (Fase A)** prima di eseguire. La Fase B parte solo dopo i prerequisiti provider + review sicurezza.
