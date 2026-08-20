// #URL-PATHS-0810: path inglese della tab "plans" (ex /app?tab=plans e l'alias
// legacy ?tab=account). #SEO-PACK-0810: title senza em-dash, description, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Plans and Pricing | BetRedge",
  description: "Compare BetRedge Base and Pro subscriptions: what each plan unlocks, current pricing, and how the Weekly Pick fits in.",
  alternates: { canonical: "/plans" },
};

export default function PlansPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Plans and Pricing", "/plans"]])} />
      <Dashboard />
    </>
  );
}
