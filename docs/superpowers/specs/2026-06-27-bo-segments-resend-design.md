# Segmenti BO + Resend + Trigger — Design Spec

**Data:** 2026-06-27
**Branch:** `feat/bo-segments-resend`
**Owner:** Andrea (+ Michele) — profilo aziendale Agentic Markets / BetRedge
**Stato:** approvato il design, spec in review

> ⚠️ **Gate di approvazione.** Questo è lavoro medium/high-risk (DB + invio email a utenti reali + GDPR marketing). Lo spec e il piano **non vengono eseguiti** (nessuna migration, nessun deploy, nessun sync reale) finché non c'è `APPROVE #id` umano. Costruito ≠ Verificato ≠ Operativo.

---

## 1. Obiettivo

Tre task ricevute per BetRedge:

1. **Create segments in BO** — definire e gestire segmenti di utenti dal backoffice.
2. **Connect segments to Resend** — sincronizzare quei segmenti su Resend (motore di invio marketing).
3. **Triggers in BO to use in Resend** — automazioni event-based che inviano email (Resend non ha trigger nativi).

**Decisioni prese (brainstorming 2026-06-27):**

| Tema | Decisione |
|------|-----------|
| Architettura invio | **Resend come motore.** Il BO definisce i segmenti e sincronizza contatti/proprietà/appartenenza; i Broadcast si compongono nella dashboard Resend (unsubscribe e compliance gestiti da Resend). |
| Trigger | **Inviano email diretta** (automazione vera, lato BO). Gestire il rischio duplicati con le lifecycle email esistenti. |
| Consenso | **Soft opt-in clienti**, unsubscribe sempre attivo (Resend). Da validare con `legale-compliance` prima del primo sync reale. |
| Scope/consegna | **MVP a fasi.** Fase 1 = segmenti + sync. Fase 2 = trigger. |

---

## 2. Stato attuale (contesto verificato)

- **Repo / app:** `~/Desktop/agentic-markets` (Next.js App Router, repo `agentic-markets-dashboard`).
- **BO:** `app/admin/page.tsx` (operator dashboard, ~780 righe) + `app/api/admin/*`. Auth via `isAdminAuthorized` (`lib/admin-auth`, `ADMIN_SECRET` / `bo_admins`).
- **Resend:** integrato **solo transazionale** — `lib/email.ts` chiama `POST /emails` via REST (no SDK). `lib/notify.ts` (`sendTransactional`) invia e registra ogni tentativo nella tabella `notifications`. **Audiences / Contacts / Segments / Broadcasts non ancora usati.**
- **Lifecycle email già attive** (da NON duplicare nei trigger): `activation`, `welcome`, `otp`, `password_reset`, `payment_received`, `plan_activated`, `receipt`, `winback`, `renewal_reminder`. Le ultime due partono dal cron giornaliero `/api/cron/subscriptions` (06:00 UTC).
- **Tabella `profiles`** (chiave per i segmenti):
  `id, identifier (email, lowercase), name, plan (free|pending_payment|base|premium|admin_full), requested_plan (base|premium|null), tx_hash, language, timezone, created_at, updated_at, plan_expires_at, stripe_customer_id, stripe_subscription_id, activated_at, password_hash, activation_token_*`.
  - ⚠️ **Nessuna colonna `country`** sul profilo (il paese vive in `events`, per-evento). → la segmentazione per paese **non è in scope Fase 1** (richiederebbe derivazione da `events`).
  - ⚠️ **Nessun flag consenso/unsubscribe** sul profilo oggi.
- **Crons (`vercel.json`):** `/api/predictions/refresh` (2h), `/api/cron/settle` (30m), `/api/cron/subscriptions` (giornaliero 06:00).

### Resend — capacità reali (verificate 2026-06-27)

- **Audiences** = contenitori di contatti. **Contacts** = entità globali per email, con **campi custom (`properties`)**, appartenenza a **Segments** e **Topics**.
- **Segments** nativi = gruppi di contatti, targettabili dai **Broadcasts**. Un contatto può stare in 0..N segmenti.
- **Broadcasts** = invio marketing (manuale/schedulato dalla dashboard), unsubscribe gestito automaticamente da Resend.
- **NESSUN motore di trigger/automazioni** event-based → i trigger vanno costruiti lato nostro.
- API contatti: `POST /contacts` accetta `email`, `firstName`, `lastName`, `unsubscribed`, **`properties` (map custom)**, e array **`segments`/`topics`**.
- ⚠️ **Da verificare in implementazione:** se esiste un endpoint create-segment via API o se i segmenti si materializzano via `properties`/array `segments` sul contatto. Il design è robusto in **entrambi** i casi (vedi §3.3, fallback su properties).

