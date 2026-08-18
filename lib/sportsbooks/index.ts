import { allSportsbooks } from "./registry";
import type { Sportsbook, BetSelection, BuildResult } from "./types";

export type { Sportsbook, BetSelection, BuildResult, BetLinkOption, SportsbookId, BetSport } from "./types";

// Master switch. Default: OFF (la feature è inerte finché non la si accende).
export function linksEnabled(): boolean {
  return process.env.SPORTSBOOK_LINKS_ENABLED === "true";
}

// #GOLIVE-HIGH-D (audit go-live legale): mercati dove promuovere operatori non
// licenziati localmente è illecito autonomo — IT (Decreto Dignità, D.L. 87/2018
// art.9), DE (GlüStV 2021), FR (ANJ), NL (KOA/KSA), ES (DGOJ), BE (Gaming Commission)
// e da oggi CH (vedi sotto). I link ai book + revshare = pubblicità INDIRETTA di
// scommesse. Hard-block a livello codice, PRIMA dell'allowlist env: queste geo non
// ricevono MAI link-book anche se SPORTSBOOK_GEO_ALLOWLIST è "*" o le include per
// errore. Presidio non aggirabile via misconfig. Policy PROVVISORIA in attesa del memo
// legale-compliance; in futuro restringibile via allowlist per-operatore/licenza.
// Consumatori di questa costante (fonte unica, niente set duplicati da allineare):
// app/api/geo-books/route.ts — che a sua volta gatta la riga loghi partner e il link
// /partners nel footer (components/SiteFooter.tsx:119) e l'intera pagina /partners
// (app/partners/page.tsx:34), entrambi fail-closed — e le due rotte FortunePlay
// (app/api/fortuneplay-odds, app/api/fortuneplay-match), che fino al 18/08 tenevano
// una copia locale con dentro solo "IT": erano quindi aperte a DE/FR/NL/ES/BE malgrado
// questa policy. Se serve un set diverso, si aggiunge un export qui, NON una copia là.
// #CH01-P0-ADSPOLICY-0814 (decisione Andrea 17/08, opzione b) — CH entra nel
// hard-block. Non è una scelta tattica per la durata del test ads: nessuno dei
// partner in `lib/partners` è licenziato dal regime svizzero (ESBK/Gespa), e
// l'advertiser of record è una società svizzera (Maven Agency AG). Sta in codice e
// non nella env `SPORTSBOOK_GEO_ALLOWLIST` per due motivi misurati:
//   1. l'env chiude UNA superficie (i link-book via geoAllowed); il hard-block
//      chiude anche la riga loghi partner nel footer, il link a /partners e la
//      pagina /partners, che sono gattate su /api/geo-books → questa costante, non
//      sull'allowlist. Togliere CH dalla sola env lascerebbe un visitatore
//      svizzero davanti a 8 loghi di bookmaker/casinò;
//   2. una env si può rimettere a posto per errore; qui il presidio è quello che
//      questo file dichiara di essere.
// [Ipotesi] l'aggancio normativo preciso (LGD/BGS, pubblicità di offerte non
// autorizzate) va confermato dalla lane legale: la decisione operativa non ci
// dipende, il blocco è la direzione prudente in ogni caso.
export const GEO_BLOCKED_COUNTRIES = new Set(["IT", "DE", "FR", "NL", "ES", "BE", "CH"]);

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
