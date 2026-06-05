import crypto from "node:crypto";

// Password hashing for customer auth — scrypt (memory-hard, in Node core, no
// dependency). Stored format: scrypt$<saltB64url>$<hashB64url>. The salt is
// per-user random; verification is constant-time.

const SCRYPT_N = 16384; // CPU/memory cost (2^14) — solid for login, ~50ms
const KEYLEN = 64;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N: SCRYPT_N });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let salt: Buffer, expected: Buffer;
  try {
    salt = Buffer.from(parts[1], "base64url");
    expected = Buffer.from(parts[2], "base64url");
  } catch {
    return false;
  }
  let actual: Buffer;
  try {
    actual = crypto.scryptSync(password, salt, expected.length, { N: SCRYPT_N });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
