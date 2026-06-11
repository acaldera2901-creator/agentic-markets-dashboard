import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery } from "@/lib/db";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";
import { activatePlan, type GrantablePlan } from "@/lib/plan-grant";

export const dynamic = "force-dynamic";

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

  // Read the profile's current requested_plan before activating (admin activates
  // whatever plan the user requested, not a hardcoded plan).
  const pending = await dbQuery<{ requested_plan: GrantablePlan | null }>(
    "SELECT requested_plan FROM profiles WHERE identifier = $1 LIMIT 1",
    [identifier]
  );
  const wanted = pending[0]?.requested_plan;
  if (wanted !== "base" && wanted !== "premium") {
    return NextResponse.json(
      { error: "profile is not pending activation or requested plan is missing" },
      { status: 409 }
    );
  }

  const activated = await activatePlan(identifier, wanted, null);
  if (!activated) {
    return NextResponse.json(
      { error: "profile is not pending activation or requested plan is missing" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, profile: activated });
}
