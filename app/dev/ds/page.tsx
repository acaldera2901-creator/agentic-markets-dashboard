// /dev/ds — la pagina di prova del design system v3c (#REDESIGN-V3C F1).
// Accessibile solo con il flag ON (variabile o cookie) o in development; mai
// indicizzata. Tutti i dati sono SAMPLE (lib/v3c/sample.ts) e la pagina lo
// scrive addosso a ogni blocco. Nessun DB, nessuna API, nessun partner vero.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRedesignEnabled } from "@/lib/redesign-flag.server";
import { v3cFontClass } from "@/components/v3c/fonts";
import { parseMode } from "@/lib/v3c/mode";
import { DsShowcase } from "@/components/v3c/dev/DsShowcase";
import "@/components/v3c/v3c.css";

export const metadata: Metadata = {
  title: "BetRedge design system v3c (dev)",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DesignSystemPage({ searchParams }: Props) {
  const enabled = await isRedesignEnabled();
  if (!enabled && process.env.NODE_ENV !== "development") notFound();
  const sp = await searchParams;
  return <DsShowcase initialMode={parseMode(sp.mode)} fontClass={v3cFontClass} flagOn={enabled} />;
}
