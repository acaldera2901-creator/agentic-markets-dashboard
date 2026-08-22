// #URL-PATHS-0810: path inglese della tab "leaderboard" (ex /app?tab=leaderboard).
// #SEO-PACK-0810: title senza em-dash, description propria, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Leaderboard | BetRedge",
  description: "The BetRedge community leaderboard: how members rank over time, updated as predictions settle.",
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Leaderboard", "/leaderboard"]])} />
      <Dashboard initialTab="leaderboard" />
    </>
  );
}
