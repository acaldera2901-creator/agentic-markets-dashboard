import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery } from "@/lib/db";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";

export const dynamic = "force-dynamic";

type ActivationRow = {
  identifier: string;
  name: string | null;
  plan: "base" | "premium";
};

function isAuthorized(req: NextRequest): boolean {
  return isAdminAuthorized(req);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
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

  return NextResponse.json({
    ok: true,
    profile: activated,
  });
}
