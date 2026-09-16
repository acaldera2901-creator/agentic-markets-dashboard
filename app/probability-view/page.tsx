// #CONVERSION-ROUTES-0916: /probability-view (ex /match-builder, redirect 308 in next.config).
// #URL-PATHS-0810: path inglese della tab "match-builder" (copre anche il legacy
// ?tab=builder). #SEO-PACK-0810: title senza em-dash, description, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Build a Probability View | BetRedge",
  description: "Combine model predictions into a custom slip and see the combined probability calculated honestly, selection by selection.",
  alternates: { canonical: "/probability-view" },
};

export default function MatchBuilderPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Build a Probability View", "/probability-view"]])} />
      <Dashboard initialTab="match-builder" />
    </>
  );
}
