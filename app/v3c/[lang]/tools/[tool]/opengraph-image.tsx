// OG della pagina tool v3c nelle lingue prefissate (#REDESIGN-V3C polish): vedi app/v3c/_og/tool-og.tsx.
import { isToolLocale, isToolSlug } from "@/lib/tools/registry";
import { OG_SIZE } from "../../../_og/og";
import { toolOgImage } from "../../../_og/tool-og";

export const alt = "BetRedge free betting calculator";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ lang: string; tool: string }> }) {
  const { lang, tool } = await params;
  if (!isToolLocale(lang) || lang === "en" || !isToolSlug(tool)) return new Response(null, { status: 404 });
  return toolOgImage(tool, lang);
}
