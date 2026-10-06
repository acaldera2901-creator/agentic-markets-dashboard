// #SEO-PACK-0810: la pagina è client e non può esportare metadata — il layout
// di segmento (server) porta title/description propri, canonical e breadcrumb.
//
// #SEO-AEO-0825: 63 parole servite, e per giunta in italiano sotto lang="en"
// (il default del render è passato a "en" nella page). Le schedine dei creator
// sono incluse nei piani a pagamento e restano client: qui sotto va solo la
// parte evergreen, che spiega cosa sono e come nascono.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { SeoProse } from "@/components/seo/SeoProse";
import { COMMUNITY_SEO } from "./seo";

export const metadata: Metadata = {
  title: "Creator Picks and Community | BetRedge",
  description: "Accumulators built by the BetRedge community with the Match Builder, each leg carrying the model's own probability.",
  alternates: { canonical: "/community" },
};

// #REDESIGN-V3C pages: prosa e FAQ vivono in ./seo.ts (stesso testo) perché le
// usa anche app/v3c/community (servita da una rewrite a flag acceso).
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Creator Picks", "/community"]])} />
      {children}
      <SeoProse heading={COMMUNITY_SEO.heading} intro={COMMUNITY_SEO.intro} faq={COMMUNITY_SEO.faq} />
    </>
  );
}