---

## 3. Fase 1 — Segmenti nel BO + Sync su Resend

### 3.1 Modello dati — tabella `segments`

```sql
CREATE TABLE IF NOT EXISTS segments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT NOT NULL UNIQUE,         -- slug stabile, usato come nome segmento/proprietà su Resend
  name           TEXT NOT NULL,                -- etichetta leggibile (BO)
  description    TEXT,
  rule           JSONB NOT NULL,               -- mini-DSL filtro (vedi §3.2)
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  resend_segment TEXT,                         -- id/nome del segmento lato Resend (nullable finché non sincronizzato)
  last_count     INTEGER,                      -- n. profili match all'ultimo sync
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- Migration additiva e idempotente (`IF NOT EXISTS`), con blocco rollback in coda come da convenzione repo.
- RLS: tabella operator-only (accesso solo via service role nelle route admin), coerente con le altre tabelle BO. Nessun accesso client.

### 3.2 Rule — mini-DSL filtro (trust boundary)

La regola è JSON con un solo nodo logico `all` (AND) in Fase 1 (YAGNI: niente OR/nesting finché non serve davvero):

```json
{ "all": [
  {"field":"plan","op":"in","value":["base","premium"]},
  {"field":"language","op":"eq","value":"it"},
  {"field":"plan_expires_at","op":"expiring_in_days","value":7}
] }
```

**Campi e operatori whitelistati** (qualsiasi cosa fuori da questa lista → validazione fallisce, 400):

| field | op ammessi | value |
|-------|-----------|-------|
| `plan` | `eq`, `in` | uno/più di `free,pending_payment,base,premium` |
| `language` | `eq`, `in` | es. `it`, `en` |
| `requested_plan` | `eq`, `in`, `is_null` | `base,premium` |
| `activated` | `eq` | `true` / `false` (mappa su `activated_at IS [NOT] NULL`) |
| `created_within_days` | `lte`, `gte` | intero (giorni da `created_at`) |
| `plan_expires_at` | `expired`, `active`, `expiring_in_days` | (no value / no value / intero) |

**Compilazione → SQL parametrico.** Una funzione `compileSegmentRule(rule)` (in `lib/segments.ts`) valida ogni clausola contro la whitelist e produce `{ whereSql, params }` **solo con placeholder `$n`** — nessuna interpolazione di valori/identificatori non whitelistati. Input non valido → throw (la route ritorna 400). Questo è il confine di fiducia: **mai SQL raw dall'input dell'operatore.**

Un **self-test minimo** (vedi §6) verifica: (a) regola valida → SQL atteso + match count; (b) campo/op non whitelistato → throw.

### 3.3 Sync engine

**Endpoint:** `POST /api/admin/segments/[id]/sync` (auth `isAdminAuthorized`).

1. **Audience unica.** `RESEND_AUDIENCE_ID` da env (l'audience "BetRedge users" si crea una volta a mano o via script di bootstrap). Se l'env manca → 500 esplicito, nessun invio.
2. **Calcola i match** del segmento (`compileSegmentRule` → query su `profiles`), filtrati per **idoneità consenso** (vedi §3.4).
3. Per ogni profilo idoneo: `POST /contacts` (upsert) all'audience con:
   - `email`, `firstName` (da `name`),
   - **`properties`**: snapshot attributi — `plan`, `language`, `lifecycle_stage` (derivato: `prospect|active|expiring|expired|churned`), `cohort_month` (da `created_at`), e un marcatore booleano `seg_<key>` per ogni segmento attivo che il profilo matcha,
   - **`segments`**: array delle `key` dei segmenti che il profilo matcha ora.
   - **`unsubscribed` NON impostato** nell'upsert → Resend preserva la scelta dell'utente (un re-sync non re-iscrive chi si è disiscritto).
4. **Materializzazione segmento lato Resend:** primario = array `segments` sul contatto; **fallback robusto** = le `properties.seg_<key>` consentono di costruire/aggiornare il segmento Resend per filtro-proprietà se l'API create-segment non fosse disponibile. (Punto di verifica in implementazione — vedi §2.)
5. Aggiorna `last_count`, `last_synced_at`, `resend_segment` sulla riga `segments`.
6. **Logging:** registra l'esito del sync (n. upsert ok/falliti) in `notifications` (type `sync`/`marketing`) per audit, coerente con il pattern esistente; fail-loud sul conteggio errori.

**Innesco del sync:**
- **Manuale:** pulsante "Sync su Resend" per segmento nel BO.
- **Automatico:** refresh giornaliero di tutti i segmenti `active` — esteso nel cron esistente `/api/cron/subscriptions` o nuovo `/api/cron/segments-sync`. (L'appartenenza cambia da sola: piani che scadono, nuovi signup, ecc.) Decisione cron-host nel piano implementativo.

**Idempotenza / rate:** upsert è idempotente. Sync in batch sequenziale con gestione errori per-contatto (un fallimento non blocca gli altri); rispetto di eventuali rate-limit Resend con retry/backoff minimale.

### 3.4 Consenso / GDPR (soft opt-in)

- **Idoneità Fase 1:** sincronizziamo i **clienti** — `plan IN (base, premium)` e i `free` **attivati** (`activated_at IS NOT NULL`). Esclusi: profili non attivati, `admin_full`, l'identità admin.
- **Unsubscribe:** gestito interamente da Resend (link automatico nei Broadcast). Il re-sync non lo sovrascrive (vedi §3.3.3).
- ⚠️ **GATE legale:** prima del **primo sync reale** in produzione, review di `legale-compliance` sulla base giuridica del soft opt-in marketing per i clienti esistenti (legittimo interesse vs opt-in esplicito) e sul testo informativa. Il filtro-consenso è un **parametro configurabile** (`MARKETING_ELIGIBILITY` o costante in `lib/segments.ts`) così da poter passare a opt-in esplicito senza riscrivere il sync.
- **Estensione futura (non Fase 1):** colonna `marketing_opt_out` su `profiles` come mirror locale, aggiornata da webhook Resend `contact.updated` — necessaria per i trigger di Fase 2 (vedi §4.3).

### 3.5 BO UI

Nuova sezione **"Marketing → Segmenti"** in `app/admin`:
- Lista segmenti: `name`, `last_count`, `last_synced_at`, stato `active`, badge sync.
- **Editor regola:** form per le clausole whitelistate (niente JSON a mano per l'operatore) con **conteggio match live** (`GET /api/admin/segments/[id]/count` o preview su regola non salvata).
- Pulsante **"Sync su Resend"** per segmento + stato/esito ultimo sync.
- Coerente con lo stile esistente del BO (no nuove librerie UI; match dei pattern in `app/admin/page.tsx`).

### 3.6 API Fase 1 (riassunto)

| Metodo / path | Scopo |
|---|---|
| `GET /api/admin/segments` | lista segmenti |
| `POST /api/admin/segments` | crea segmento (valida rule) |
| `PATCH /api/admin/segments/[id]` | modifica (valida rule) |
| `DELETE /api/admin/segments/[id]` | elimina |
| `POST /api/admin/segments/[id]/count` | preview conteggio match (anche su rule non salvata) |
| `POST /api/admin/segments/[id]/sync` | sync verso Resend |

Tutte sotto `isAdminAuthorized`. Logica condivisa in `lib/segments.ts` (compile + match + eligibility) e `lib/resend-contacts.ts` (upsert contatto/sync — affianca `lib/email.ts`, stesso stile REST senza SDK).

---

## 4. Fase 2 — Trigger nel BO (invio email diretta)

> Fase 2 è progettata qui per coerenza ma **implementata dopo** la verifica reale della Fase 1.

### 4.1 Modello dati

```sql
CREATE TABLE IF NOT EXISTS email_triggers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  event       TEXT NOT NULL,        -- 'signup_no_upgrade' | 'inactive' | 'segment_enter' (whitelist)
  condition   JSONB NOT NULL,       -- es. {"days": 3} oppure {"segment_key": "..."}
  subject_it  TEXT NOT NULL, subject_en TEXT NOT NULL,
  body_it     TEXT NOT NULL, body_en  TEXT NOT NULL,   -- editabili in BO, resi nel shell() di lib/email.ts
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trigger_sends (   -- dedup: un trigger non parte 2× allo stesso utente
  trigger_id  UUID NOT NULL REFERENCES email_triggers(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trigger_id, profile_id)
);
```

### 4.2 Eventi (solo NUOVI, niente sovrapposizioni)

- `signup_no_upgrade` — N giorni dopo `created_at` se ancora `free`.
- `inactive` — nessuna attività da N giorni (da definire la sorgente attività; in scope solo se misurabile da `events`).
- `segment_enter` — il profilo è entrato in un dato segmento all'ultimo refresh.
- **Esclusi esplicitamente:** winback e renewal_reminder (già coperti dal cron `subscriptions`), e tutte le lifecycle transazionali esistenti.

### 4.3 Esecuzione e consenso

- Valutati da cron (riuso `/api/cron/subscriptions` o nuovo cron dedicato).
- Invio via un **path marketing** che:
  1. **rispetta l'opt-out** — controllo del mirror `marketing_opt_out` (popolato da webhook Resend `contact.updated`) **prima** di inviare;
  2. registra in `notifications` (audit) e in `trigger_sends` (dedup).
- Riuso di `sendEmail` + `shell()` di `lib/email.ts`; il corpo viene dal record `email_triggers` (editabile dall'operatore nel BO).
- **Webhook Resend** nuovo endpoint `POST /api/resend/webhook` per `contact.updated` (+ verifica firma) → aggiorna `marketing_opt_out`.

### 4.4 BO UI Fase 2

Tab **"Marketing → Trigger"**: lista/CRUD trigger, editor copy bilingue, toggle attivo, anteprima, contatore invii.

---

## 5. Componenti e confini (isolamento)

| Unità | Cosa fa | Dipende da |
|---|---|---|
| `lib/segments.ts` | compile rule→SQL parametrico, match profili, eligibility consenso | `lib/db`, whitelist |
| `lib/resend-contacts.ts` | upsert contatto + sync segmento su Resend (REST, no SDK) | `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` |
| `app/api/admin/segments/*` | CRUD + count + sync (auth) | `lib/segments`, `lib/resend-contacts`, `lib/admin-auth` |
| BO UI segmenti | gestione operatore | route sopra |
| *(Fase 2)* `lib/triggers.ts` + cron + webhook | valutazione eventi, invio marketing, opt-out | `lib/email`, `lib/notify`, `email_triggers` |

Ogni unità è testabile in isolamento; `lib/email.ts` esistente resta invariato (il marketing affianca, non riscrive).

---

## 6. Verifica (Goal-Driven)

**Fase 1 — criteri di successo verificabili:**
1. `compileSegmentRule`: test unit — regola valida produce SQL+params attesi; campo/op fuori whitelist → throw (no SQL).
2. Migration `segments` applicata su branch DB, idempotente (re-run safe), rollback testato.
3. Creazione segmento dal BO + conteggio match coerente con query manuale su `profiles`.
4. Sync verso **audience Resend di test**: i contatti idonei compaiono con `properties` e `segments` corretti; un contatto marcato `unsubscribed` su Resend **non** viene re-iscritto da un secondo sync.
5. Esclusione consenso: profili non attivati / admin **non** sincronizzati.
6. Visual check del BO da operatore loggato (no fiducia cieca).

**Fase 2:** trigger parte una sola volta per utente (dedup `trigger_sends`); opt-out rispettato; nessun overlap con winback/renewal; copy bilingue corretto.

> Nessuna feature dichiarata "operativa" senza questi check su dati reali.

---

## 7. Rischi / blast radius

- **Invio email a utenti reali** → mitigato: Fase 1 **non invia nulla** (solo sync contatti); l'invio resta manuale dalla dashboard Resend.
- **GDPR marketing** → gate `legale-compliance` prima del primo sync reale; eligibility configurabile; unsubscribe sempre attivo.
- **DB** → migration additiva/idempotente con rollback; nessuna modifica a tabelle esistenti in Fase 1 (la colonna `marketing_opt_out` arriva in Fase 2, anch'essa additiva).
- **Sicurezza** → rule compilata con whitelist + SQL parametrico; tutte le route sotto `isAdminAuthorized`.
- **Duplicati email** → trigger Fase 2 limitati a eventi nuovi + dedup `trigger_sends`.

## 8. Out of scope

- Editor di Broadcast nel BO (li compone Andrea/Michele nella dashboard Resend).
- Segmentazione per paese (manca colonna profilo).
- Logica OR/nested nelle rule (YAGNI finché non richiesto).
- Migrazione delle lifecycle email esistenti verso il path marketing.

---

## 9. Env nuove

- `RESEND_AUDIENCE_ID` — id dell'audience "BetRedge users" (Fase 1).
- *(Fase 2)* `RESEND_WEBHOOK_SECRET` — verifica firma webhook contatti.

(`RESEND_API_KEY`, `RESEND_FROM` già presenti.)
