// /v3c/terms — solo la cornice cambia: il testo legale è lo stesso componente (#REDESIGN-V3C pages). NON è un URL pubblico: con
// NEXT_PUBLIC_REDESIGN acceso next.config.ts riscrive "/terms" qui (beforeFiles,
// lib/v3c/pages-routes.ts; l'URL nel browser non cambia); spento risponde 404 e la
// pagina di oggi resta intatta. Metadata identici a quelli di oggi (test in
// app/v3c/v3c-pages-routes.test.tsx): una rewrite serve i metadata della destinazione.
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cLegalFrame } from "@/components/v3c/community/LegalFrame";
import { TermsBody } from "@/app/terms/TermsBody";

export const metadata: Metadata = {
  title: "Terms of Service | BetRedge",
  description:
    "Terms of Service for BetRedge: accounts, plans, payments, and acceptable use.",
  alternates: { canonical: "/terms" },
};

export default async function Page() {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <V3cFrame>
        <V3cLegalFrame kind="terms">
          <TermsBody />
        </V3cLegalFrame>
      </V3cFrame>
    </>
  );
}
