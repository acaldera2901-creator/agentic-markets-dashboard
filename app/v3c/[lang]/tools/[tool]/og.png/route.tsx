// OG della pagina tool v3c nelle lingue prefissate (#REDESIGN-V3C polish): vedi app/v3c/_og/tool-og.tsx.
import { PREFIXED_LOCALES, TOOL_SLUGS, isToolLocale, isToolSlug } from "@/lib/tools/registry";
import { toolOgImage } from "../../../../_og/tool-og";

// polish-2: route handler servito da /<lang>/tools/<tool>/og.png (rewrite), vedi lib/v3c/og-meta.ts.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.flatMap((lang) => TOOL_SLUGS.map((tool) => ({ lang, tool })));
}

export async function GET(_req: Request, { params }: { params: Promise<{ lang: string; tool: string }> }) {
  const { lang, tool } = await params;
  if (!isToolLocale(lang) || lang === "en" || !isToolSlug(tool)) return new Response(null, { status: 404 });
  return toolOgImage(tool, lang);
}
