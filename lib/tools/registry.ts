// lib/tools/registry.ts (#TOOLS-HUB-0805)
// Elenco chiuso di tool e lingue: è la fonte di verità sia per generateStaticParams
// (qualunque segmento fuori da qui → 404) sia per gli hreflang. Un solo posto da
// toccare per aggiungere un tool o una lingua.

export const TOOL_SLUGS = [
  "odds-converter",
  "margin-calculator",
  "ev-calculator",
  "kelly-criterion",
  "probability-calculator",
] as const;

export type ToolSlug = (typeof TOOL_SLUGS)[number];

// "en" è la lingua canonical e vive SENZA prefisso su /tools: due URL per lo
// stesso contenuto (/tools e /en/tools) sarebbero contenuto duplicato.
export const TOOL_LOCALES = [
  "en",
  "it",
  "es",
  "fr",
  "de",
  "pt",
  "nl",
  "pl",
  "tr",
  "sv",
  "ru",
] as const;

export type ToolLocale = (typeof TOOL_LOCALES)[number];

/** I dieci locali che vivono sotto /[lang]/tools. */
export const PREFIXED_LOCALES = TOOL_LOCALES.filter((l) => l !== "en");

export function isToolSlug(value: string): value is ToolSlug {
  return (TOOL_SLUGS as readonly string[]).includes(value);
}

export function isToolLocale(value: string): value is ToolLocale {
  return (TOOL_LOCALES as readonly string[]).includes(value);
}

export function hubPath(locale: ToolLocale): string {
  return locale === "en" ? "/tools" : `/${locale}/tools`;
}

export function toolPath(slug: ToolSlug, locale: ToolLocale): string {
  return `${hubPath(locale)}/${slug}`;
}

/** Nome della lingua NELLA lingua: un selettore che scrive "Italian" a un
 *  italiano è un selettore fatto per chi lo ha programmato, non per chi lo usa. */
export const LOCALE_NAMES: Record<ToolLocale, string> = {
  en: "English",
  it: "Italiano",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  tr: "Türkçe",
  sv: "Svenska",
  ru: "Русский",
};

/** Dominio pubblico, usato per canonical e hreflang assoluti. */
export const SITE_ORIGIN = "https://www.betredge.com";

/** Codice hreflang: coincide col locale, ma passa da qui per non spargere magia. */
export function hreflangFor(locale: ToolLocale): string {
  return locale;
}
