// OG della pagina tool v3c (#REDESIGN-V3C polish): vedi app/v3c/_og/tool-og.tsx.
import { TOOL_SLUGS, isToolSlug } from "@/lib/tools/registry";
import { OG_SIZE } from "../../_og/og";
import { toolOgImage } from "../../_og/tool-og";

export const alt = "BetRedge free betting calculator";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return TOOL_SLUGS.map((tool) => ({ tool }));
}

export default async function Image({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!isToolSlug(tool)) return new Response(null, { status: 404 });
  return toolOgImage(tool, "en");
}
