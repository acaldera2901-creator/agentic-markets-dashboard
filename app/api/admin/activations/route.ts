import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery } from "@/lib/db";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";
import { sendEmail, planActivatedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type ActivationRow = {
  identifier: string;
  name: string | null;
  plan: "base" | "premium";
};

function isAuthorized(req: NextRequest): Promise<boolean> {
  return isAdminAuthorized(req);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Mutating route authorized via admin cookie: block cross-site triggers
  // (form/img/prefetch CSRF) while allowing the admin's same-origin calls.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let body: { identifier?: unknown };
  try {
    body = (await req.json()) as { identifier?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string"
    ? normalizeIdentifier(body.identifier)
    : "";

  if (!identifier) {
    return NextResponse.json({ error: "identifier required" }, { status: 400 });
  }

  // 30-day subscription window from activation (payments GAP2). Runtime access
  // and the daily cron both enforce expiry against plan_expires_at.
  const rows = await dbQuery<ActivationRow>(
    `UPDATE profiles
       SET plan = requested_plan,
           requested_plan = NULL,
           plan_expires_at = NOW() + INTERVAL '30 days',
           updated_at = NOW()
     WHERE identifier = $1
       AND plan = 'pending_payment'
       AND requested_plan IN ('base', 'premium')
     RETURNING identifier, name, plan`,
    [identifier]
  );

  const activated = rows[0];
  if (!activated) {
    return NextResponse.json(
      { error: "profile is not pending activation or requested plan is missing" },
      { status: 409 }
    );
  }

  await dbQuery(
    `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
     VALUES ('admin_profile_plan_changed', 'admin', NULL, NULL, $1, NULL, 0, $2)`,
    [
      activated.plan,
      JSON.stringify({ identifier: activated.identifier, name: activated.name }),
    ]
  );

  // GAP4: tell the customer the plan is live (best-effort — never fails the
  // activation). Re-read the expiry just set above for the "active until" date.
  if (activated.identifier.includes("@")) {
    const exp = await dbQuery<{ plan_expires_at: string | null }>(
      "SELECT plan_expires_at::text FROM profiles WHERE identifier = $1 LIMIT 1",
      [activated.identifier]
    );
    const mail = planActivatedEmail(exp[0]?.plan_expires_at ?? null);
    sendEmail({ to: activated.identifier, subject: mail.subject, html: mail.html, text: mail.text })
      .catch((e) => console.error("[activations] plan-activated email failed:", String(e)));
  }

  return NextResponse.json({
    ok: true,
    profile: activated,
  });
}
