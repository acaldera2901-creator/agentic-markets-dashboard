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

export const metadata: Metadata = {
  title: "Creator Picks and Community | BetRedge",
  description: "Creator-submitted slips and probabilities, with their source and independence assumption explained.",
  alternates: { canonical: "/community" },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Creator Picks", "/community"]])} />
      {children}
      <SeoProse
        heading="What Creator Picks are"
        intro={[
          "Creator Picks are slips published by community members. The server stores the selections and probabilities submitted by the publisher; it does not verify those values against current BetRedge model predictions. Treat them as creator-submitted snapshots.",
          "The combined percentage multiplies the submitted probabilities and assumes independent selections. That calculation is not valid for correlated or repeated selections. These community snapshots are separate from the platform’s recorded predictions and do not establish a verified performance record.",
        ]}
        faq={[
          [
            "Who builds the Creator Picks?",
            "Community members, in the Match Builder. BetRedge does not assemble them and does not rank creators by profit or by returns.",
          ],
          [
            "Where do the probabilities come from?",
            "They are submitted by the publisher. They may have been copied from a reading, but this page does not verify their source or freshness. The combined number assumes independent selections.",
          ],
          [
            "How is a creator slip different from the Weekly Pick?",
            "The Weekly Pick is published by BetRedge. Creator slips are submitted by members, with their own supplied selections and probabilities; they are not verified copies of the Weekly Pick or of board predictions.",
          ],
          [
            "Do I need a paid plan to see them?",
            "Creator Picks are included in the Base and Pro plans.",
          ],
        ]}
      />
    </>
  );
}
