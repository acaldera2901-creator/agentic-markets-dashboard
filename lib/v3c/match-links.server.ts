// lib/v3c/match-links.server.ts (#REDESIGN-V3C F4)
// I book partner senza feed di quote, per il passo 3 della pagina partita e il
// price check: compaiono come «Odds on partner site» dopo i book con quota. Fonte unica:
// lib/affiliate.ts (landingPartnersFor), gli stessi link tracciati del menu
// partner del sito di oggi. Nessun link inventato. Il paese serve solo a scegliere
// il link per paese di Casea.
import { headers } from "next/headers";
import { landingPartnersFor } from "@/lib/affiliate";
import type { V3BookLink } from "./match-view";

export async function landingBookLinks(): Promise<V3BookLink[]> {
  const h = await headers();
  const country = (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "").trim();
  return landingPartnersFor(country).map((p) => ({ bookmaker: p.name.toLowerCase().replace(/[^a-z0-9]/g, ""), name: p.name, url: p.url }));
}
