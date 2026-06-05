import crypto from "node:crypto";

// One-time login codes for customer auth. The plaintext code is emailed and
// never stored; only an HMAC (peppered with SESSION_SECRET) lives in the DB, so
// a DB read alone can't recover or replay codes.

export const OTP_TTL_SECONDS = 10 * 60; // code valid 10 minutes
export const OTP_RESEND_COOLDOWN_SECONDS = 60; // min gap between sends per identity
export const OTP_MAX_ATTEMPTS = 5; // verify attempts before the code is burned

function pepper(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET missing or too short (>=16 chars required)");
  }
  return secret;
}

// 6-digit, uniform over 000000-999999 (rejection-free: modulo bias on 2^32 by
// 10^6 is negligible — < 1e-3 relative — and irrelevant for a rate-limited,
// 10-minute, 5-attempt code).
export function generateCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export function hashCode(code: string): string {
  return crypto.createHmac("sha256", pepper()).update(code).digest("base64url");
}

// Constant-time compare of a submitted code against the stored hash.
export function codeMatches(submitted: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(submitted));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
