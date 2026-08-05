// /tools/[tool] — una pagina per calcolatore, inglese. #TOOLS-HUB-0805
// dynamicParams=false: gli unici cinque slug esistenti sono quelli del registry,
// qualunque altra cosa è 404 e non una pagina generata al volo.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/tools/ToolShell";
import { TOOL_SLUGS, isToolSlug } from "@/lib/tools/registry";
import { toolMetadata } from "@/lib/tools/seo";

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
  return <ToolShell slug={tool} locale="en" />;
}
