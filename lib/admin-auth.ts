import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

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

// Shared admin gate for /api/admin/*: accepts the admin cookie or a Bearer
// token, both compared constant-time. Fail-closed when ADMIN_SECRET is unset.
export function isAdminAuthorized(req: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const cookie = req.cookies.get("admin_token")?.value;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  return safeEqual(cookie, ADMIN_SECRET) || safeEqual(bearer, ADMIN_SECRET);
}
