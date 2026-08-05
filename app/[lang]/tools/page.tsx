// /[lang]/tools — hub tradotto (le dieci lingue non inglesi). #TOOLS-HUB-0805
// L'inglese NON compare qui: vive su /tools, e due URL per lo stesso contenuto
// sarebbero contenuto duplicato.
//
// [lang] è un segmento dinamico alla radice: con dynamicParams=false accetta
// SOLO i dieci codici di generateStaticParams e 404 su tutto il resto. Le rotte
// statiche del sito (/app, /terms, /partners…) hanno comunque precedenza.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolsHub } from "@/components/tools/ToolsHub";
import { PREFIXED_LOCALES, isToolLocale } from "@/lib/tools/registry";
import { hubMetadata } from "@/lib/tools/seo";

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
  return <ToolsHub locale={lang} />;
}
