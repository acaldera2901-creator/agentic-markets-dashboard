# CRM Lifecycle Email Flows — Fase 1 — Design Spec

**Data:** 2026-06-28
**Branch:** `feat/crm-lifecycle-emails`
**Owner:** Andrea (+ Michele) — BetRedge
**Fonte:** `BetRedge_CRM_Lifecycle_Flows_v2_full` (doc CRM) + decisioni 2026-06-28
**Stato:** design, in review

> ⚠️ **Gate.** Medium/high-risk: invia **email a utenti reali** + cron schedulato. Spec/piano non eseguiti in prod (cron attivo, primo invio reale) senza `APPROVE #id`. Costruito ≠ Verificato ≠ Operativo.

---

## 1. Obiettivo e scope

Implementare i **flussi lifecycle via EMAIL** del CRM doc, sui piani **attuali** (Free/Base/Premium), riusando i Segmenti già live e il path email esistente.

**Decisioni 2026-06-28 (Andrea):**
- Piani: adottare Free/Plus/VIP → **fase prodotto separata** (non in questo spec). Qui si lavora sui piani attuali; il mapping concettuale è Plus≈Base/Premium, VIP futuro.
- Prezzi: **invariati** (annuale 169 / pro 419 restano live).
- Sconti: **−30% annuale pubblico resta**. Gli sconti privati CRM del doc (Day14 −20%, Day21 −30%) sono **email-only, privati** (link/codice non pubblicati) — coerente col doc.
- Canale: il doc vuole **Telegram primario, email come record ufficiale**. **Fase 1 = solo EMAIL** (record ufficiale). I nudge Telegram + Wheel of Fortune + lead scoring + tier VIP = **fasi successive** (vedi §7).

**In scope (Fase 1):** motore trigger email + i 4 flussi lifecycle (onboarding, acquisition, retention, win-back) con i touchpoint **email-appropriati** del doc, one-flow-at-a-time, dedup, opt-out.

**Out of scope (Fase 1):** Telegram nudges, Wheel of Fortune, lead scoring engine, tier VIP + report email, retiering Free/Plus/VIP, dashboard "2 vs 18 pick / blurred", streak badges, abandoned-checkout Telegram.

---

## 2. Stato attuale (riuso)

- **Segmenti live**: tabella `segments` + mini-DSL (`lib/segments.ts`) + sync Resend. I 4 stati CRM si esprimono come segmenti/predicati su `profiles`.
- **Email**: `lib/email.ts` (template + shell BetRedge) + `lib/notify.ts` `sendTransactional` (invia + registra in `notifications`). Esistono già: welcome, renewal_reminder, winback, plan_activated, receipt, ecc.
- **Cron** giornaliero `/api/cron/subscriptions` (06:00) fa già downgrade scaduti + winback + renewal_reminder. **Questo cron è il punto naturale dove agganciare i trigger** (o un nuovo `/api/cron/crm`).
- **profiles**: `plan (free|pending_payment|base|premium|admin_full)`, `created_at`, `activated_at`, `plan_expires_at`, `language`. `paygate_orders` per gli ordini.
- ⚠️ **Trappola DB nota** (`reference_exec_sql_returning`): niente `RETURNING` via dbQuery/dbExecute.

---

## 3. Stati lifecycle (one-flow-at-a-time)

Determinati da `plan` + date (regola del doc: pagamento = switch ad acquisition→retention; scadenza = retention→win-back):

| Flow | Condizione (profiles) |
|------|------------------------|
| **0 Onboarding** | `activated_at IS NULL` (registrato, non attivato) |
| **1 Acquisition** | `plan='free' AND activated_at IS NOT NULL` |
| **2 Retention** | `plan IN ('base','premium') AND plan_expires_at > NOW()` |
| **3 Win-back** | era pagante e `plan_expires_at` scaduto da ≤ 30 giorni (oppure `plan='free'` con storico di pagamento entro 30gg) |
| (oltre 30gg scaduto) | rientra in Acquisition (cold) |

**Un utente è in UN solo flow.** Il "giorno nel flow" si calcola da un'ancora: onboarding/acquisition da `created_at` (o `activated_at`); retention da inizio pass (`plan_expires_at − durata`); win-back da `plan_expires_at`.

> Nota: serve sapere "da quando" un free è attivato per il calendario acquisition → ancora = `activated_at` (o `created_at` se assente).

## 4. Modello dati

