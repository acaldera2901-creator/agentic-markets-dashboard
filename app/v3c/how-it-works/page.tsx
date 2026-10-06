// /v3c/how-it-works — il Metodo v3c, una schermata (#REDESIGN-V3C pages). NON è un URL pubblico: con
// NEXT_PUBLIC_REDESIGN acceso next.config.ts riscrive "/how-it-works" qui (beforeFiles,
// lib/v3c/pages-routes.ts; l'URL nel browser non cambia); spento risponde 404 e la
// pagina di oggi resta intatta. Metadata identici a quelli di oggi (test in
// app/v3c/v3c-pages-routes.test.tsx): una rewrite serve i metadata della destinazione.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cMethod } from "@/components/v3c/pages/Method";

export const metadata: Metadata = {
  title: "How it works | BetRedge",
  description:
    "What a BetRedge reading contains, how the model's probability is compared with the market's, what each plan opens, and what BetRedge does not do.",
  alternates: { canonical: "/how-it-works" },
};

export default async function Page() {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["How it works", "/how-it-works"]])} />
      <V3cFrame>
        <V3cMethod />
      </V3cFrame>
    </>
  );
}
