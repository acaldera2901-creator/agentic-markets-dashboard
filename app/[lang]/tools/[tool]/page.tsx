// /[lang]/tools/[tool] — le cinquanta pagine tradotte (5 tool × 10 lingue).
// #TOOLS-HUB-0805
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/tools/ToolShell";
import { PREFIXED_LOCALES, TOOL_SLUGS, isToolLocale, isToolSlug } from "@/lib/tools/registry";
import { toolMetadata } from "@/lib/tools/seo";

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
  return <ToolShell slug={tool} locale={lang} />;
}
