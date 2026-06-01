import crypto from "node:crypto";

// Signed, httpOnly session cookie for server-side access gating (P0 #1).
//
// Design contract:
// - The cookie carries ONLY the profile identifier + issued-at, HMAC-signed with
//   SESSION_SECRET. It is NOT a plan token: the plan is always resolved fresh from
//   the `profiles` table server-side (see getSessionPlan in lib/auth.ts), so a stale
//   or tampered cookie can never grant a higher plan than what the DB stores.
// - HMAC-SHA256 with a constant-time compare. No external deps.

export const SESSION_COOKIE = "am_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  identifier: string;
  iat: number; // issued-at, unix seconds
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET missing or too short (>=16 chars required)");
  }
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(data: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

// Returns a cookie value of the form: <base64url(payload)>.<base64url(hmac)>
export function signSession(identifier: string, secret = getSecret()): string {
  const payload: SessionPayload = {
    identifier,
    iat: Math.floor(Date.now() / 1000),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

// Verifies signature, freshness and shape. Returns the payload or null.
export function verifySession(
  token: string | undefined | null,
  secret = getSecret()
): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(body, secret);
  // constant-time compare; lengths must match for timingSafeEqual
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.identifier !== "string" ||
    !payload.identifier ||
    typeof payload.iat !== "number"
  ) {
    return null;
  }
  // freshness
  const now = Math.floor(Date.now() / 1000);
  if (payload.iat > now + 60) return null; // issued in the future -> reject
  if (now - payload.iat > SESSION_TTL_SECONDS) return null; // expired
  return payload;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
