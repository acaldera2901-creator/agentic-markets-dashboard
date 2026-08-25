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
  description: "Accumulators built by the BetRedge community with the Match Builder, each leg carrying the model's own probability.",
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
          "Creator Picks are accumulators assembled by BetRedge members using the Match Builder. The selections are chosen by a person; the probability attached to each leg, and to the slip as a whole, comes from the same model that prices every match on the board. Nothing about a creator slip changes the underlying numbers.",
          "This is the difference between this page and the Weekly Pick. The Weekly Pick is selected by the model. A creator slip is a person's reading of the same probabilities, published under their name and settled the same way.",
        ]}
        faq={[
          [
            "Who builds the Creator Picks?",
            "Community members, in the Match Builder. BetRedge does not assemble them and does not rank creators by profit or by returns.",
          ],
          [
            "Where do the probabilities come from?",
            "From the BetRedge model, unchanged. A creator picks the legs; the probability shown next to each one is the same number the model publishes for that match everywhere else on the site.",
          ],
          [
            "How is a creator slip different from the Weekly Pick?",
            "The Weekly Pick is the model's own selection, published once a week. A creator slip is a person's selection from the same set of probabilities, published whenever they build one.",
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
