// lib/crm-unsub.ts
// Token di disiscrizione one-click per le email CRM (#CRM-LIFECYCLE). Firmato
// HMAC: il link non richiede login e non espone l'email in chiaro come parametro
// leggibile separato (l'identifier è dentro il token firmato).
import crypto from "node:crypto";

function secret(): string {
  // Fail-closed (#38): an empty HMAC key makes every unsubscribe token forgeable
  // — HMAC("") over base64url(email) lets anyone mass-unsubscribe without login.
  // Refuse to issue/verify rather than sign with "". In prod SESSION_SECRET is
  // always set (login sessions depend on it), so this never trips there.
  // NB (#37 follow-up, tracked separately): the identifier is base64url-encoded
  // (reversible) inside the token → a future hardening is an opaque server-mapped id.
  const s = process.env.SESSION_SECRET || process.env.CRON_SECRET;
  if (!s) {
    throw new Error(
      "[crm-unsub] no signing secret (SESSION_SECRET/CRON_SECRET) — refusing to issue/verify forgeable unsubscribe tokens"
    );
  }
  return s;
}

export function unsubToken(identifier: string): string {
  const data = Buffer.from(identifier).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyUnsub(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expect = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return Buffer.from(data, "base64url").toString("utf8"); } catch { return null; }
}
