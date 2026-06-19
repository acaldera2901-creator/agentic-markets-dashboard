import crypto from "node:crypto";

// Account activation (HIGH-3) helpers, shared by /api/auth and /api/auth/activate.
// Kept out of the route files because Next validates route-segment exports
// (only HTTP handlers + config like `dynamic` are allowed there).

export const ACTIVATION_TTL_MS = 60 * 60 * 1000; // 1h

export function siteOrigin(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  try { return new URL(req.url).origin; } catch { return "https://betredge.com"; }
}

// Activation token: a random secret emailed to the user; only its SHA-256 hash
// is stored. On activate we hash the presented token and compare — the DB never
// holds a usable token. Returns { token (raw, for the URL), hash, expiresIso }.
export function newActivationToken(): { token: string; hash: string; expiresIso: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresIso = new Date(Date.now() + ACTIVATION_TTL_MS).toISOString();
  return { token, hash, expiresIso };
}

export function hashActivationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Password-reset token — same construction as the activation token (random
// secret emailed to the user, only its SHA-256 hash stored), separate column +
// TTL. Reuse hashActivationToken/tokenHashMatches to verify.
export const RESET_TTL_MS = 60 * 60 * 1000; // 1h

export function newResetToken(): { token: string; hash: string; expiresIso: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresIso = new Date(Date.now() + RESET_TTL_MS).toISOString();
  return { token, hash, expiresIso };
}

// Constant-time compare of two hex hashes.
export function tokenHashMatches(presentedHash: string, storedHash: string): boolean {
  const a = Buffer.from(presentedHash);
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
