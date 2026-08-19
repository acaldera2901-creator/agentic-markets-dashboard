import { allSportsbooks } from "./registry";
import type { Sportsbook, BetSelection, BuildResult } from "./types";

export type { Sportsbook, BetSelection, BuildResult, BetLinkOption, SportsbookId, BetSport } from "./types";

// Master switch. Default: OFF (la feature è inerte finché non la si accende).
export function linksEnabled(): boolean {
  return process.env.SPORTSBOOK_LINKS_ENABLED === "true";
}

// #GEO-OPEN-0819 — GEO APERTA IN TUTTO IL MONDO. Decisione di Jo (il capo) del
// 19/08/2026, con parere legale SCRITTO a copertura, relayata da calde per conto di
// Andrea: ogni utente vede il sito completo, partner e link bookmaker inclusi.
// Il default di questa costante è quindi VUOTO = nessuna geo bloccata.
//
// Cosa c'era prima, e perché sta scritto qui invece di essere cancellato: fino a oggi
// il set conteneva IT, DE, FR, NL, ES, BE — i mercati che l'audit go-live
// (#GOLIVE-HIGH-D) aveva identificato come giurisdizioni dove promuovere operatori
// non licenziati localmente è un ILLECITO AUTONOMO, non un rischio di policy:
// IT (Decreto Dignità, D.L. 87/2018 art.9), DE (GlüStV 2021), FR (ANJ), NL (KOA/KSA),
// ES (DGOJ), BE (Gaming Commission). In Italia il divieto di pubblicità è totale.
// Quella lista non era una preferenza di prodotto e la si riapre su una decisione
// umana documentata, non per semplificazione: se in futuro qualcuno chiede in base a
// cosa l'Italia è stata riaperta, la risposta è il parere di Jo del 19/08, che va
// tenuto agli atti (vault/council) — richiesta già girata a calde.
//
// La lista è ora governata dall'ENV `GEO_BLOCKED_COUNTRIES` (ISO-2, separati da
// virgola) così che ri-chiudere una singola giurisdizione — se arriva una diffida o
// cambia il parere — sia una modifica di configurazione e non una release di codice.
// ⚠️ Il rovescio, dichiarato: prima il presidio era in codice e NON aggirabile per
// misconfig; ora una env sbagliata o assente lascia tutto APERTO. È il compromesso
// che questa decisione comporta, ed è scritto qui perché chi lo cambia sappia cosa
// sta cambiando.
//
// Consumatori (fonte unica, niente set duplicati): app/api/geo-books/route.ts — che a
// sua volta gatta la riga loghi partner e il link /partners nel footer e la pagina
// /partners, tutti fail-closed su questo valore — e le due rotte FortunePlay.
export const GEO_BLOCKED_COUNTRIES = new Set(
  (process.env.GEO_BLOCKED_COUNTRIES || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean),
);

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
