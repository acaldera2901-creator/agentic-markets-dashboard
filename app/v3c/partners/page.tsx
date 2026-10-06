// /v3c/partners — Books. Server: gate geo (stessa lista e header di /api/geo-books),
// link affiliati del catalogo lib/partners.ts, confronto prezzi dalla board.
// (#REDESIGN-V3C pages) NON è un URL pubblico: con NEXT_PUBLIC_REDESIGN acceso
// next.config.ts riscrive la URL di oggi qui (beforeFiles, lib/v3c/pages-routes.ts;
// l'URL nel browser non cambia); spento risponde 404 e la pagina di oggi resta
// intatta. Metadata identici a quelli di oggi (app/v3c/v3c-pages-routes.test.tsx).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cBooksPage } from "@/components/v3c/pages/BooksPage";

// metadata e breadcrumb: quelli di app/partners/layout.tsx (che qui non si applica)
export const metadata: Metadata = {
  title: "Partners and Integrations | BetRedge",
  description:
    "The platforms and operators BetRedge works with, and what each one contributes.",
  alternates: { canonical: "/partners" },
};

export default async function Page() {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Partners", "/partners"]])} />
      <V3cBooksPage />
    </>
  );
}
