// Shared-password check for HTTP Basic auth. Pure (Web Crypto only), so it is
// testable and runs wherever proxy.ts runs. Username is ignored: one password
// for the team, set in GROWTH_PASSWORD. No password configured = locked.

export type AuthVerdict = "ok" | "missing-config" | "denied";

function decodeBasic(header: string | null): string | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const i = decoded.indexOf(":");
    return i < 0 ? null : decoded.slice(i + 1);
  } catch {
    return null;
  }
}

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

/** Constant-time comparison of the SHA-256 digests (length-independent). */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function checkBasicAuth(header: string | null, password: string | undefined): Promise<AuthVerdict> {
  if (!password || password.length < 12) return "missing-config";
  const given = decodeBasic(header);
  if (given === null) return "denied";
  return (await sameSecret(given, password)) ? "ok" : "denied";
}
