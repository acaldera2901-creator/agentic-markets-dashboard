// /v3c/[lang]/tools/[tool] — pagina tool v3c tradotta (#REDESIGN-V3C F5),
// destinazione della rewrite di "/:lang/tools/:tool" a flag acceso
// (lib/v3c/rewrites.ts). Spento: 404, e app/[lang]/tools/[tool]/page.tsx resta
// quella di main. Stessi metadata e JSON-LD.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3cToolPage } from "@/components/v3c/tools/ToolPage";
import { PREFIXED_LOCALES, TOOL_SLUGS, isToolLocale, isToolSlug } from "@/lib/tools/registry";
import { v3cToolMetadata } from "@/lib/v3c/og-meta";
import { v3cProductOn } from "@/lib/v3c/board-data.server";

export const dynamic = "force-static";
// polish: i numeri d'esempio vengono dalla board vera (lib/v3c/board-source.server): ISR a 5 minuti.
export const revalidate = 300;
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
  return v3cToolMetadata(tool, lang);
}

export default async function V3cLocalizedToolRoute({
  params,
}: {
  params: Promise<{ lang: string; tool: string }>;
}) {
  const { lang, tool } = await params;
  if (!v3cProductOn() || !isToolLocale(lang) || lang === "en" || !isToolSlug(tool)) notFound();
  return <V3cToolPage slug={tool} locale={lang} />;
}
