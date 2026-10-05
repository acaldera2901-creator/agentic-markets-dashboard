// /[lang]/tools/[tool] — le pagine tradotte (11 tool × 10 lingue).
// #TOOLS-HUB-0805
//
// #REDESIGN-V3C F5: flag acceso → pagina tool v3c sulla stessa URL, stessi
// metadata e JSON-LD. Import dinamico come /tools.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/tools/ToolShell";
import { PREFIXED_LOCALES, TOOL_SLUGS, isToolLocale, isToolSlug } from "@/lib/tools/registry";
import { toolMetadata } from "@/lib/tools/seo";
import { REDESIGN_ENV, envFlagOn } from "@/lib/redesign-flag";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.flatMap((lang) => TOOL_SLUGS.map((tool) => ({ lang, tool })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; tool: string }>;
}): Promise<Metadata> {
  const { lang, tool } = await params;
  if (!isToolLocale(lang) || lang === "en" || !isToolSlug(tool)) return {};
  return toolMetadata(tool, lang);
}

export default async function LocalizedToolPage({
  params,
}: {
  params: Promise<{ lang: string; tool: string }>;
}) {
  const { lang, tool } = await params;
  if (!isToolLocale(lang) || lang === "en" || !isToolSlug(tool)) notFound();
  if (envFlagOn(process.env[REDESIGN_ENV])) {
    const { V3cToolPage } = await import("@/components/v3c/tools/ToolPage");
    return <V3cToolPage slug={tool} locale={lang} />;
  }
  return <ToolShell slug={tool} locale={lang} />;
}
