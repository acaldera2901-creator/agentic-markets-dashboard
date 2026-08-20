// /tools — hub dei calcolatori gratuiti, inglese (lingua canonical, senza prefisso).
// #TOOLS-HUB-0805. Statica: nessun DB, nessuna API, nessun cookie.
import type { Metadata } from "next";
import { ToolsHub } from "@/components/tools/ToolsHub";
import { hubMetadata } from "@/lib/tools/seo";

export const dynamic = "force-static";

export const metadata: Metadata = hubMetadata("en");

export default function ToolsPage() {
  return <ToolsHub locale="en" />;
}
