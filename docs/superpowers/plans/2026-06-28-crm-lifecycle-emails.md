# CRM Lifecycle Email Flows — Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Motore CRM che, una volta al giorno, calcola per ogni utente il suo flow lifecycle (onboarding/acquisition/retention/win-back) e invia l'email del touchpoint dovuto — un solo flow alla volta, deduplicato, opt-out — sui piani attuali.

**Architecture:** Logica pura testabile (`lib/crm.ts`: resolveFlow + dueTriggers) + definizioni touchpoint con copy bilingue (`lib/crm-content.ts`) + cron `/api/cron/crm` che invia via `sendTransactional` e deduplica in `crm_trigger_sends`. Il cron `subscriptions` cede a questo motore gli invii winback/renewal (resta solo il downgrade, che ora MANTIENE `plan_expires_at` per abilitare il win-back).

**Tech Stack:** Next.js route handler, TypeScript, Supabase via `lib/db` (no `RETURNING`), `lib/email`/`lib/notify`, test `tsx`+`node:assert`.

## Global Constraints
- **Gate:** nessun invio reale in prod senza dry-run + APPROVE. Il cron parte in modalità dry-run finché non si conferma.
- **Trappola DB:** mai `RETURNING` via dbQuery/dbExecute (exec_sql lo scarta). Id generati in JS; per "ho già inviato" si usa la tabella dedup.
- **One-flow-at-a-time:** un utente riceve solo i trigger del flow in cui si trova ORA.
- **Esclusioni:** `admin_full`, `marketing_opt_out=true`, identifier senza `@`.
- **Idempotenza:** PK `(trigger_key, identifier)` in `crm_trigger_sends`.
- **No doppioni:** winback/renewal vengono rimossi dal cron `subscriptions` (li fa il motore CRM).
- **Copy:** bilingue it/en, tono doc (mai "guaranteed/safe bet"; usare "high confidence/strong edge"). Sconti privati = link CRM non pubblico.
- **Auth cron:** `verifyBearer(req, process.env.CRON_SECRET)`. **Test:** `npx tsx <file>`.

---

### Task 1: Migration — dedup + opt-out

**Files:**
- Create: `supabase/migrations/20260628120000_crm_lifecycle.sql`

- [ ] **Step 1: Scrivere la migration**
```sql
-- CRM lifecycle (#CRM-LIFECYCLE). Additiva + idempotente.
CREATE TABLE IF NOT EXISTS public.crm_trigger_sends (
  trigger_key TEXT NOT NULL,
  identifier  TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trigger_key, identifier)
);
ALTER TABLE public.crm_trigger_sends ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- Rollback:
-- DROP TABLE IF EXISTS public.crm_trigger_sends;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS marketing_opt_out;
```

- [ ] **Step 2: Verifica** — `grep -c "crm_trigger_sends" supabase/migrations/20260628120000_crm_lifecycle.sql` → `2`. (Apply su DB **gated**, Task 6.)
- [ ] **Step 3: Commit** — `git add ... && git commit -m "feat(crm): migration crm_trigger_sends + marketing_opt_out (#CRM-LIFECYCLE)"`

---

### Task 2: `lib/crm.ts` — resolveFlow + dueTriggers (TDD)

**Files:**
- Create: `lib/crm.ts`
- Test: `tests/crm.test.ts`

**Interfaces:**
- Produces:
  - `type CrmFlow = "onboarding" | "acquisition" | "retention" | "winback" | "none"`
  - `type CrmProfile = { identifier: string; plan: string; language: string | null; created_at: string; activated_at: string | null; plan_expires_at: string | null; marketing_opt_out?: boolean }`
  - `type Touchpoint = { key: string; flow: Exclude<CrmFlow,"none">; day: number }`
  - `resolveFlow(p: CrmProfile, nowISO: string): { flow: CrmFlow; dayInFlow: number }`
  - `dueTriggers(flow: CrmFlow, dayInFlow: number, touchpoints: Touchpoint[], alreadySent: Set<string>): Touchpoint[]`
  - `isEligible(p: CrmProfile): boolean`

