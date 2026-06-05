import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { verifyAdminToken } from "@/lib/admin-session";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

// Constant-time string compare: a plain `===` on secrets leaks length/prefix
// timing. Length check first is fine (length is not secret-revealing here
// beyond what an attacker already knows about token formats).
export function safeEqual(candidate: string | null | undefined, secret: string): boolean {
  if (!candidate || !secret) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Shared admin gate for /api/admin/*. Fail-closed when ADMIN_SECRET is unset.
// - Cookie: HMAC session token (expiring, derived — the raw secret no longer
//   lives in the browser cookie store; see lib/admin-session.ts).
// - Bearer: raw ADMIN_SECRET, constant-time — kept for server-to-server calls.
export async function isAdminAuthorized(req: NextRequest): Promise<boolean> {
  if (!ADMIN_SECRET) return false;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (safeEqual(bearer, ADMIN_SECRET)) return true;
  const cookie = req.cookies.get("admin_token")?.value;
  return verifyAdminToken(cookie, ADMIN_SECRET);
}
