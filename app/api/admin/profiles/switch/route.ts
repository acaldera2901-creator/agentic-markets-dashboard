import { NextRequest, NextResponse } from "next/server";
import { dbQuery, getSupabaseAdminClient } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";
import type { Plan } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

type ProfileRow = {
  id: string;
  identifier: string;
  plan: Plan;
};

function isAuthorized(req: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const cookie = req.cookies.get("admin_token")?.value;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  return cookie === ADMIN_SECRET || bearer === ADMIN_SECRET;
}

async function writeAdminEvent(eventType: string, plan: Plan | null, meta: Record<string, unknown>) {
  await dbQuery(
    `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
     VALUES ($1, 'admin', NULL, NULL, $2, NULL, 0, $3)`,
    [eventType, plan, JSON.stringify(meta)]
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