- [ ] **Step 1: Scrivere i test che falliscono**
```ts
// tests/crm.test.ts
import assert from "node:assert/strict";
import { resolveFlow, dueTriggers, isEligible, type CrmProfile, type Touchpoint } from "../lib/crm";

const base: CrmProfile = { identifier: "a@b.com", plan: "free", language: "it", created_at: "2026-06-01T00:00:00Z", activated_at: "2026-06-01T00:00:00Z", plan_expires_at: null };
const NOW = "2026-06-15T00:00:00Z"; // 14 giorni dopo

// onboarding: non attivato
assert.deepEqual(resolveFlow({ ...base, activated_at: null }, NOW), { flow: "onboarding", dayInFlow: 14 });
// acquisition: free attivato, niente storico pagamento → giorni da activated_at
assert.deepEqual(resolveFlow(base, NOW), { flow: "acquisition", dayInFlow: 14 });
// retention: pagante non scaduto → dayInFlow = giorni ALLA scadenza
assert.deepEqual(resolveFlow({ ...base, plan: "premium", plan_expires_at: "2026-06-18T00:00:00Z" }, NOW), { flow: "retention", dayInFlow: 3 });
// winback: free con scadenza passata entro 30gg → giorni DALLA scadenza
assert.deepEqual(resolveFlow({ ...base, plan: "free", plan_expires_at: "2026-06-08T00:00:00Z" }, NOW), { flow: "winback", dayInFlow: 7 });
// scaduto da >30gg → torna acquisition
assert.equal(resolveFlow({ ...base, plan: "free", plan_expires_at: "2026-05-01T00:00:00Z" }, NOW).flow, "acquisition");
// admin escluso
assert.equal(resolveFlow({ ...base, plan: "admin_full" }, NOW).flow, "none");

// isEligible
assert.equal(isEligible(base), true);
assert.equal(isEligible({ ...base, plan: "admin_full" }), false);
assert.equal(isEligible({ ...base, marketing_opt_out: true }), false);
assert.equal(isEligible({ ...base, identifier: "telegram_123" }), false);

// dueTriggers: solo trigger del flow corrente, al giorno esatto, non già inviati
const tps: Touchpoint[] = [
  { key: "acq_day7", flow: "acquisition", day: 7 },
  { key: "acq_day14", flow: "acquisition", day: 14 },
  { key: "ret_3d", flow: "retention", day: 3 },
];
assert.deepEqual(dueTriggers("acquisition", 14, tps, new Set()).map(t => t.key), ["acq_day14"]);
assert.deepEqual(dueTriggers("acquisition", 14, tps, new Set(["acq_day14"])).map(t => t.key), []); // dedup
assert.deepEqual(dueTriggers("retention", 14, tps, new Set()).map(t => t.key), []); // giorno non combacia
assert.deepEqual(dueTriggers("retention", 3, tps, new Set()).map(t => t.key), ["ret_3d"]);

console.log("crm ok");
```

- [ ] **Step 2: Eseguire — `npx tsx tests/crm.test.ts` → FAIL (modulo assente).**

- [ ] **Step 3: Implementare `lib/crm.ts`**
```ts
// lib/crm.ts
// Logica lifecycle CRM (#CRM-LIFECYCLE) — PURA e testabile. Determina il flow di
// un profilo (uno solo alla volta) e i trigger dovuti oggi.

export type CrmFlow = "onboarding" | "acquisition" | "retention" | "winback" | "none";

export type CrmProfile = {
  identifier: string;
  plan: string;
  language: string | null;
  created_at: string;
  activated_at: string | null;
  plan_expires_at: string | null;
  marketing_opt_out?: boolean;
};

export type Touchpoint = { key: string; flow: Exclude<CrmFlow, "none">; day: number };

const DAY = 86_400_000;
const WINBACK_WINDOW_DAYS = 30;

function daysSince(fromISO: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(fromISO).getTime()) / DAY);
}
function daysUntil(toISO: string, nowMs: number): number {
  return Math.floor((new Date(toISO).getTime() - nowMs) / DAY);
}

export function isEligible(p: CrmProfile): boolean {
  if (p.plan === "admin_full") return false;
  if (p.marketing_opt_out) return false;
  if (!p.identifier.includes("@")) return false;
  return true;
}

export function resolveFlow(p: CrmProfile, nowISO: string): { flow: CrmFlow; dayInFlow: number } {
  const now = new Date(nowISO).getTime();
  if (p.plan === "admin_full") return { flow: "none", dayInFlow: 0 };

  // Retention: pagante non ancora scaduto. dayInFlow = giorni ALLA scadenza.
  if ((p.plan === "base" || p.plan === "premium") && p.plan_expires_at && new Date(p.plan_expires_at).getTime() > now) {
    return { flow: "retention", dayInFlow: Math.max(0, daysUntil(p.plan_expires_at, now)) };
  }

  // Onboarding: registrato ma non attivato. dayInFlow = giorni da created_at.
  if (!p.activated_at) {
    return { flow: "onboarding", dayInFlow: daysSince(p.created_at, now) };
  }

  // Win-back: ha una scadenza passata entro 30gg (ex-pagante). dayInFlow = giorni dalla scadenza.
  if (p.plan_expires_at) {
    const exp = new Date(p.plan_expires_at).getTime();
    if (exp <= now) {
      const since = daysSince(p.plan_expires_at, now);
      if (since <= WINBACK_WINDOW_DAYS) return { flow: "winback", dayInFlow: since };
    }
  }

  // Acquisition: free attivato (default). dayInFlow = giorni da activated_at.
  return { flow: "acquisition", dayInFlow: daysSince(p.activated_at, now) };
}

export function dueTriggers(
  flow: CrmFlow,
  dayInFlow: number,
  touchpoints: Touchpoint[],
  alreadySent: Set<string>
): Touchpoint[] {
  return touchpoints.filter((t) => t.flow === flow && t.day === dayInFlow && !alreadySent.has(t.key));
}
```

