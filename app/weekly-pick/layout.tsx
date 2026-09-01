// #SEO-PACK-0810: la pagina è client e non può esportare metadata — il layout
// di segmento (server) porta title/description propri, canonical e breadcrumb.
//
// #SEO-AEO-0825: l'HTML servito si fermava a 54 parole, perché la schedina vera
// arriva dal client ed è a pagamento. Sotto il prodotto va la parte evergreen e
// non pagata: cos'è la Weekly Pick e cosa significa la probabilità combinata.
// La pick della settimana NON esce dal server: è contenuto venduto.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { SeoProse } from "@/components/seo/SeoProse";

export const metadata: Metadata = {
  title: "Weekly Pick: The House Accumulator | BetRedge",
  description: "One accumulator every Monday: the model's highest probability picks combined into a single slip, with the combined probability shown honestly.",
  alternates: { canonical: "/weekly-pick" },
};

export default function WeeklyPickLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Weekly Pick", "/weekly-pick"]])} />
      {children}
      <SeoProse
        heading="What the Weekly Pick is"
        intro={[
          "The Weekly Pick is one accumulator, published every Monday and settled at the end of the week. The BetRedge model scores every football and tennis match it covers on form, expected goals, absences, rest, travel and match context, then ranks the outcomes by probability. The highest-probability selections are combined into a single slip.",
          "The number the page leads with is the combined probability: the chance that every leg lands, not the chance that any one of them does. It is the product of the individual probabilities, so it is always lower than the weakest leg. Four selections at 80 percent each combine to roughly 41 percent. Stating that plainly is the point of the page.",
        ]}
        faq={[
          [
            "How are the selections chosen?",
            "By the model, not by a person. It ranks every fixture it covers by the probability of each outcome, and the slip takes the highest-probability selections across the sports in coverage that week.",
          ],
          [
            "What does the combined probability actually mean?",
            "It is the model's estimate of all legs landing together. It is an estimate, not a guarantee, and it is deliberately shown even when it is low, because an accumulator with a high headline return is usually an accumulator with a low probability.",
          ],
          [
            "Is the result published afterwards?",
            "Yes. Each week's slip is graded once the matches finish and stays on the page whether it landed or not. Weeks that did not land are not removed.",
          ],
          [
            "Do I need a subscription?",
            "The Weekly Pick is included in the Pro plan. Without a plan it can be unlocked one week at a time.",
          ],
        ]}
      />
    </>
  );
}
