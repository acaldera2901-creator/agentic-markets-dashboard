// /v3c/tools — l'hub dei tool v3c (#REDESIGN-V3C F5). NON è un URL pubblico: con
// NEXT_PUBLIC_REDESIGN acceso next.config.ts riscrive "/tools" qui (beforeFiles,
// lib/v3c/rewrites.ts; l'URL nel browser non cambia); spento risponde 404 e
// app/tools/page.tsx resta quella di main, senza CSS né font del redesign.
// Metadata e JSON-LD identici a quelli di oggi (hubMetadata/hubJsonLd).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3cToolsHub } from "@/components/v3c/tools/Hub";
import { hubMetadata } from "@/lib/tools/seo";
import { v3cProductOn } from "@/lib/v3c/board-data.server";

export const dynamic = "force-static";

export const metadata: Metadata = hubMetadata("en");

export default function V3cToolsPage() {
  if (!v3cProductOn()) notFound();
  return <V3cToolsHub locale="en" />;
}
