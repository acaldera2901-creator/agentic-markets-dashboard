// #URL-PATHS-0810: path inglese della tab "invita" (referral, ex /app?tab=invita).
// #SEO-PACK-0810: title senza em-dash, description propria, breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import Dashboard from "../app/page";

export const metadata: Metadata = {
  title: "Invite Friends | BetRedge",
  description: "Invite friends to BetRedge and unlock rewards as they join. Track your referrals from one panel.",
  alternates: { canonical: "/invite" },
};

export default function InvitePage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Invite Friends", "/invite"]])} />
      <Dashboard initialTab="invita" />
    </>
  );
}
