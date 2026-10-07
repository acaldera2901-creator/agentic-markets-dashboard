// /v3c — la home del redesign v3c (#REDESIGN-V3C F3). NON è un URL pubblico:
// con NEXT_PUBLIC_REDESIGN acceso next.config.ts riscrive "/" qui (rewrite
// beforeFiles, l'URL nel browser resta "/"); spento, questa rotta risponde 404
// e "/" resta app/page.tsx, intatto byte per byte.
//
// polish: il FAQPage è quello di lib/v3c/home-faq.ts (= la FAQ visibile, senza «Base»).
// Metadata e JSON-LD sono QUELLI di app/page.tsx (canonical "/", stessa
// description, stesso FAQPage con le risposte visibili): una rewrite serve i
// metadata della destinazione, quindi devono coincidere — lo verifica
// app/v3c/v3c-routes.test.tsx.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, faqJsonLd } from "@/components/seo/json-ld";
import { V3cBoardPage } from "@/components/v3c/pages/V3cBoardPage";
import { V3C_HOME_FAQ } from "@/lib/v3c/home-faq";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { EN_TITLES } from "@/lib/v3c/doc-titles";

// fixui B4/L5 (QA): a flag acceso la home non si presenta più come «predictions» né promette una
// probabilità «calibrated» (vietato nel tennis, POSITIONING §2): «Price check for football and tennis odds».
// Canonical e JSON-LD restano quelli di oggi; il title ha la sua traduzione in lib/v3c/doc-titles.
export const metadata: Metadata = {
  title: EN_TITLES.home,
  description:
    "Price check for football and tennis odds: the market’s probability, our estimate beside it and the gap, with every result kept on a public record.",
  alternates: { canonical: "/" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function V3cHomePage({ searchParams }: Props) {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={faqJsonLd(V3C_HOME_FAQ.en.map(([q, a]) => [q, a]), "en")} />
      <V3cBoardPage surface="home" searchParams={searchParams} />
    </>
  );
}
