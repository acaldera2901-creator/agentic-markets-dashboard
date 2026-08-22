// #URL-PATHS-0810: path inglese della tab "match-builder" (copre anche il legacy
// ?tab=builder). #SEO-PACK-0810: title senza em-dash, description, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Match Builder | BetRedge",
  description: "Combine model predictions into a custom slip and see the combined probability calculated honestly, selection by selection.",
  alternates: { canonical: "/match-builder" },
};

export default function MatchBuilderPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Match Builder", "/match-builder"]])} />
      <Dashboard initialTab="match-builder" />
    </>
  );
}
