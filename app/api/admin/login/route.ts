import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin-auth";
import { issueAdminToken } from "@/lib/admin-session";
import { GROWTH_COOKIE, GROWTH_PATH, GROWTH_SESSION_PREFIX } from "@/lib/growth-access";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
// View-only secret for /admin/growth (see lib/growth-access.ts). Unset = disabled.
const GROWTH_VIEW_SECRET = process.env.GROWTH_VIEW_SECRET ?? "";

export async function POST(req: NextRequest) {
  try {
    // SEC #SEC-RL-ADMIN-1: throttle online brute-force of ADMIN_SECRET
    // (same pattern as founder/grant). 5 attempts / 60s per IP.
    if (rateLimit(`admin-login:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const { password } = await req.json() as { password?: string };

    const isAdmin = !!ADMIN_SECRET && safeEqual(password, ADMIN_SECRET);

    // View-only growth session: separate cookie, scoped to /admin/growth.
    if (!isAdmin && GROWTH_VIEW_SECRET && safeEqual(password, GROWTH_VIEW_SECRET)) {
      const res = NextResponse.json({ ok: true, scope: "growth" });
      res.cookies.set(GROWTH_COOKIE, await issueAdminToken(GROWTH_VIEW_SECRET, 60 * 60 * 8, GROWTH_SESSION_PREFIX), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: GROWTH_PATH,
        maxAge: 60 * 60 * 8, // 8 hours
      });
      return res;
    }

    if (!isAdmin) {
      // Add a small delay to prevent brute-force
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    // Expiring HMAC session token — the raw ADMIN_SECRET never reaches the
    // browser cookie store (see lib/admin-session.ts).
    res.cookies.set("admin_token", await issueAdminToken(ADMIN_SECRET), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("admin_token");
  res.cookies.delete({ name: GROWTH_COOKIE, path: GROWTH_PATH });
  return res;
}
