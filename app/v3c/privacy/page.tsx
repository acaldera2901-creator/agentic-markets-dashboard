// /v3c/privacy — solo la cornice cambia: il testo legale è lo stesso componente (#REDESIGN-V3C pages). NON è un URL pubblico: con
// NEXT_PUBLIC_REDESIGN acceso next.config.ts riscrive "/privacy" qui (beforeFiles,
// lib/v3c/pages-routes.ts; l'URL nel browser non cambia); spento risponde 404 e la
// pagina di oggi resta intatta. Metadata identici a quelli di oggi (test in
// app/v3c/v3c-pages-routes.test.tsx): una rewrite serve i metadata della destinazione.
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cLegalFrame } from "@/components/v3c/community/LegalFrame";
import { PrivacyBody } from "@/app/privacy/PrivacyBody";

export const metadata: Metadata = {
  title: "Privacy Policy | BetRedge",
  description: "Privacy Policy and GDPR information for BetRedge.",
  alternates: { canonical: "/privacy" },
};

export default async function Page() {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <V3cFrame>
        <V3cLegalFrame kind="privacy">
          <PrivacyBody />
        </V3cLegalFrame>
      </V3cFrame>
    </>
  );
}
