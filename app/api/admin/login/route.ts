import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin-auth";
import { issueAdminToken } from "@/lib/admin-session";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

export async function POST(req: NextRequest) {
  try {
    // SEC #SEC-RL-ADMIN-1: throttle online brute-force of ADMIN_SECRET
    // (same pattern as founder/grant). 5 attempts / 60s per IP.
    if (rateLimit(`admin-login:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const { password } = await req.json() as { password?: string };

    if (!ADMIN_SECRET || !safeEqual(password, ADMIN_SECRET)) {
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
  return res;
}
