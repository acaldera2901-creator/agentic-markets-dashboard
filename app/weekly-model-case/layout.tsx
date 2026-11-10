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
  title: "Weekly Model Case: The Weekly Combination Model | BetRedge",
  description: "A weekly combination of eligible model selections, with estimated probabilities and recorded results.",
  alternates: { canonical: "/weekly-model-case" },
};

export default function WeeklyPickLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Weekly Model Case", "/weekly-model-case"]])} />
      {children}
      <SeoProse
        heading="What the Weekly Model Case is"
        intro={[
          "The Weekly Model Case combines eligible football and tennis predictions into one case. Availability depends on qualifying predictions and selection rules. A case can build during the week; purchase opens once its selections are complete. Published cases record the selections, probabilities and kickoff times.",
          "The combined probability is the product of the individual model estimates, assuming independent outcomes. It estimates all selections landing together under that assumption; correlations and model error can change the actual chance. Three selections at 80 percent each give approximately 51 percent. This is not a guarantee.",
        ]}
        faq={[
          [
            "How are the selections chosen?",
            "The system selects from eligible football and tennis predictions, subject to probability, availability and diversification rules. This is not an unrestricted ranking of every covered outcome.",
          ],
          [
            "What does the combined probability actually mean?",
            "It is the product of the individual model probabilities, assuming independent outcomes. It is an estimate, not a guarantee; correlated outcomes can make the actual joint probability different.",
          ],
          [
            "Is the result published afterwards?",
            "The page shows up to eight previous cases from the current track-record period, beginning 7 September 2026, including unsuccessful cases. Results depend on recorded settlements, so some selections may remain unresolved. Earlier product versions are excluded by date.",
          ],
          [
            "Do I need a subscription?",
            "The Weekly Model Case is included in the Pro plan. Without a plan it can be unlocked one week at a time.",
          ],
        ]}
      />
    </>
  );
}
