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
import { EN_TITLES } from "@/lib/v3c/doc-titles";

// fixui B4/L5 (QA): niente «Predictions» come categoria né «calibrated» (il tennis non ha una stima
// calibrata). URL e canonical invariati; il title ha la sua traduzione in lib/v3c/doc-titles.
export const metadata: Metadata = {
  title: EN_TITLES.board,
  description: "Every football and tennis match on today’s board: the odds as a probability, our football estimate beside it and the gap, before kick-off.",
  alternates: { canonical: "/predictions" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function V3cPredictionsPage({ searchParams }: Props) {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Board", "/predictions"]])} />
      <V3cBoardPage surface="predictions" searchParams={searchParams} />
    </>
  );
}
