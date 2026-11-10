// #URL-PATHS-0810: path inglese della tab "history" del desk (ex /app?tab=history).
// #SEO-PACK-0810: title senza em-dash, description propria, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Track Record | BetRedge",
  description: "Browse available settled BetRedge predictions, their results and statistical context. Coverage and data sources are shown alongside the record.",
  alternates: { canonical: "/history" },
};

export default function HistoryPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Track Record", "/history"]])} />
      <Dashboard initialTab="history" />
    </>
  );
}
