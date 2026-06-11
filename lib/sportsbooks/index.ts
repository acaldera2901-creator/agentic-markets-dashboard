import { allSportsbooks } from "./registry";
import type { Sportsbook, BetSelection, BuildResult } from "./types";

export type { Sportsbook, BetSelection, BuildResult, BetLinkOption, SportsbookId, BetSport } from "./types";

// Master switch. Default: OFF (la feature è inerte finché non la si accende).
export function linksEnabled(): boolean {
  return process.env.SPORTSBOOK_LINKS_ENABLED === "true";
}

// Geo-gate. Lista vuota -> nessuna geo ammessa (default sicuro). "*" -> globale.
export function geoAllowed(country: string | null | undefined): boolean {
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

// Costruisce l'URL in uscita; non lancia mai (fallback alla baseUrl affiliata).
export function buildBetUrl(book: Sportsbook, sel: BetSelection): BuildResult {
  try {
    return book.adapter(sel, book);
  } catch {
    return { url: book.baseUrl, prefilled: false };
  }
}