- [ ] **Step 4: Eseguire — `npx tsx tests/crm.test.ts` → PASS ("crm ok").**
- [ ] **Step 5: Commit** — `git add lib/crm.ts tests/crm.test.ts && git commit -m "feat(crm): logica flow+dueTriggers (#CRM-LIFECYCLE)"`

---

### Task 3: `lib/crm-content.ts` — touchpoint + copy bilingue

**Files:**
- Create: `lib/crm-content.ts`
- Test: `tests/crm-content.test.ts`

**Interfaces:**
- Consumes: `Touchpoint` da `lib/crm`; `shell` non esportato → riusa pattern email locale.
- Produces:
  - `CRM_TOUCHPOINTS: (Touchpoint & { subject: {it:string;en:string}; body: {it:string;en:string} })[]`
  - `renderCrm(key: string, lang: "it"|"en"): { subject: string; html: string; text: string } | null`

- [ ] **Step 1: Scrivere i test**
```ts
// tests/crm-content.test.ts
import assert from "node:assert/strict";
import { CRM_TOUCHPOINTS, renderCrm } from "../lib/crm-content";

// chiavi uniche
const keys = CRM_TOUCHPOINTS.map(t => t.key);
assert.equal(new Set(keys).size, keys.length);
// ogni flow coperto
const flows = new Set(CRM_TOUCHPOINTS.map(t => t.flow));
["onboarding","acquisition","retention","winback"].forEach(f => assert.ok(flows.has(f as never), `manca flow ${f}`));
// render
const r = renderCrm("acq_day7_offer", "it");
assert.ok(r && r.subject.length > 0 && r.html.includes("BetRedge") && r.text.length > 0);
assert.equal(renderCrm("inesistente", "it"), null);
// niente parole vietate
for (const t of CRM_TOUCHPOINTS) for (const lang of ["it","en"] as const)
  assert.doesNotMatch((t.subject[lang]+t.body[lang]).toLowerCase(), /guaranteed|safe bet|vincita sicura/);

console.log("crm content ok");
```

- [ ] **Step 2: Eseguire → FAIL.**

- [ ] **Step 3: Implementare `lib/crm-content.ts`** (copy concisa, tono doc; gli URL offerta usano un parametro CRM privato `?crm=<key>`)
```ts
// lib/crm-content.ts
// Touchpoint email del CRM (#CRM-LIFECYCLE). Copy bilingue, tono doc.
import type { Touchpoint } from "./crm";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://betredge.com").replace(/\/$/, "");

function shell(bodyHtml: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:440px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="font-size:13px;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">BetRedge</p>
  ${bodyHtml}
</div>`;
}
function cta(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:14px;padding:11px 20px;border-radius:8px;background:#23A559;color:#fff;text-decoration:none;font-size:14px;font-weight:600">${label}</a>`;
}

type CrmTouchpoint = Touchpoint & { subject: { it: string; en: string }; body: { it: string; en: string } };

