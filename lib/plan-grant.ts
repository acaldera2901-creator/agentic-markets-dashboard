import { dbQuery, dbQueryStrict, dbExecute } from "./db";
import { planActivatedEmail } from "./email";
import { sendTransactional } from "./notify";

export type GrantablePlan = "base" | "premium";

// SQL expression for plan_expires_at:
// - Explicit ISO (Stripe current_period_end) -> literal timestamptz
// - null (manual USDT admin) -> 30-day window computed by DB
export function expirySqlExpr(expiresAtIso: string | null): string {
  if (expiresAtIso) {
    const safe = expiresAtIso.replace(/'/g, ""); // ISO contains no quotes; defensive
    return `'${safe}'::timestamptz`;
  }
  return "NOW() + INTERVAL '30 days'";
}

type ActivatedRow = { identifier: string; name: string | null; plan: GrantablePlan };
type ActivationSource = "admin" | "stripe" | "paygate" | "paypal" | "shopify";

// Shared NOTIFICATION side-effect for both activation modes: audit `events` row +
// best-effort activation email. The two modes must NOT share the activating SQL
// (sharing it caused regressions) — only this notify step is shared.
// Email is best-effort and never throws out of here.
async function notifyPlanActivated(row: ActivatedRow, source: ActivationSource): Promise<void> {
  await dbQuery(
    `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
     VALUES ('admin_profile_plan_changed', $1, NULL, NULL, $2, NULL, 0, $3)`,
    [source, row.plan, JSON.stringify({ identifier: row.identifier, name: row.name })]
  );

  if (row.identifier.includes("@")) {
    const exp = await dbQuery<{ plan_expires_at: string | null }>(
      "SELECT plan_expires_at::text FROM profiles WHERE identifier = $1 LIMIT 1",
      [row.identifier]
    );
    const mail = planActivatedEmail(exp[0]?.plan_expires_at ?? null);
    await sendTransactional({
      type: "plan_activated",
      to: row.identifier,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      meta: { source, plan: row.plan },
    });
  }
}

// Admin / USDT activation: single atomic UPDATE guarded on pending_payment, plan
// becomes the user's own requested_plan. Notifies on a returned row (source 'admin').
export async function activateAdminPlan(identifier: string): Promise<ActivatedRow | null> {
  // exec_sql can't return RETURNING rows → SELECT the pending state first, then
  // run the guarded UPDATE. The WHERE guard stays on the UPDATE so a stale/racing
  // call still cannot activate a profile that is no longer pending.
  const prev = await dbQuery<{ name: string | null; plan: string; requested_plan: string | null }>(
    `SELECT name, plan, requested_plan FROM profiles WHERE identifier = $1 LIMIT 1`,
    [identifier]
  );
  const before = prev[0];
  if (
    !before ||
    before.plan !== "pending_payment" ||
    (before.requested_plan !== "base" && before.requested_plan !== "premium")
  ) {
    return null;
  }
  const newPlan = before.requested_plan as GrantablePlan;

  await dbExecute(
    `UPDATE profiles
        SET plan = requested_plan,
            requested_plan = NULL,
            tx_hash = NULL,
            plan_expires_at = NOW() + INTERVAL '30 days',
            plan_source = 'manual',
            updated_at = NOW()
      WHERE identifier = $1
        AND plan = 'pending_payment'
        AND requested_plan IN ('base','premium')`,
    [identifier]
  );

  const activated: ActivatedRow = { identifier, name: before.name, plan: newPlan };
  await notifyPlanActivated(activated, "admin");
  return activated;
}

// Stripe webhook activation: webhook is the source of truth (status-gated by the
// caller), so no pending guard. Detects the previous plan atomically via a CTE and
// only notifies on a real TRANSITION (old_plan !== new plan) — renewals advance
// expiry silently. Always updates expiry + sub id. Notifies with source 'stripe'.
export async function activateStripePlan(
  identifier: string,
  plan: GrantablePlan,
  subscriptionId: string | null,
  expiresAtIso: string | null
): Promise<ActivatedRow | null> {
  // exec_sql can't return RETURNING rows → resolve the profile (and its previous
  // plan, to notify only on a real transition) with a SELECT, then UPDATE the
  // resolved identifier.
  // #GOLIVE-AUDIT: dbQueryStrict (fail-loud). Con dbQuery un errore DB transitorio
  // tornava [] → before undefined → return null in silenzio, ma il webhook Stripe
  // ha GIÀ deduplicato event.id → la redelivery è scartata come duplicata e il
  // grant è perso per sempre (nessuna reconcile per Stripe). Il throw fa rispondere
  // il webhook non-200 → Stripe ritenta correttamente.
  const prev = await dbQueryStrict<{ identifier: string; name: string | null; old_plan: string | null }>(
    `SELECT identifier, name, plan AS old_plan FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      LIMIT 1`,
    [identifier]
  );
  const before = prev[0];
  if (!before) return null;

  await dbExecute(
    `UPDATE profiles p
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = ${expirySqlExpr(expiresAtIso)},
            stripe_subscription_id = COALESCE($3, p.stripe_subscription_id),
            plan_source = 'stripe',
            updated_at = NOW()
      WHERE p.identifier = $1`,
    [before.identifier, plan, subscriptionId]
  );

  // Expiry is always updated by the UPDATE above; notify ONLY on a real transition.
  if (before.old_plan !== plan) {
    await notifyPlanActivated({ identifier: before.identifier, name: before.name, plan }, "stripe");
  }

  return { identifier: before.identifier, name: before.name, plan };
}

// PayGate activation: il callback è già verificato a monte (token monouso +
// importo) e l'ordine fa da lock di idempotenza, quindi nessun pending-guard qui.
// Expiry per periodo: monthly +30gg, annual +365gg. Notifica solo su transizione
// reale (come activateStripePlan). source 'paygate'.
// #PAYGATE-PREFLIGHT-0629 finding #3 (anti-downgrade) — PURA/testabile. Calcola
// piano+scadenza di un grant PayGate senza MAI declassare/accorciare un piano
// migliore ancora attivo: i rinnovi ESTENDONO (stack del tempo residuo), e un
// acquisto di tier inferiore mentre un tier superiore è attivo NON declassa.
const PLAN_RANK: Record<string, number> = { base: 1, premium: 2 };
export function computePaygateGrant(opts: {
  currentPlan: string;
  currentExpiryISO: string | null;
  purchasedPlan: GrantablePlan;
  days: number;
  nowISO: string;
}): { plan: GrantablePlan; expiryISO: string } {
  const now = new Date(opts.nowISO).getTime();
  const curExp = opts.currentExpiryISO ? new Date(opts.currentExpiryISO).getTime() : 0;
  const active = curExp > now;
  // estendi dalla scadenza residua se ancora attiva, altrimenti da ora
  const baseTime = active ? curExp : now;
  const expiryISO = new Date(baseTime + opts.days * 86_400_000).toISOString();
  // anti-downgrade: se un piano attivo è di rango superiore al comprato, lo si mantiene
  const keepHigher = active && (PLAN_RANK[opts.currentPlan] ?? 0) > (PLAN_RANK[opts.purchasedPlan] ?? 0);
  const plan: GrantablePlan = keepHigher ? (opts.currentPlan as GrantablePlan) : opts.purchasedPlan;
  return { plan, expiryISO };
}

// Concede/estende un piano PayGate. Ritorna null SOLO se l'identifier non esiste
// in profiles (caso da gestire a monte: pagato-senza-piano → riconciliazione).
export async function activatePaygatePlan(
  identifier: string,
  plan: GrantablePlan,
  period: "monthly" | "annual"
): Promise<ActivatedRow | null> {
  const days = period === "annual" ? 365 : 30;

  // NB: exec_sql non restituisce RETURNING → SELECT prima, poi UPDATE.
  const prev = await dbQuery<{ plan: string; name: string | null; plan_expires_at: string | null }>(
    `SELECT plan, name, plan_expires_at::text AS plan_expires_at FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      LIMIT 1`,
    [identifier]
  );
  const before = prev[0];
  if (!before) return null; // identifier-not-found → il chiamante logga la riconciliazione

  const { plan: newPlan, expiryISO } = computePaygateGrant({
    currentPlan: before.plan,
    currentExpiryISO: before.plan_expires_at,
    purchasedPlan: plan,
    days,
    nowISO: new Date().toISOString(),
  });

  await dbExecute(
    `UPDATE profiles
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = $3::timestamptz,
            plan_source = 'paygate',
            updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [identifier, newPlan, expiryISO]
  );

  const activated: ActivatedRow = { identifier, name: before.name, plan: newPlan };
  if (before.plan !== newPlan) {
    await notifyPlanActivated(activated, "paygate");
  }
  return activated;
}

// Concede/estende un piano PayPal/Apple Pay. Stesso modello una-tantum di PayGate:
// riusa computePaygateGrant (stack del residuo + anti-downgrade). Ritorna null se
// l'identifier non esiste in profiles (→ il chiamante logga la riconciliazione).
export async function activatePaypalPlan(
  identifier: string,
  plan: GrantablePlan,
  period: "monthly" | "annual"
): Promise<ActivatedRow | null> {
  const days = period === "annual" ? 365 : 30;

  const prev = await dbQuery<{ plan: string; name: string | null; plan_expires_at: string | null }>(
    `SELECT plan, name, plan_expires_at::text AS plan_expires_at FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      LIMIT 1`,
    [identifier]
  );
  const before = prev[0];
  if (!before) return null;

  const { plan: newPlan, expiryISO } = computePaygateGrant({
    currentPlan: before.plan,
    currentExpiryISO: before.plan_expires_at,
    purchasedPlan: plan,
    days,
    nowISO: new Date().toISOString(),
  });

  await dbExecute(
    `UPDATE profiles
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = $3::timestamptz,
            plan_source = 'paypal',
            updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [identifier, newPlan, expiryISO]
  );

  const activated: ActivatedRow = { identifier, name: before.name, plan: newPlan };
  if (before.plan !== newPlan) {
    await notifyPlanActivated(activated, "paypal");
  }
  return activated;
}

// Guardia grandfather PURA: durante la transizione crypto→carta, un abbonato
// PayGate ancora attivo NON va sovrascritto da un grant Shopify (caso raro di
// doppio pagamento). Permette in ogni altro caso (shopify/manual/free/scaduto).
export function shopifyGrantAllowed(
  currentPlan: string,
  currentSource: string | null,
  currentExpiryISO: string | null
): boolean {
  // Va protetto SOLO un abbonamento PayGate davvero attivo. Senza il controllo
  // sul piano, un profilo 'free' con plan_source/scadenza RESIDUI (capita: il
  // piano viene riportato a free ma source ed expiry restano) risultava
  // grandfathered per sempre → ogni acquisto carta veniva rifiutato con 409 e
  // cadeva su PayGate. Un free non ha nulla da proteggere.
  if (currentPlan !== "base" && currentPlan !== "premium") return true;
  if (currentSource !== "paygate") return true;
  if (!currentExpiryISO) return true;
  return new Date(currentExpiryISO).getTime() <= Date.now();
}

// Blocker go-live: su Shopify ogni checkout con selling plan crea un NUOVO
// subscription contract. Chi ha già un abbonamento Shopify attivo e ricompra
// (upgrade base→premium, o semplicemente ricliccando) si ritrova DUE contratti
// che si addebitano entrambi ogni mese, e noi non abbiamo modo di cancellarne
// uno dal grant. Va bloccato a monte: il cambio piano si fa disdicendo prima.
export function hasActiveShopifySubscription(
  currentPlan: string,
  currentSource: string | null,
  currentExpiryISO: string | null
): boolean {
  if (currentPlan !== "base" && currentPlan !== "premium") return false;
  if (currentSource !== "shopify") return false;
  if (!currentExpiryISO) return false;
  return new Date(currentExpiryISO).getTime() > Date.now();
}

// Grant Shopify: stesso modello one-shot di PayGate/PayPal (riusa
// computePaygateGrant → stack del residuo + anti-downgrade). Ritorna null se
// l'identifier non esiste (→ riconciliazione) o se bloccato dalla guardia.
export async function activateShopifyPlan(
  identifier: string,
  plan: GrantablePlan,
  period: "monthly" | "annual"
): Promise<ActivatedRow | null> {
  const days = period === "annual" ? 365 : 30;

  const prev = await dbQuery<{
    plan: string;
    name: string | null;
    plan_expires_at: string | null;
    plan_source: string | null;
  }>(
    `SELECT plan, name, plan_expires_at::text AS plan_expires_at, plan_source FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      LIMIT 1`,
    [identifier]
  );
  const before = prev[0];
  if (!before) return null; // identifier-not-found → il chiamante logga la riconciliazione

  if (!shopifyGrantAllowed(before.plan, before.plan_source, before.plan_expires_at)) {
    console.error("[shopify] grant bloccato: abbonato PayGate attivo", { identifier });
    return null;
  }

  const { plan: newPlan, expiryISO } = computePaygateGrant({
    currentPlan: before.plan,
    currentExpiryISO: before.plan_expires_at,
    purchasedPlan: plan,
    days,
    nowISO: new Date().toISOString(),
  });

  await dbExecute(
    `UPDATE profiles
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = $3::timestamptz,
            plan_source = 'shopify',
            updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [identifier, newPlan, expiryISO]
  );

  const activated: ActivatedRow = { identifier, name: before.name, plan: newPlan };
  if (before.plan !== newPlan) {
    await notifyPlanActivated(activated, "shopify");
  }
  return activated;
}

// Revoca l'accesso dopo un rimborso/chargeback Shopify.
// Scadenza immediata, NON cancellazione del piano: l'accesso è governato da
// plan_expires_at (effectivePlan degrada lo scaduto a free), così non
// distruggiamo lo storico e un riacquisto riparte pulito.
// Tocca SOLO i piani di provenienza Shopify: un rimborso su Shopify non deve
// spegnere un abbonato PayGate che nel frattempo ha comprato altrove.
// Read STRICT: con dbQuery un errore DB tornava [] → plan_source undefined →
// "non è di Shopify" → revoca silenziosamente saltata, e il webhook rispondeva
// 200 marcando il rimborso come già gestito. L'utente rimborsato manteneva
// l'accesso per sempre. Meglio un 500 che fa ritentare Shopify.
export async function revokeShopifyPlan(identifier: string): Promise<boolean> {
  const rows = await dbQueryStrict<{ plan_source: string | null }>(
    `SELECT plan_source FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      LIMIT 1`,
    [identifier]
  );
  if (rows[0]?.plan_source !== "shopify") {
    console.error("[shopify] revoca ignorata: il piano attivo non è di Shopify", {
      identifier,
      plan_source: rows[0]?.plan_source ?? null,
    });
    return false;
  }
  await dbExecute(
    `UPDATE profiles
        SET plan_expires_at = NOW(), updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [identifier]
  );
  console.log(`[shopify] accesso revocato per rimborso identifier=${identifier}`);
  return true;
}
