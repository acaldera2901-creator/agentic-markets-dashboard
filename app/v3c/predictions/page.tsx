// /v3c/predictions — la board v3c intera (#REDESIGN-V3C F3). Destinazione
// della rewrite di "/predictions" quando NEXT_PUBLIC_REDESIGN è acceso
// (next.config.ts); spento risponde 404 e /predictions resta quella di sempre.
// Metadata e breadcrumb identici a app/predictions/page.tsx (test in
// app/v3c/v3c-routes.test.tsx).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { V3cBoardPage } from "@/components/v3c/pages/V3cBoardPage";
import { v3cProductOn } from "@/lib/v3c/board-data.server";

export const metadata: Metadata = {
  title: "Predictions | BetRedge",
  description: "Live football and tennis predictions with calibrated probabilities, confidence bands, and the reasoning behind every number.",
  alternates: { canonical: "/predictions" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function V3cPredictionsPage({ searchParams }: Props) {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Predictions", "/predictions"]])} />
      <V3cBoardPage surface="predictions" searchParams={searchParams} />
    </>
  );
}
