import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery, getSupabaseAdminClient } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import {
  ADMIN_IDENTIFIER,
  ADMIN_PROFILE_PLAN,
  normalizeAssignablePlan,
  normalizeIdentifier,
} from "@/lib/admin-profile-policy";
import type { Plan } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ProfileAdminRow = {
  id: string;
  identifier: string;
  name: string | null;
  plan: Plan;
  requested_plan: "base" | "premium" | null;
  tx_hash: string | null;
  language: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

function isAuthorized(req: NextRequest): Promise<boolean> {
  return isAdminAuthorized(req);
}

async function ensureAdminProfile() {
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Supabase service role not configured");
  const { error } = await db
    .from("profiles")
    .upsert(
      { identifier: ADMIN_IDENTIFIER, name: "Andrea", plan: ADMIN_PROFILE_PLAN, updated_at: new Date().toISOString() },
      { onConflict: "identifier" }
    );
  if (error) throw error;
}

async function writeAdminEvent(eventType: string, plan: Plan | null, meta: Record<string, unknown>) {
  // Audit logging must never fail the request it is recording.
  try {
    await dbQuery(
      `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
       VALUES ($1, 'admin', NULL, NULL, $2, NULL, 0, $3)`,
      [eventType, plan, JSON.stringify(meta)]
    );
  } catch {
    /* swallow — audit event is best-effort */
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureAdminProfile();
  } catch (error) {
    return NextResponse.json({ error: "admin profile bootstrap failed", detail: String(error) }, { status: 500 });
  }

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });

  const { data, error } = await db
    .from("profiles")
    .select("id, identifier, name, plan, requested_plan, tx_hash, language, timezone, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: "profiles fetch failed", detail: error.message }, { status: 500 });
  }

  const profiles = ((data ?? []) as ProfileAdminRow[]).sort((a, b) => {
    if (normalizeIdentifier(a.identifier) === ADMIN_IDENTIFIER) return -1;
    if (normalizeIdentifier(b.identifier) === ADMIN_IDENTIFIER) return 1;
    return 0;
  });

  return NextResponse.json({
    profiles,
    admin_identifier: ADMIN_IDENTIFIER,
    generated_at: new Date().toISOString(),
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Mutating route authorized via admin cookie: block cross-site triggers
  // (form/img/prefetch CSRF) while allowing the admin's same-origin calls.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let body: { id?: unknown; identifier?: unknown; plan?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; identifier?: unknown; plan?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const profileId = typeof body.id === "string" ? body.id.trim() : "";
  const identifier = normalizeIdentifier(body.identifier);
  const requestedPlan = normalizeAssignablePlan(body.plan);
  if (!profileId && !identifier) return NextResponse.json({ error: "profile id or identifier required" }, { status: 400 });
  if (!requestedPlan) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });

  const plan = identifier === ADMIN_IDENTIFIER ? ADMIN_PROFILE_PLAN : requestedPlan;
  let query = db
    .from("profiles")
    .update({ plan, requested_plan: null, updated_at: new Date().toISOString() })
    .select("id, identifier, name, plan, requested_plan, tx_hash, language, timezone, created_at, updated_at");

  query = profileId ? query.eq("id", profileId) : query.eq("identifier", identifier);
  const { data, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ error: "profile update failed", detail: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "profile not found", detail: { id: profileId || null, identifier } }, { status: 404 });
  }
  const profile = data as ProfileAdminRow;

  await writeAdminEvent("admin_profile_plan_changed", profile.plan, {
    identifier: profile.identifier,
    plan: profile.plan,
  });

  return NextResponse.json({ ok: true, profile });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // POST(impersonate) sets the session cookie — same cross-site guard as /switch.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let body: { id?: unknown; identifier?: unknown; action?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; identifier?: unknown; action?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const profileId = typeof body.id === "string" ? body.id.trim() : "";
  const identifier = normalizeIdentifier(body.identifier);
  const action = typeof body.action === "string" ? body.action : "";
  if (!profileId && !identifier) return NextResponse.json({ error: "profile id or identifier required" }, { status: 400 });

  if (action === "impersonate") {
    const db = getSupabaseAdminClient();
    if (!db) return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });

    let query = db
      .from("profiles")
      .select("id, identifier, name, plan, requested_plan, tx_hash, language, timezone, created_at, updated_at");
    query = profileId ? query.eq("id", profileId) : query.eq("identifier", identifier);
    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ error: "profile fetch failed", detail: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "profile not found", detail: { id: profileId || null, identifier } }, { status: 404 });
    const profile = data as ProfileAdminRow;

    await writeAdminEvent("admin_profile_impersonated", profile.plan, { identifier: profile.identifier });

    const res = NextResponse.json({ ok: true, profile });
    res.cookies.set(SESSION_COOKIE, signSession(profile.identifier), SESSION_COOKIE_OPTIONS);
    return res;
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
