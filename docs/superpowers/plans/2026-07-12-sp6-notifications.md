# SP6 — Rituale / Notifiche · Implementation Plan (da eseguire DOPO il go-live)

> Pianificato ma **non eseguito** (decisione Andrea 2026-07-12: SP6 dopo il go-live). Fase B richiede prerequisiti infra esterni.

**Goal:** Il rituale quotidiano — l'utente riceve "il pick di oggi è pronto" e torna. Due parti: **(A) PWA** (app installabile, buildable subito) e **(B) Web Push** (la notifica vera, gated su infra).

**Architecture:** Strangler, dietro flag. PWA = manifest + service worker + install prompt. Push = VAPID + SW push handler + storage subscription (nuova tabella) + endpoint subscribe + trigger giornaliero (aggancio al daemon predizioni esistente).

## Fasi
- **Fase A — PWA (buildable subito, zero dipendenze esterne):** manifest, icone, service worker (shell offline), UI "Installa l'app".
- **Fase B — Web Push (GATED su infra):** prerequisiti che fornisce Andrea — chiavi **VAPID** (`web-push generate-vapid-keys` → env `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`), decisione trigger. + **review sicurezza/privacy** (consenso notifiche) prima del merge.

## Global Constraints
- Prerequisito: integrazione new-UX su main + go-live deciso. Branch `feat/sp6-notifications` da main.
- Verificare prima: esiste già un `manifest`/service worker? (`ls public/manifest*.json`, `app/manifest.ts`, `public/sw.js`). Next 16: preferire `app/manifest.ts` + un SW registrato client-side.
- FTC/privacy: opt-in esplicito per le notifiche (permesso browser); nessun push senza consenso; una notifica/giorno max (anti-spam); disclaimer gioco responsabile.
- Zero AI-slop, token `--am-coral*`, TDD.

---

## FASE A — PWA (buildable)

### Task A1: Manifest + icone
- `app/manifest.ts` (Next 16 metadata route) → name "BetRedge", short_name, theme_color `#0B0C0E`, background, display `standalone`, start_url `/oggi`, icone (192/512 dal logo esistente). Verifica: `/manifest.webmanifest` servito, Lighthouse PWA installable.

### Task A2: Service worker (shell offline)
- SW minimale (`public/sw.js`) registrato da un client component: cache-first per lo shell statico, network-first per `/api/*`. Registrazione dietro flag. Test: registrazione ok, offline mostra shell.

### Task A3: UI "Installa l'app"
- Componente `features/pwa/InstallPrompt.tsx`: intercetta `beforeinstallprompt`, mostra un CTA discreto ("Aggiungi BetRedge alla home") nel Profilo o come banner dismissibile. Test su fixture dell'evento.

---

## FASE B — Web Push (gated su prerequisiti Andrea)

### Prerequisiti (li fornisce Andrea)
- Chiavi VAPID in env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- Libreria `web-push` (dipendenza).
- Decisione sul **trigger**: chi/quando invia "il pick di oggi è pronto" (aggancio al daemon predizioni `com.agentic-markets.agents` / un cron dedicato all'ora dei pick).

### Task B1: Migration `push_subscriptions`
- Tabella `push_subscriptions` (identifier FK profiles, endpoint, keys p256dh/auth, created_at, unique(endpoint)). Come da migrazioni esistenti; **cambio DB → gate + APPROVE**, applicare via MCP additivo (come consenso SP3).

### Task B2: Endpoint subscribe/unsubscribe + opt-in UI
- `POST /api/push/subscribe` (salva la subscription del device per l'utente loggato), `POST /api/push/unsubscribe`. Opt-in UI nel Profilo/feed: "Ricevi il pick del giorno" → richiede `Notification.permission` + `pushManager.subscribe(VAPID_PUBLIC_KEY)` → POST subscribe. Consenso esplicito.

### Task B3: SW push handler
- Nel service worker: `push` event → `showNotification("Il pick di oggi è pronto", {...})`; `notificationclick` → apre `/oggi`.

### Task B4: Invio (trigger giornaliero)
- Endpoint/funzione `sendDailyPickNotification()` (server) che itera le subscription e invia via `web-push` con la chiave privata. Agganciato al trigger deciso (cron all'ora dei pick). Max 1/giorno per utente. Gestione subscription scadute (410 → cleanup).

### Sicurezza/privacy (Fase B)
- Solo utenti loggati + opt-in esplicito. Chiave privata VAPID mai lato client. Rispetto revoca permesso. **Review sicurezza/privacy prima del merge.**

---

## Self-Review
- Copertura spec §5 "Il ritorno" (notifica push rituale) = Fase B; PWA installabile = Fase A. ✔
- Fase A eseguibile subito; Fase B gated su VAPID + review — non blocca il go-live (SP6 è post-go-live per decisione Andrea).

## Prossimo passo
Post-go-live: eseguire Fase A (subagent-driven); Fase B dopo che Andrea fornisce VAPID + trigger + review privacy.
