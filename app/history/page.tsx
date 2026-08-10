// #URL-PATHS-0810: path inglese della tab "history" del desk (ex /app?tab=history).
// #SEO-PACK-0810: title senza em-dash, description propria, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Track Record | BetRedge",
  description: "Every settled BetRedge prediction, graded and archived. Browse past picks match by match and see how each call was reasoned.",
  alternates: { canonical: "/history" },
};

export default function HistoryPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Track Record", "/history"]])} />
      <Dashboard />
    </>
  );
}
