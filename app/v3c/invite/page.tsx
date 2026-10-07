// /v3c/invite — invite v3c (stesse API e stati) (#REDESIGN-V3C pages). NON è un URL pubblico: con
// NEXT_PUBLIC_REDESIGN acceso next.config.ts riscrive "/invite" qui (beforeFiles,
// lib/v3c/pages-routes.ts; l'URL nel browser non cambia); spento risponde 404 e la
// pagina di oggi resta intatta. Metadata identici a quelli di oggi (test in
// app/v3c/v3c-pages-routes.test.tsx): una rewrite serve i metadata della destinazione.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cInvite } from "@/components/v3c/community/Invite";

export const metadata: Metadata = {
  title: "Invite Friends | BetRedge",
  description:
    "Invite friends to BetRedge and unlock rewards as they join. Track your referrals from one panel.",
  alternates: { canonical: "/invite" },
  // fixui2 N5: held for the legal review (docs/redesign/fixui2-legal-hold.md) — out of the index and the
  // v3c sitemap, no internal link. Only this v3c route (flag on): today's page is untouched.
  robots: { index: false, follow: false },
};

export default async function Page() {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Invite Friends", "/invite"]])} />
      <V3cFrame>
        <V3cInvite />
      </V3cFrame>
    </>
  );
}
