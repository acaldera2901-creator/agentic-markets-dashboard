// /v3c/[lang]/tools — hub tool v3c tradotto (#REDESIGN-V3C F5), destinazione della
// rewrite di "/:lang/tools" (solo le dieci lingue prefissate, lib/v3c/rewrites.ts)
// a flag acceso. Spento: 404, e app/[lang]/tools/page.tsx resta quella di main.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3cToolsHub } from "@/components/v3c/tools/Hub";
import { PREFIXED_LOCALES, isToolLocale } from "@/lib/tools/registry";
import { v3cHubMetadata } from "@/lib/v3c/og-meta";
import { v3cProductOn } from "@/lib/v3c/board-data.server";

export const dynamic = "force-static";
// polish: i numeri d'esempio vengono dalla board vera (lib/v3c/board-source.server): ISR a 5 minuti.
export const revalidate = 300;
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
  return isToolLocale(lang) && lang !== "en" ? v3cHubMetadata(lang) : {};
}

export default async function V3cLocalizedToolsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!v3cProductOn() || !isToolLocale(lang) || lang === "en") notFound();
  return <V3cToolsHub locale={lang} />;
}
