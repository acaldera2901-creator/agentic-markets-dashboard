import { allSportsbooks } from "./registry";
import type { Sportsbook, BetSelection, BuildResult } from "./types";

export type { Sportsbook, BetSelection, BuildResult, BetLinkOption, SportsbookId, BetSport } from "./types";

// Master switch. Default: OFF (la feature è inerte finché non la si accende).
export function linksEnabled(): boolean {
  return process.env.SPORTSBOOK_LINKS_ENABLED === "true";
}

// #PRELAUNCH-AUDIT (Italia · Decreto Dignità, D.L. 87/2018 art.9): i link ai book +
// revshare = pubblicità INDIRETTA di scommesse, vietata verso l'Italia. Hard-block a
// livello codice, PRIMA dell'allowlist env: così l'IT non riceve MAI link-book anche
// se SPORTSBOOK_GEO_ALLOWLIST è "*" o include IT per errore. Presidio non aggirabile
// via misconfig. Estendere questo set per altre giurisdizioni vietate.
const GEO_BLOCKED_COUNTRIES = new Set(["IT"]);

// Geo-gate. Lista vuota -> nessuna geo ammessa (default sicuro). "*" -> globale.
export function geoAllowed(country: string | null | undefined): boolean {
  // Blocco duro delle giurisdizioni vietate, indipendente dall'allowlist env.
  if (country && GEO_BLOCKED_COUNTRIES.has(country.trim().toUpperCase())) return false;
  const raw = (process.env.SPORTSBOOK_GEO_ALLOWLIST || "").trim();
  if (!raw) return false;
  if (raw === "*") return true;
  if (!country) return false;
  const set = new Set(
    raw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
  );
  return set.has(country.toUpperCase());
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
