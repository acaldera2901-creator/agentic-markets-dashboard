import { dbQuery } from "./db";
import { sendEmail, planActivatedEmail } from "./email";

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

// Activates (or renews) a paid plan. Single path for admin and Stripe webhook.
// - expiresAtIso null  => USDT/admin: 30 days from DB, requires plan='pending_payment'
// - expiresAtIso set   => Stripe: expiry = current_period_end, idempotent on renewals
export async function activatePlan(
  identifier: string,
  plan: GrantablePlan,
  expiresAtIso: string | null
): Promise<ActivatedRow | null> {
  const guard = expiresAtIso
    ? "" // Stripe: webhook is source of truth, activate/renew without pending guard
    : "AND plan = 'pending_payment' AND requested_plan IN ('base','premium')";

  const rows = await dbQuery<ActivatedRow>(
    `UPDATE profiles
        SET plan = $2,
            requested_plan = NULL,
            plan_expires_at = ${expirySqlExpr(expiresAtIso)},
            updated_at = NOW()
      WHERE (identifier = $1 OR LOWER(TRIM(identifier)) = $1)
        ${guard}
      RETURNING identifier, name, plan`,
    [identifier, plan]
  );

  const activated = rows[0];
  if (!activated) return null;

  await dbQuery(
    `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
     VALUES ('admin_profile_plan_changed', 'system', NULL, NULL, $1, NULL, 0, $2)`,
    [activated.plan, JSON.stringify({ identifier: activated.identifier, name: activated.name })]
  );

  if (activated.identifier.includes("@")) {
    const exp = await dbQuery<{ plan_expires_at: string | null }>(
      "SELECT plan_expires_at::text FROM profiles WHERE identifier = $1 LIMIT 1",
      [activated.identifier]
    );
    const mail = planActivatedEmail(exp[0]?.plan_expires_at ?? null);
    sendEmail({ to: activated.identifier, subject: mail.subject, html: mail.html, text: mail.text })
      .catch((e) => console.error("[plan-grant] plan-activated email failed:", String(e)));
  }

  return activated;
}
