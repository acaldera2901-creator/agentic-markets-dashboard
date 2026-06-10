import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery, getSupabaseAdminClient } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";
import type { Plan } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  identifier: string;
  plan: Plan;
};

function isAuthorized(req: NextRequest): Promise<boolean> {
  return isAdminAuthorized(req);
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
  // This GET mutates session state (sets the session cookie). Allow ONLY a
  // same-origin request or a top-level navigation ("none"); block cross-site
  // AND same-site (subdomain) triggers — img/form/prefetch CSRF (LOW-14).
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 });
  }

  const profileId = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  const identifier = normalizeIdentifier(req.nextUrl.searchParams.get("identifier"));
  if (!profileId && !identifier) {
    return NextResponse.json({ error: "profile id or identifier required" }, { status: 400 });
  }

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });

  let query = db.from("profiles").select("id, identifier, plan");
  query = profileId ? query.eq("id", profileId) : query.eq("identifier", identifier);
  const { data, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ error: "profile fetch failed", detail: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "profile not found", detail: { id: profileId || null, identifier } }, { status: 404 });
  }
  const profile = data as ProfileRow;

  await writeAdminEvent("admin_profile_switched", profile.plan, { identifier: profile.identifier });

  const redirectUrl = new URL("/", req.url);
  redirectUrl.searchParams.set("switched", profile.identifier);
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set(SESSION_COOKIE, signSession(profile.identifier), SESSION_COOKIE_OPTIONS);
  return res;
}
