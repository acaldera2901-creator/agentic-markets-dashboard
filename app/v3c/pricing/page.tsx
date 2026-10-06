// /v3c/pricing — Free e Pro (#REDESIGN-V3C F8-UI · filone pages). URL pubblica
// /pricing, NUOVA: esiste solo a flag acceso (rewrite /pricing → qui, e /plans →
// /pricing 308). Spento: /pricing è il 404 di sempre, /plans la tab Piani di sempre.
// Prezzo e rail dalle fonti (lib/v3c/plans.ts); il checkout resta quello della
// Dashboard. ISR orario: la sola cosa che dipende dal tempo è la scadenza della promo.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cPricing } from "@/components/v3c/pages/Pricing";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { checkoutRails, launchPromo, proPlan } from "@/lib/v3c/plans";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Free and Pro: Plans and Pricing | BetRedge",
  description:
    "Free shows the market price, our estimate and the signed gap on every match, plus the full record. Pro adds why the model disagrees.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  if (!v3cProductOn()) notFound();
  const env = process.env as Record<string, string | undefined>;
  const plan = proPlan(env);
  const promo = launchPromo(env, new Date());
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Plans and Pricing", "/pricing"]])} />
      <V3cFrame current="pro">
        <V3cPricing
          monthly={plan.monthly}
          annual={plan.annual}
          rails={checkoutRails(env)}
          promoUntil={promo?.until ?? null}
        />
      </V3cFrame>
    </>
  );
}
