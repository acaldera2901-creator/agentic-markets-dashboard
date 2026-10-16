// #URL-PATHS-0810: path inglese della tab "plans" (ex /app?tab=plans e l'alias
// legacy ?tab=account). #SEO-PACK-0810: title senza em-dash, description, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Plans and Pricing | BetRedge",
  // #CLASSIC-PLANS-1014 — a flag acceso la pagina vende Free e Pro soltanto.
  description: process.env.NEXT_PUBLIC_CLASSIC === "1"
    ? "BetRedge Free or Pro: Free opens three readings per sport a day, Pro opens the whole board with the full analysis. Monthly or annual, cancel anytime."
    : "Compare BetRedge Base and Pro subscriptions: how deep each plan reads, current monthly pricing, and how the Weekly Model Case fits in.",
  alternates: { canonical: "/plans" },
};

export default function PlansPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Plans and Pricing", "/plans"]])} />
      <Dashboard initialTab="plans" />
    </>
  );
}
