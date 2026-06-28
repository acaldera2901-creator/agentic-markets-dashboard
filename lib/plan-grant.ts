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
type ActivationSource = "admin" | "stripe" | "paygate";

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
  const rows = await dbQuery<ActivatedRow>(
    `UPDATE profiles
        SET plan = requested_plan,
            requested_plan = NULL,
            plan_expires_at = NOW() + INTERVAL '30 days',
            updated_at = NOW()
      WHERE identifier = $1
        AND plan = 'pending_payment'
        AND requested_plan IN ('base','premium')
      RETURNING identifier, name, plan`,
    [identifier]
  );

  const activated = rows[0];
  if (!activated) return null;

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
  const rows = await dbQuery<ActivatedRow & { old_plan: string | null }>(
    `WITH prev AS (
       SELECT identifier, plan AS old_plan FROM profiles
        WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
        LIMIT 1
     )
     UPDATE profiles p
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = ${expirySqlExpr(expiresAtIso)},
            stripe_subscription_id = COALESCE($3, p.stripe_subscription_id),
            updated_at = NOW()
       FROM prev
      WHERE p.identifier = prev.identifier
      RETURNING p.identifier, p.name, p.plan, prev.old_plan`,
    [identifier, plan, subscriptionId]
  );

  const activated = rows[0];
  if (!activated) return null;

  // Expiry is always updated by the UPDATE above; notify ONLY on a real transition.
  if (activated.old_plan !== activated.plan) {
    await notifyPlanActivated(
      { identifier: activated.identifier, name: activated.name, plan: activated.plan },
      "stripe"
    );
  }

  return { identifier: activated.identifier, name: activated.name, plan: activated.plan };
}

// PayGate activation: il callback è già verificato a monte (token monouso +
// importo) e l'ordine fa da lock di idempotenza, quindi nessun pending-guard qui.
// Expiry per periodo: monthly +30gg, annual +365gg. Notifica solo su transizione
// reale (come activateStripePlan). source 'paygate'.
export async function activatePaygatePlan(
  identifier: string,
  plan: GrantablePlan,
  period: "monthly" | "annual"
): Promise<ActivatedRow | null> {
  const days = period === "annual" ? 365 : 30;

  // NB: la RPC exec_sql NON restituisce le righe di RETURNING (esegue lo statement
  // ma torna []), quindi NON usiamo `... RETURNING`: leggiamo prima il piano
  // attuale con un SELECT, poi facciamo l'UPDATE, e notifichiamo sulla transizione.
  const prev = await dbQuery<{ plan: string; name: string | null }>(
    `SELECT plan, name FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      LIMIT 1`,
    [identifier]
  );
  const before = prev[0];
  if (!before) return null;

  await dbExecute(
    `UPDATE profiles
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = NOW() + make_interval(days => $3),
            updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [identifier, plan, days]
  );

  const activated: ActivatedRow = { identifier, name: before.name, plan };
  if (before.plan !== plan) {
    await notifyPlanActivated(activated, "paygate");
  }
  return activated;
}
