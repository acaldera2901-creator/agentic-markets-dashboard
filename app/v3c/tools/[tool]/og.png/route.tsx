// OG della pagina tool v3c (#REDESIGN-V3C polish): vedi app/v3c/_og/tool-og.tsx.
import { TOOL_SLUGS, isToolSlug } from "@/lib/tools/registry";
import { toolOgImage } from "../../../_og/tool-og";

// polish-2: route handler servito da /tools/<tool>/og.png (rewrite), vedi lib/v3c/og-meta.ts.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return TOOL_SLUGS.map((tool) => ({ tool }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!isToolSlug(tool)) return new Response(null, { status: 404 });
  return toolOgImage(tool, "en");
}
