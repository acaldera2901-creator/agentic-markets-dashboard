// /v3c/tools/[tool] — la pagina tool v3c (#REDESIGN-V3C F5), destinazione della
// rewrite di "/tools/:tool" a flag acceso (lib/v3c/rewrites.ts). Spento: 404, e
// app/tools/[tool]/page.tsx resta quella di main. Stessi metadata e JSON-LD.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3cToolPage } from "@/components/v3c/tools/ToolPage";
import { TOOL_SLUGS, isToolSlug } from "@/lib/tools/registry";
import { toolMetadata } from "@/lib/tools/seo";
import { v3cProductOn } from "@/lib/v3c/board-data.server";

export const dynamic = "force-static";
// polish: i numeri d'esempio vengono dalla board vera (lib/v3c/board-source.server): ISR a 5 minuti.
export const revalidate = 300;
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

export default async function V3cToolRoute({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!v3cProductOn() || !isToolSlug(tool)) notFound();
  return <V3cToolPage slug={tool} locale="en" />;
}
