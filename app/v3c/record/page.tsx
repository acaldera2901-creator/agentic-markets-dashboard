// /v3c/record — il registro sigillato v3c (#REDESIGN-V3C F6). Destinazione
// della rewrite di "/record" quando NEXT_PUBLIC_REDESIGN è acceso
// (next.config.ts); a flag acceso /history e /risultati fanno 308 su /record.
// Spento: 404 qui e su /record, /history resta quella di sempre.
// La calibrazione è una sezione di questa pagina (#calibration), non una
// rotta: stessa popolazione, stessi numeri, un URL in meno da tenere in pari.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { RecordPage } from "@/components/v3c/record/RecordPage";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { EN_TITLES } from "@/lib/v3c/doc-titles";

// fixui M8: un title che dice cosa c'è (era «Track Record»); traduzioni in lib/v3c/doc-titles.
export const metadata: Metadata = {
  title: EN_TITLES.record,
  description: "Every sealed BetRedge estimate and how it settled: Brier score next to the market's, calibration with sample sizes, and every correction.",
  alternates: { canonical: "/record" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function V3cRecordPage({ searchParams }: Props) {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Track Record", "/record"]])} />
      <RecordPage searchParams={searchParams} />
    </>
  );
}
