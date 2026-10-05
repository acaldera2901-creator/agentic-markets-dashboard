// /tools — hub dei calcolatori gratuiti, inglese (lingua canonical, senza prefisso).
// #TOOLS-HUB-0805. Statica: nessun DB, nessuna API, nessun cookie.
//
// #REDESIGN-V3C F5: con NEXT_PUBLIC_REDESIGN acceso la stessa URL mostra l'hub
// v3c «il banco». La pagina è force-static, quindi il flag è SOLO la variabile
// (cookies() qui tornerebbe vuoto); l'import è dinamico perché a flag spento
// né il CSS né i font del redesign devono entrare nel documento.
import type { Metadata } from "next";
import { ToolsHub } from "@/components/tools/ToolsHub";
import { hubMetadata } from "@/lib/tools/seo";
import { REDESIGN_ENV, envFlagOn } from "@/lib/redesign-flag";

export const dynamic = "force-static";

export const metadata: Metadata = hubMetadata("en");

export default async function ToolsPage() {
  if (envFlagOn(process.env[REDESIGN_ENV])) {
    const { V3cToolsHub } = await import("@/components/v3c/tools/Hub");
    return <V3cToolsHub locale="en" />;
  }
  return <ToolsHub locale="en" />;
}
