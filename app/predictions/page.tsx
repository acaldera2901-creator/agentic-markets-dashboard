// #URL-PATHS-0810: path inglese della tab "bets" del desk (ex /app?tab=bets).
// #SEO-PACK-0810: title senza em-dash, description propria, breadcrumb.
// #SEO-AEO-1106: la board e' client-rendered; sotto vanno le prossime partite in HTML + JSON-LD SportsEvent (fatti pubblici, niente gated).
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { UpcomingMatches } from "@/components/seo/UpcomingMatches";
import { fetchUpcomingMatches } from "@/lib/seo/upcoming-matches";
import { RelatedTools } from "@/components/seo/RelatedTools";
import { SeoProse } from "@/components/seo/SeoProse";
import { PREDICTIONS_FAQ, PREDICTIONS_INTRO } from "@/lib/seo/predictions-faq";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Football & Tennis Predictions: Model vs Market | BetRedge",
  description: "Today's football and tennis predictions: the model's probability next to the market's, with the reasoning behind each gap. Analysis, not a guarantee.",
  alternates: { canonical: "/predictions" },
};

// ISR: the list is refreshed every 10 minutes, not per request (this page is the busiest one).
export const revalidate = 600;

export default async function PredictionsPage() {
  const matches = await fetchUpcomingMatches();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Predictions", "/predictions"]])} />
      <Dashboard initialTab="bets" />
      <UpcomingMatches matches={matches} />
      <SeoProse heading="How to read a BetRedge prediction" intro={PREDICTIONS_INTRO} faq={PREDICTIONS_FAQ} />
      <RelatedTools />
    </>
  );
}
