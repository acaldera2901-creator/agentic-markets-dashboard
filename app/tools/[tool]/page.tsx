// /tools/[tool] — una pagina per calcolatore, inglese. #TOOLS-HUB-0805
// dynamicParams=false: gli unici slug esistenti sono quelli del registry,
// qualunque altra cosa è 404 e non una pagina generata al volo.
//
// #REDESIGN-V3C F5: flag NEXT_PUBLIC_REDESIGN acceso → pagina tool v3c sulla
// stessa URL, stessi metadata e JSON-LD. Import dinamico: a flag spento il
// redesign non entra nel documento (vedi app/tools/page.tsx).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/tools/ToolShell";
import { TOOL_SLUGS, isToolSlug } from "@/lib/tools/registry";
import { toolMetadata } from "@/lib/tools/seo";
import { REDESIGN_ENV, envFlagOn } from "@/lib/redesign-flag";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return TOOL_SLUGS.map((tool) => ({ tool }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  return isToolSlug(tool) ? toolMetadata(tool, "en") : {};
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!isToolSlug(tool)) notFound();
  if (envFlagOn(process.env[REDESIGN_ENV])) {
    const { V3cToolPage } = await import("@/components/v3c/tools/ToolPage");
    return <V3cToolPage slug={tool} locale="en" />;
  }
  return <ToolShell slug={tool} locale="en" />;
}
