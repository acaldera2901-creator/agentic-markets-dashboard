// lib/crm-unsub.ts
// Token di disiscrizione one-click per le email CRM (#CRM-LIFECYCLE). Firmato
// HMAC: il link non richiede login e non espone l'email in chiaro come parametro
// leggibile separato (l'identifier è dentro il token firmato).
import crypto from "node:crypto";

function secret(): string {
  return process.env.SESSION_SECRET || process.env.CRON_SECRET || "";
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