// day: per onboarding/acquisition/winback = giorni dall'ancora; per retention = giorni ALLA scadenza.
export const CRM_TOUCHPOINTS: CrmTouchpoint[] = [
  { key: "onb_activate", flow: "onboarding", day: 2,
    subject: { it: "Attiva il tuo BetRedge", en: "Activate your BetRedge" },
    body: { it: "Sei a un passo: accedi e guarda il primo pronostico del modello. È gratis e ti mostra subito come ragiona.", en: "You're one step away: log in and see the model's first pick. It's free and shows how it reasons." } },
  { key: "acq_day7_offer", flow: "acquisition", day: 7,
    subject: { it: "Il tuo primo upgrade BetRedge", en: "Your first BetRedge upgrade" },
    body: { it: "Nel Free vedi 2 pick a settimana. Con Plus sblocchi l'intero board, edge e spiegazioni. Da 19,90 USD/mese.", en: "Free shows 2 picks/week. Plus unlocks the full board, edge and explanations. From $19.90/mo." } },
  { key: "acq_day14_welcome_offer", flow: "acquisition", day: 14,
    subject: { it: "Offerta benvenuto: −20% per 72h", en: "Welcome offer: −20% for 72h" },
    body: { it: "Solo per te, 72 ore: Plus a −20%. Probabilità calibrate e track record verificabile, tutto sbloccato.", en: "Just for you, 72 hours: Plus at −20%. Calibrated probabilities and verifiable track record, all unlocked." } },
  { key: "acq_day21_last_chance", flow: "acquisition", day: 21,
    subject: { it: "Ultima occasione — angolo nuovo", en: "Last chance — a fresh angle" },
    body: { it: "Non i soliti pronostici: una opinione sola, calibrata, misurata. Sblocca il board completo a −30% per 48h.", en: "Not the usual tips: one calibrated, measured opinion. Unlock the full board at −30% for 48h." } },
  { key: "acq_day28_final", flow: "acquisition", day: 28,
    subject: { it: "Offerta finale + 3 giorni VIP", en: "Final offer + 3-day VIP" },
    body: { it: "Ultima spinta: Plus a −30% con 3 giorni di prova VIP (analisi più profonda). Poi si torna a prezzo pieno.", en: "Final push: Plus at −30% with a 3-day VIP trial (deeper analysis). Then back to full price." } },
  { key: "ret_7d_before", flow: "retention", day: 7,
    subject: { it: "Il tuo accesso scade tra 7 giorni", en: "Your access expires in 7 days" },
    body: { it: "Riepilogo del mese e cosa stai per perdere. L'accesso non si rinnova da solo: paga di nuovo per continuare.", en: "Your monthly recap and what you'd lose. Access doesn't auto-renew: pay again to continue." } },
  { key: "ret_3d_before", flow: "retention", day: 3,
    subject: { it: "Rinnova: 3 giorni alla scadenza", en: "Renew: 3 days to expiry" },
    body: { it: "Continua da dove sei. Rinnovo rapido, nessuna interruzione del board.", en: "Continue where you left off. Quick renewal, no break in the board." } },
  { key: "ret_1d_before", flow: "retention", day: 1,
    subject: { it: "Ultimo promemoria + bonus fedeltà", en: "Final reminder + loyalty bonus" },
    body: { it: "Domani scade. Rinnova ora e mantieni la streak: bonus fedeltà (early access), non sconti.", en: "Expires tomorrow. Renew now and keep your streak: loyalty bonus (early access), not discounts." } },
  { key: "wb_day1_expired", flow: "winback", day: 1,
    subject: { it: "Il tuo accesso è scaduto", en: "Your access has expired" },
    body: { it: "Il tuo storico e i risultati sono salvati. Riattiva per riprendere da dove avevi lasciato.", en: "Your history and results are saved. Reactivate to pick up where you left off." } },
  { key: "wb_day7_renew", flow: "winback", day: 7,
    subject: { it: "Riprendi da dove eri", en: "Continue from where you stopped" },
    body: { it: "Il board continua a girare. Rientra quando vuoi: i tuoi dati ti aspettano.", en: "The board keeps running. Come back anytime: your data is waiting." } },
  { key: "wb_day14_offer", flow: "winback", day: 14,
    subject: { it: "Offerta di riattivazione privata", en: "Private reactivation offer" },
    body: { it: "Un'offerta riservata per tornare. Mai migliore degli sconti di ingresso — ma pensata per te.", en: "A private offer to return. Never better than joining offers — but made for you." } },
  { key: "wb_day21_final", flow: "winback", day: 21,
    subject: { it: "Ultimo promemoria", en: "Last reminder" },
    body: { it: "Ultimo richiamo prima di tornare al flusso Free. Riattiva per non perdere lo storico.", en: "Last call before returning to the Free flow. Reactivate to keep your history." } },
];

