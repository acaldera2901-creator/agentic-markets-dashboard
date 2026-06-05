/**
 * Admin session tokens — Edge-safe (Web Crypto only, no node:crypto).
 *
 * The admin cookie used to carry ADMIN_SECRET raw: a leaked cookie WAS the
 * master key, reusable as Bearer on every /api/admin/* route. The cookie now
 * carries a derived, expiring token instead:
 *
 *   <exp>.<base64url(HMAC_SHA256(ADMIN_SECRET, "admin-session|" + exp))>
 *
 * ADMIN_SECRET never leaves the server. Verification recomputes the HMAC via
 * crypto.subtle.verify (constant-time inside WebCrypto) and checks expiry.
 * This module is imported by the Edge middleware — keep it free of any
 * Node-only APIs.
 */

const SESSION_PREFIX = "admin-session|";

function b64url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

/** Issue an admin session token valid for maxAgeSeconds (default 8h). */
export async function issueAdminToken(
  secret: string,
  maxAgeSeconds = 60 * 60 * 8
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const key = await hmacKey(secret, "sign");
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(SESSION_PREFIX + exp)
  );
  return `${exp}.${b64url(sig)}`;
}

/** Verify token shape, signature and expiry. Fail-closed on any anomaly. */
export async function verifyAdminToken(
  token: string | null | undefined,
  secret: string
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  const sig = b64urlToBytes(token.slice(dot + 1));
  if (!sig) return false;
  try {
    const key = await hmacKey(secret, "verify");
    return await crypto.subtle.verify(
      "HMAC",
      key,
      sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength) as ArrayBuffer,
      new TextEncoder().encode(SESSION_PREFIX + expStr)
    );
  } catch {
    return false;
  }
}
