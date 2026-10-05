// lib/redesign-flag.ts (#REDESIGN-V3C F0)
// Il redesign v3c vive dietro UN flag: NEXT_PUBLIC_REDESIGN. OFF di default,
// quindi a flag spento nulla cambia nel sito. Un cookie di override
// (`br_redesign=1|0`) serve per provare il redesign su una preview in cui la
// variabile è spenta, o per vedere la versione vecchia dove è accesa.
//
// Questo file è PURO (niente next/headers, niente window): lo importano sia
// il lato server (redesign-flag.server.ts) sia il client
// (redesign-flag.client.ts), ed è l'unico posto in cui la regola è scritta.

export const REDESIGN_ENV = "NEXT_PUBLIC_REDESIGN";
export const REDESIGN_COOKIE = "br_redesign";

const ON = new Set(["1", "true", "on", "yes"]);
const OFF = new Set(["0", "false", "off", "no"]);

/** La variabile d'ambiente: accesa solo con un valore esplicito di «sì». */
export function envFlagOn(raw: string | undefined | null): boolean {
  return raw != null && ON.has(raw.trim().toLowerCase());
}

/**
 * Il cookie di override: `true` forza ON, `false` forza OFF, `null` lascia
 * decidere alla variabile (cookie assente o con un valore che non capiamo).
 */
export function cookieOverride(raw: string | undefined | null): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (ON.has(v)) return true;
  if (OFF.has(v)) return false;
  return null;
}

/** La regola, in un posto solo: il cookie vince, altrimenti la variabile. */
export function resolveRedesign(env: string | undefined | null, cookie: string | undefined | null): boolean {
  const override = cookieOverride(cookie);
  return override ?? envFlagOn(env);
}

/** Legge un cookie da una stringa in formato `document.cookie` / header Cookie. */
export function readCookieValue(cookieString: string | undefined | null, name: string): string | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

/**
 * Il percorso di ritorno dopo aver impostato il cookie: solo path relativi
 * alla stessa origine. `//evil.example` e `https://…` tornano alla pagina di
 * prova, non altrove (open redirect).
 */
export function safeReturnPath(raw: string | null | undefined, fallback = "/dev/ds"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
