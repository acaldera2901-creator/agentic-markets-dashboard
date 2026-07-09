// lib/crm-unsub.ts
// Token di disiscrizione one-click per le email CRM (#CRM-LIFECYCLE).
// #PRELAUNCH-AUDIT: l'identifier (email) è CIFRATO (AES-256-GCM), non più base64url
// reversibile → non è leggibile dal token. La GCM tag autentica (niente HMAC separato).
// La chiave è FAIL-CLOSED: richiede CRM_UNSUB_SECRET o SESSION_SECRET (mai fallback a
// stringa vuota, mai riuso di CRON_SECRET) → niente token firmati con chiave nota.
import crypto from "node:crypto";

// 32-byte key derivata dal secret dedicato (o SESSION_SECRET). Throw se assente:
// meglio fallire l'invio che emettere/accettare token con chiave vuota forgiabile.
function key(): Buffer {
  const s = process.env.CRM_UNSUB_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("[crm-unsub] CRM_UNSUB_SECRET/SESSION_SECRET mancante (fail-closed)");
  return crypto.createHash("sha256").update(s).digest();
}

export function unsubToken(identifier: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(identifier, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${ct.toString("base64url")}.${tag.toString("base64url")}`;
}

export function verifyUnsub(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const [ivB, ctB, tagB] = parts;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    // Chiave assente, token manomesso/forgiato, o formato errato → rifiuta.
    return null;
  }
}
