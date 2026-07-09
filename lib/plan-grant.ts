import { dbQuery, dbExecute } from "./db";
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
type ActivationSource = "admin" | "stripe" | "paygate" | "paypal";

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
            plan_expires_at = NOW() + INTERVAL '30 days',
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
  const prev = await dbQuery<{ identifier: string; name: string | null; old_plan: string | null }>(
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