export function renderCrm(key: string, lang: "it" | "en"): { subject: string; html: string; text: string } | null {
  const t = CRM_TOUCHPOINTS.find((x) => x.key === key);
  if (!t) return null;
  const href = `${SITE}/app?tab=plans&crm=${encodeURIComponent(t.key)}`;
  const label = lang === "it" ? "Apri BetRedge" : "Open BetRedge";
  const body = t.body[lang];
  return {
    subject: t.subject[lang],
    html: shell(`<p style="font-size:14px;line-height:1.5;margin:0">${body}</p>${cta(label, href)}`),
    text: `${body}\n\n${label}: ${href}`,
  };
}
```

- [ ] **Step 4: Eseguire → PASS ("crm content ok").**
- [ ] **Step 5: Commit** — `git add lib/crm-content.ts tests/crm-content.test.ts && git commit -m "feat(crm): touchpoint email bilingue (#CRM-LIFECYCLE)"`

---

### Task 4: Cron `/api/cron/crm` (motore) + dry-run + vercel.json

**Files:**
- Create: `app/api/cron/crm/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `verifyBearer`; `dbQuery`/`dbExecute`; `resolveFlow`/`dueTriggers`/`isEligible`/`type CrmProfile` da `@/lib/crm`; `CRM_TOUCHPOINTS`/`renderCrm` da `@/lib/crm-content`; `sendTransactional` da `@/lib/notify`.

- [ ] **Step 1: Implementare la route**
```ts
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { resolveFlow, dueTriggers, isEligible, type CrmProfile } from "@/lib/crm";
import { CRM_TOUCHPOINTS, renderCrm } from "@/lib/crm-content";
import { sendTransactional } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Motore CRM giornaliero. Dry-run di default (logga, NON invia) finché non si
// passa ?send=1 (e l'env CRM_SEND_ENABLED="1"): doppio gate per il primo invio reale.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const live = url.searchParams.get("send") === "1" && process.env.CRM_SEND_ENABLED === "1";
  const nowISO = new Date().toISOString();

  const profiles = (await dbQuery<CrmProfile>(
    `SELECT identifier, plan, language, created_at::text, activated_at::text, plan_expires_at::text, marketing_opt_out
       FROM profiles`
  )) ?? [];

  // mappa identifier -> set di trigger già inviati
  const sentRows = (await dbQuery<{ trigger_key: string; identifier: string }>(
    "SELECT trigger_key, identifier FROM crm_trigger_sends"
  )) ?? [];
  const sentByUser = new Map<string, Set<string>>();
  for (const r of sentRows) {
    const s = sentByUser.get(r.identifier) ?? new Set<string>();
    s.add(r.trigger_key);
    sentByUser.set(r.identifier, s);
  }

  let planned = 0, sent = 0, failed = 0;
  const preview: { to: string; flow: string; key: string }[] = [];

  for (const p of profiles) {
    if (!isEligible(p)) continue;
    const { flow, dayInFlow } = resolveFlow(p, nowISO);
    if (flow === "none") continue;
    const due = dueTriggers(flow, dayInFlow, CRM_TOUCHPOINTS, sentByUser.get(p.identifier) ?? new Set());
    for (const t of due) {
      planned++;
      if (preview.length < 50) preview.push({ to: p.identifier, flow, key: t.key });
      if (!live) continue;
      const lang = p.language === "en" ? "en" : "it";
      const mail = renderCrm(t.key, lang);
      if (!mail) continue;
      const res = await sendTransactional({ type: "winback", to: p.identifier, subject: mail.subject, html: mail.html, text: mail.text, meta: { crm: t.key, flow } });
      if (res.sent) {
        sent++;
        try {
          await dbExecute("INSERT INTO crm_trigger_sends (trigger_key, identifier) VALUES ($1,$2) ON CONFLICT DO NOTHING", [t.key, p.identifier]);
        } catch (e) { console.error("[cron/crm] dedup insert failed:", String(e)); }
      } else { failed++; }
    }
  }

  return NextResponse.json({ ok: true, live, profiles: profiles.length, planned, sent, failed, preview });
}
```
> Nota: `sendTransactional` accetta `type: TxEmailType`; per non allargare ora l'enum si usa `"winback"` con `meta.crm`=key (la riga `notifications` resta tracciata e distinguibile dal meta). Allargare l'enum a `"crm"` è un follow-up.

- [ ] **Step 2: Aggiungere il cron in `vercel.json`** (giornaliero 07:00, dopo subscriptions 06:00):
```json
{
  "path": "/api/cron/crm",
  "schedule": "0 7 * * *"
}
```

