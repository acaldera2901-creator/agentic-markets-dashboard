// /v3c/leaderboard — leaderboard v3c (stessa API) (#REDESIGN-V3C pages). NON è un URL pubblico: con
// NEXT_PUBLIC_REDESIGN acceso next.config.ts riscrive "/leaderboard" qui (beforeFiles,
// lib/v3c/pages-routes.ts; l'URL nel browser non cambia); spento risponde 404 e la
// pagina di oggi resta intatta. Metadata identici a quelli di oggi (test in
// app/v3c/v3c-pages-routes.test.tsx): una rewrite serve i metadata della destinazione.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cLeaderboard } from "@/components/v3c/community/Leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard | BetRedge",
  description:
    "The BetRedge community leaderboard: how members rank over time, updated as predictions settle.",
  alternates: { canonical: "/leaderboard" },
};

export default async function Page() {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Leaderboard", "/leaderboard"]])} />
      <V3cFrame>
        <V3cLeaderboard />
      </V3cFrame>
    </>
  );
}
