// lib/tools/seo.ts (#TOOLS-HUB-0805)
// Metadata e dati strutturati delle 55 pagine. Un solo posto che costruisce
// canonical e hreflang: se li scrivessi nelle page, undici lingue × cinque tool
// darebbero cinquantacinque occasioni di sbagliarne uno.

import type { Metadata } from "next";
import {
  SITE_ORIGIN,
  TOOL_LOCALES,
  TOOL_SLUGS,
  hubPath,
  toolPath,
  type ToolLocale,
  type ToolSlug,
} from "./registry";
import { getToolsCopy } from "./copy";

const abs = (path: string) => `${SITE_ORIGIN}${path}`;

/**
 * Mappa hreflang → URL assoluta, identica su tutte le varianti della pagina
 * (è la reciprocità che Google richiede) più x-default sull'inglese.
 */
function languageMap(pathFor: (locale: ToolLocale) => string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of TOOL_LOCALES) languages[locale] = abs(pathFor(locale));
  languages["x-default"] = abs(pathFor("en"));
  return languages;
}

export function toolMetadata(slug: ToolSlug, locale: ToolLocale): Metadata {
  const copy = getToolsCopy(locale).tools[slug];
  const url = abs(toolPath(slug, locale));
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: {
      canonical: url,
      languages: languageMap((l) => toolPath(slug, l)),
    },
    openGraph: {
      title: copy.metaTitle,
      description: copy.metaDescription,
      url,
      siteName: "BetRedge",
      type: "website",
      locale,
    },
  };
}

export function hubMetadata(locale: ToolLocale): Metadata {
  const copy = getToolsCopy(locale).hub;
  const url = abs(hubPath(locale));
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: {
      canonical: url,
      languages: languageMap((l) => hubPath(l)),
    },
    openGraph: {
      title: copy.metaTitle,
      description: copy.metaDescription,
      url,
      siteName: "BetRedge",
      type: "website",
      locale,
    },
  };
}

/** WebApplication (gratuita) + FAQPage: i due tipi che Google usa per questi contenuti. */
export function toolJsonLd(slug: ToolSlug, locale: ToolLocale): object[] {
  const copy = getToolsCopy(locale).tools[slug];
  const url = abs(toolPath(slug, locale));

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: copy.h1,
      description: copy.metaDescription,
      url,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      inLanguage: locale,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      publisher: { "@type": "Organization", name: "BetRedge", url: SITE_ORIGIN },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: locale,
      mainEntity: copy.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}

/** L'hub è una lista: dice ai crawler quali sono le cinque pagine e in che ordine. */
export function hubJsonLd(locale: ToolLocale): object {
  const copy = getToolsCopy(locale);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: copy.hub.h1,
    inLanguage: locale,
    itemListElement: TOOL_SLUGS.map((slug, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: copy.tools[slug].h1,
      url: abs(toolPath(slug, locale)),
    })),
  };
}
