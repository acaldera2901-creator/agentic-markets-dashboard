// #URL-PATHS-0810: path inglese della tab "bets" del desk (ex /app?tab=bets).
// #SEO-PACK-0810: title senza em-dash, description propria, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Predictions | BetRedge",
  description: "Live football and tennis predictions with calibrated probabilities, confidence bands, and the reasoning behind every number.",
  alternates: { canonical: "/predictions" },
};

export default function PredictionsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Predictions", "/predictions"]])} />
      <Dashboard initialTab="bets" />
    </>
  );
}