```sql
-- Definizione dei trigger (editabili) — uno per touchpoint email del doc.
CREATE TABLE IF NOT EXISTS crm_email_triggers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,                 -- es. 'acq_day7_offer'
  flow        TEXT NOT NULL CHECK (flow IN ('onboarding','acquisition','retention','winback')),
  day_in_flow INTEGER NOT NULL,                     -- giorno relativo all'ancora del flow
  subject_it  TEXT NOT NULL, subject_en TEXT NOT NULL,
  body_it     TEXT NOT NULL, body_en  TEXT NOT NULL, -- resi nello shell() di lib/email
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedup: un trigger non parte 2× per lo stesso utente.
CREATE TABLE IF NOT EXISTS crm_trigger_sends (
  trigger_key TEXT NOT NULL,
  identifier  TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trigger_key, identifier)
);

-- Opt-out marketing (mirror locale; il doc richiede coerenza un-flow-alla-volta).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
```
Tutte additive/idempotenti, RLS-deny sulle nuove tabelle, rollback in coda.

## 5. Motore (cron giornaliero)

`GET /api/cron/crm` (cron-secret gated), 1×/giorno:
1. Carica i trigger `active`.
2. Per ogni profilo idoneo (escludi `admin_full`, `marketing_opt_out`, non-clienti dove serve consenso): calcola **flow corrente** + **day-in-flow**.
3. Per ogni trigger del flow con `day_in_flow == day` (o "≤ day e non ancora inviato", per non saltare invii se il cron salta un giorno): se non in `crm_trigger_sends` → invia via `sendTransactional` (registra in `notifications`) → scrive `crm_trigger_sends`.
4. **One-flow-at-a-time**: i trigger di un flow partono solo se il profilo è in quel flow ORA (un pagante non riceve acquisition).
5. Idempotenza: PK `(trigger_key, identifier)`.

**Anti-duplicazione coi lifecycle esistenti:** `renewal_reminder`/`winback` del cron `subscriptions` vengono **assorbiti** in questo motore (retention Day23/27/29, winback +1/+7/+14/+21) per evitare doppioni → rimuovo gli invii duplicati dal cron subscriptions lasciando lì solo il downgrade.

## 6. Touchpoint EMAIL Fase 1 (sottoinsieme email del doc)

(I nudge Telegram-only del doc NON sono qui.)
- **Onboarding:** `onb_activation` (se non attivato dopo 1–2gg) → invito ad attivare; welcome (già esiste al primo login).
- **Acquisition (free attivato):** `acq_day7_offer` (anchor 19.90), `acq_day14_welcome_offer` (−20% privato 72h), `acq_day21_last_chance` (−30% privato 48h, angolo diverso), `acq_day28_final` (−30% + VIP trial 3gg).
- **Retention (pagante):** `ret_day23_recap`, `ret_day27_renewal` (link pagamento PayGate), `ret_day29_final_bonus` (bonus, non sconto).
- **Win-back (scaduto ≤30gg):** `wb_day1_expired`, `wb_day7_renew`, `wb_day14_offer` (privato, mai meglio dell'acquisition), `wb_day21_final`.

Copy bilingue (it/en) nei record `crm_email_triggers`, tono del doc (mai "guaranteed/safe bet"; usare "high confidence/strong edge"). Gli sconti privati = link/codice CRM non pubblicato.

## 7. Fasi successive (roadmap, non in Fase 1)
Telegram nudges (canale primario doc) · Wheel of Fortune (prob. per segmento) · lead scoring comportamentale (eventi → cold/warm/hot) · tier **VIP** + report email + early-access sport · retiering Free/Plus/VIP + prezzi 89/159 · dashboard free "2 vs 18 + blurred" · streak badge/bonus rinnovo · abandoned-checkout recovery.

## 8. Verifica (Goal-Driven)
- Unit: calcolo flow+day-in-flow (funzione pura) per casi onboarding/acquisition/retention/winback + boundary 30gg; selezione trigger dovuti; one-flow-at-a-time; dedup.
- Integrazione/gated: cron in dry-run (log chi riceverebbe cosa, **senza inviare**) su dati reali → review → poi invio reale.
- Nessun doppione con gli invii esistenti.

## 9. Rischi
- Email a utenti reali → dry-run obbligatorio prima del primo invio reale; opt-out rispettato; one-flow-at-a-time previene messaggi in conflitto.
- Consenso/GDPR marketing (come Segmenti) → gli sconti/offerte sono marketing: vale la nota soft opt-in (`legale-compliance`) prima dell'invio reale.
- DB additivo, RLS-deny, rollback.
- Assorbimento winback/renewal dal cron subscriptions → evitare doppioni (test).

## 10. Env
Riusa `RESEND_API_KEY`/`RESEND_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`. Nuova voce cron in `vercel.json` (`/api/cron/crm`).
