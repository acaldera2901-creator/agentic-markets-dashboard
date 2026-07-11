import { allSportsbooks } from "./registry";
import type { Sportsbook, BetSelection, BuildResult } from "./types";

export type { Sportsbook, BetSelection, BuildResult, BetLinkOption, SportsbookId, BetSport } from "./types";

// Master switch. Default: OFF (la feature è inerte finché non la si accende).
export function linksEnabled(): boolean {
  return process.env.SPORTSBOOK_LINKS_ENABLED === "true";
}

// #PRELAUNCH-AUDIT (Italia · Decreto Dignità, D.L. 87/2018 art.9) + #ITALIA-EU-PARERE
// (decisione Andrea 2026-07-10): link-book + revshare = pubblicità INDIRETTA di
// scommesse. IT vietata per legge; BE e NL stessa classe di rischio (ban ads quasi
// totali, NL valuta ban totale). Hard-block a livello codice, PRIMA dell'allowlist
// env: queste geo non ricevono MAI link-book nemmeno se incluse nell'allowlist per
// errore. Presidio non aggirabile via misconfig.
export const GEO_BLOCKED_COUNTRIES = new Set(["IT", "BE", "NL"]);

// Geo-gate ALLOWLIST (#ITALIA-EU-PARERE): link-book visibili SOLO nelle geo elencate
// esplicitamente in SPORTSBOOK_GEO_ALLOWLIST (CSV di country code dove il book è
// legalmente promuovibile — lista FortunePlay da Tommy). Default nascosto: lista
// vuota, mancante o wildcard "*" → nessuna geo ammessa. Il wildcard è stato rimosso
// perché era una blocklist di fatto (tutto visibile tranne l'hard-block): promuovere
// un book non licenziato in DE/ES/FR/PT/AT ecc. è illegale là.
export function geoAllowed(country: string | null | undefined): boolean {
  // Blocco duro delle giurisdizioni vietate, indipendente dall'allowlist env.
  if (country && GEO_BLOCKED_COUNTRIES.has(country.trim().toUpperCase())) return false;
  const raw = (process.env.SPORTSBOOK_GEO_ALLOWLIST || "").trim();
  if (!raw || raw === "*") return false;
  if (!country) return false;
  const set = new Set(
    raw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
  );
  return set.has(country.trim().toUpperCase());
}

// Book ammessi per una geo. [] se master OFF o geo non ammessa.
export function resolveBooks(country: string | null | undefined): Sportsbook[] {
  if (!linksEnabled()) return [];
  if (!geoAllowed(country)) return [];
  return allSportsbooks();
}

// Pick the book's base URL for a country: regional override → "default" → global baseUrl.
export function resolveBaseUrl(book: Sportsbook, country: string | null | undefined): string {
  const cc = country?.trim().toUpperCase();
  return (cc && book.regionalUrls?.[cc]) || book.regionalUrls?.default || book.baseUrl;
}

// Costruisce l'URL in uscita; non lancia mai (fallback alla baseUrl risolta).
export function buildBetUrl(book: Sportsbook, sel: BetSelection, country?: string | null): BuildResult {
  const effective = { ...book, baseUrl: resolveBaseUrl(book, country) };
  try {
    return effective.adapter(sel, effective);
  } catch {
    return { url: effective.baseUrl, prefilled: false };
  }
}
