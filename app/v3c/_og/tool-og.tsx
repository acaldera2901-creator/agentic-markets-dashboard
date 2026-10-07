// app/v3c/_og/tool-og.tsx (#REDESIGN-V3C polish) — l'OG di una pagina tool: icona
// del kit, nome, riga d'uso e UN esempio calcolato dal tool stesso (lib/v3c/tools,
// stesse formule della pagina) sugli input di partenza, dichiarato «example».
// Nessuna cifra scritta a mano. A flag spento: 404.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { TOOL_ICON } from "@/components/v3c/Monogramma";
import { fmt, getV3cToolsCopy } from "@/lib/i18n/v3c-tools";
import type { ToolLocale, ToolSlug } from "@/lib/tools/registry";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { defaultValues, toolDef } from "@/lib/v3c/tools";
import { previewWordsFor } from "@/lib/v3c/fixui3-copy";
import { OG, OG_SIZE, OgFrame, ogAssets } from "./og";

export async function toolOgImage(slug: ToolSlug, locale: ToolLocale) {
  if (!v3cProductOn()) return new Response(null, { status: 404 });
  const c = getV3cToolsCopy(locale);
  const tc = c.tools[slug];
  const def = toolDef(slug);
  // fixui3 R4: the money tools start empty; the OG shows their declared example amounts, without «€»
  const v = { ...defaultValues(def), ...(def.example ?? {}) };
  const [r] = def.compute(v);
  const a = await ogAssets("tool");
  const svg = (await readFile(join(process.cwd(), "public/brand/v3c/icons", `${TOOL_ICON[slug]}.svg`), "utf8")).replace(/currentColor/g, OG.royal);
  const icon = `data:image/svg+xml;base64,${Buffer.from(svg.includes("fill=") ? svg : svg.replace("<svg", `<svg fill="${OG.royal}"`)).toString("base64")}`;
  return new ImageResponse(
    (
      <OgFrame bg={a.bg} lockup={a.lockup} foot="FREE TOOL · BETREDGE.COM/TOOLS · 18+">
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} width={64} height={64} alt="" />
        <div style={{ fontFamily: "Display", fontSize: 96, lineHeight: 1, marginTop: 18, textTransform: "uppercase" }}>{tc.name}</div>
        <div style={{ fontSize: 28, marginTop: 14, color: OG.ink }}>{tc.line}</div>
        {r ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 26, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, color: OG.ink2 }}>EXAMPLE</span>
            <span style={{ fontSize: 40, fontWeight: 800 }}>{def.previewInput(v, previewWordsFor(locale))}</span>
            <span style={{ fontSize: 36, color: OG.ink2 }}>→</span>
            <span style={{ fontSize: 40, fontWeight: 800 }}>{def.example ? r.value.replace("€", "") : r.value}</span>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 1, color: OG.ink2 }}>{fmt(tc.results[r.key] ?? r.key, r.vars ?? {}).toUpperCase()}</span>
          </div>
        ) : null}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: a.fonts },
  );
}
