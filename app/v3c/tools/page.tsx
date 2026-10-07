// /v3c/tools — l'hub dei tool v3c (#REDESIGN-V3C F5). NON è un URL pubblico: con
// NEXT_PUBLIC_REDESIGN acceso next.config.ts riscrive "/tools" qui (beforeFiles,
// lib/v3c/rewrites.ts; l'URL nel browser non cambia); spento risponde 404 e
// app/tools/page.tsx resta quella di main, senza CSS né font del redesign.
// Metadata e JSON-LD identici a quelli di oggi (hubMetadata/hubJsonLd).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3cToolsHub } from "@/components/v3c/tools/Hub";
import { v3cHubMetadata } from "@/lib/v3c/og-meta";
import { v3cProductOn } from "@/lib/v3c/board-data.server";

export const dynamic = "force-static";
// polish: i numeri d'esempio vengono dalla board vera (lib/v3c/board-source.server): ISR a 5 minuti.
export const revalidate = 300;

// fixui M8: + og:image (lib/v3c/og-meta)
export const metadata: Metadata = v3cHubMetadata("en");

export default async function V3cToolsPage() {
  if (!v3cProductOn()) notFound();
  return <V3cToolsHub locale="en" />;
}
