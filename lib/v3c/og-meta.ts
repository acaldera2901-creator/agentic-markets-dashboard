// lib/v3c/og-meta.ts (#REDESIGN-V3C polish-2) — og:image e twitter:image delle pagine
// v3c che hanno un'immagine propria (partita, tool). L'immagine è servita da un route
// handler `og.png` accanto alla pagina e raggiunta dall'URL PUBBLICO (rewrite in
// lib/v3c/rewrites.ts), mai da /v3c/…: con la convenzione `opengraph-image` Next
// scriveva il percorso interno del filesystem. URL relativo → assoluto con il
// metadataBase della root (https://www.betredge.com).
import type { Metadata } from "next";
import { toolPath, type ToolLocale, type ToolSlug } from "@/lib/tools/registry";
import { toolMetadata } from "@/lib/tools/seo";

export const V3C_OG_FILE = "og.png";
export const V3C_OG_SIZE = { width: 1200, height: 630 } as const;

/** "/match/x" → "/match/x/og.png" (il path pubblico, senza /v3c). */
export function v3cOgPath(publicPath: string): string {
  return `${publicPath.replace(/\/+$/, "")}/${V3C_OG_FILE}`;
}

type Base = { title: string; description: string; url: string };

export function v3cOgMetadata(publicPath: string, alt: string, base: Base, og?: Metadata["openGraph"]): Pick<Metadata, "openGraph" | "twitter"> {
  const url = v3cOgPath(publicPath);
  return {
    openGraph: {
      siteName: "BetRedge",
      type: "website",
      ...og,
      title: base.title,
      description: base.description,
      url: base.url,
      images: [{ url, ...V3C_OG_SIZE, alt, type: "image/png" }],
    },
    twitter: { card: "summary_large_image", site: "@BetrEdge", title: base.title, description: base.description, images: [{ url, alt }] },
  };
}

/** I metadata di oggi della pagina tool (title, canonical, hreflang invariati) + l'OG v3c. */
export function v3cToolMetadata(slug: ToolSlug, locale: ToolLocale): Metadata {
  const m = toolMetadata(slug, locale);
  const og = m.openGraph ?? {};
  return {
    ...m,
    ...v3cOgMetadata(toolPath(slug, locale), "BetRedge free betting calculator", { title: String(og.title ?? m.title), description: String(og.description ?? m.description), url: String(og.url) }, og),
  };
}