- [ ] **Step 3: Verifica** — `npm run lint && npm run build && node -e "require('./vercel.json')"`. (Ignora il lint pre-esistente in `app/app/page.tsx`.)
- [ ] **Step 4: Commit** — `git add app/api/cron/crm/route.ts vercel.json && git commit -m "feat(crm): cron motore lifecycle + dry-run (#CRM-LIFECYCLE)"`

---

### Task 5: De-dup nel cron `subscriptions` (cede winback/renewal al CRM)

**Files:**
- Modify: `app/api/cron/subscriptions/route.ts`

- [ ] **Step 1: Mantenere `plan_expires_at` al downgrade** (serve al win-back). Cambiare l'UPDATE di downgrade da `SET plan='free', plan_expires_at=NULL` a:
```ts
      `UPDATE profiles
         SET plan = 'free', updated_at = NOW()
       WHERE plan IN ('base', 'premium')
         AND plan_expires_at IS NOT NULL
         AND plan_expires_at < NOW()
       RETURNING identifier, language`
```
(togliere solo `plan_expires_at = NULL`; il resto invariato.)

- [ ] **Step 2: Rimuovere gli invii winback + renewal_reminder** (ora li fa il CRM): eliminare il blocco "1b. Win-back" (loop su `expiredRows` con `winBackEmail`) e il blocco "2. Renewal reminders" (loop 5/1 giorni). Rimuovere gli import ora inutili (`winBackEmail`, `reminderEmail` se locale). La risposta diventa `{ ok: true, downgraded }`.

- [ ] **Step 3: Verifica** — `npm run lint && npm run build`. Confermare con `grep -n "winBackEmail\|renewal_reminder" app/api/cron/subscriptions/route.ts` → nessun match.
- [ ] **Step 4: Commit** — `git add app/api/cron/subscriptions/route.ts && git commit -m "refactor(crm): subscriptions cede winback/renewal al motore CRM; mantiene plan_expires_at (#CRM-LIFECYCLE)"`

---

### Task 6: Verifica reale (GATED)

> Non codice. Richiede APPROVE + accesso prod.
- [ ] Unit verdi: `npx tsx tests/crm.test.ts && npx tsx tests/crm-content.test.ts`.
- [ ] Apply migration `20260628120000_crm_lifecycle` (Supabase MCP) — dopo APPROVE.
- [ ] **DRY-RUN reale:** chiamare `GET /api/cron/crm` (bearer CRON_SECRET, **senza** `send=1`) → ispezionare `preview`/`planned`: chi riceverebbe cosa, un solo flow per utente, nessun doppione. Verificare su 2-3 profili noti che il flow/day sia corretto.
- [ ] Review **legale-compliance** sull'invio marketing (offerte/sconti) prima del live.
- [ ] **Primo invio reale:** impostare env `CRM_SEND_ENABLED=1` (Vercel) e invocare `?send=1` una volta manualmente → verificare le mail in `notifications` + nessun doppione (ri-invocare → 0 nuovi).
- [ ] Verificare assenza doppioni col cron subscriptions (winback/renewal non più inviati lì).
- [ ] Report "cosa è cambiato davvero" + aggiornare memoria.

---

## Self-Review (eseguita)
**Spec coverage:** §3 stati→`resolveFlow` (T2); §4 dati→T1; §5 motore/one-flow/dedup/opt-out→T4(+T2); §6 touchpoint copy→T3; "assorbi winback/renewal"→T5; §8 verifica→T2/T3 unit + T6 dry-run. Telegram/Wheel/lead-scoring/VIP/retiering = §7 esplicitamente fuori Fase 1.
**Placeholder scan:** nessun TODO bloccante; l'uso di `type:"winback"` per il record è una scorciatoia consapevole documentata (enum TxEmailType non allargato ora).
**Type consistency:** `CrmProfile`/`Touchpoint`/`resolveFlow`/`dueTriggers`/`isEligible`/`renderCrm`/`CRM_TOUCHPOINTS` coerenti tra T2/T3/T4. `day` semantica documentata (giorni-da-ancora vs giorni-alla-scadenza per retention).
**Rischi:** invio reale doppio-gated (`?send=1` + `CRM_SEND_ENABLED`); dry-run obbligatorio; one-flow-at-a-time; dedup PK; downgrade ora mantiene `plan_expires_at` (verificare non rompa viste/accesso — il free non gata su expiry).
