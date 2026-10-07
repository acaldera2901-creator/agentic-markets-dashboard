// /v3c/pricing — Free e Pro (#REDESIGN-V3C F8-UI · filone pages). URL pubblica
// /pricing, NUOVA: esiste solo a flag acceso (rewrite /pricing → qui, e /plans →
// /pricing 308). Spento: /pricing è il 404 di sempre, /plans la tab Piani di sempre.
// fixui Fase 0: Pro non è in vendita — solo il prezzo annunciato (lib/v3c/plans.ts → commercial-plan),
// nessun checkout, nessun rail, nessuna promo. ISR orario.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cPricing } from "@/components/v3c/pages/Pricing";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { proPlan } from "@/lib/v3c/plans";
import { EN_TITLES } from "@/lib/v3c/doc-titles";

export const revalidate = 3600;

// fixui Fase 0 (DECISIONI-FREE-PRO §f): Pro non è in vendita, la pagina non lo vende né promette
// il «perché» (non esiste ancora in nessuna pagina partita).
export const metadata: Metadata = {
  title: EN_TITLES.pricing,
  description:
    "Free shows the market price, our estimate and the signed gap on every match, plus the full record. Pro is in preview: its features are open to everyone during the launch.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  if (!v3cProductOn()) notFound();
  const env = process.env as Record<string, string | undefined>;
  const plan = proPlan(env);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Plans", "/pricing"]])} />
      <V3cFrame current="pro">
        <V3cPricing monthly={plan.monthly} />
      </V3cFrame>
    </>
  );
}
