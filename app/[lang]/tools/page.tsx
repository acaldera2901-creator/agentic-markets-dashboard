// /[lang]/tools — hub tradotto (le dieci lingue non inglesi). #TOOLS-HUB-0805
// L'inglese NON compare qui: vive su /tools, e due URL per lo stesso contenuto
// sarebbero contenuto duplicato.
//
// [lang] è un segmento dinamico alla radice: con dynamicParams=false accetta
// SOLO i dieci codici di generateStaticParams e 404 su tutto il resto. Le rotte
// statiche del sito (/app, /terms, /partners…) hanno comunque precedenza.
//
// #REDESIGN-V3C F5: flag acceso → hub v3c (stringhe nuove EN/IT, le altre in
// fallback inglese dichiarato — lib/i18n/v3c-tools). Import dinamico come /tools.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolsHub } from "@/components/tools/ToolsHub";
import { PREFIXED_LOCALES, isToolLocale } from "@/lib/tools/registry";
import { hubMetadata } from "@/lib/tools/seo";
import { REDESIGN_ENV, envFlagOn } from "@/lib/redesign-flag";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return isToolLocale(lang) && lang !== "en" ? hubMetadata(lang) : {};
}

export default async function LocalizedToolsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isToolLocale(lang) || lang === "en") notFound();
  if (envFlagOn(process.env[REDESIGN_ENV])) {
    const { V3cToolsHub } = await import("@/components/v3c/tools/Hub");
    return <V3cToolsHub locale={lang} />;
  }
  return <ToolsHub locale={lang} />;
}
