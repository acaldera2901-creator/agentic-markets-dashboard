// #RESTYLING-0921 round 2 — "/" È IL PRODOTTO, non una pagina di vendita.
//
// Decisione di Andrea (sezione 4 di docs/redesign-brief-digest.md): chi arriva
// sul sito entra direttamente nella Home/lobby — hero, fasce, tile per sport —
// anche da anonimo. La landing marketing non è più la porta d'ingresso.
//
// COME, e perché così. "/" rende lo STESSO componente di /predictions
// (`Dashboard`, con la sua tab `bets`), non una nuova Home: una seconda
// implementazione della stessa schermata divergerebbe entro una settimana. La
// barra URL resta "/" finché si sta sulla lobby e segue la tab da lì in avanti
// (l'effetto #URL-PATHS-0810 in app/app/page.tsx).
//
// COSA NE È DELLA LANDING. Non è cancellata: `landing-client.tsx` è viva e
// servita da /how-it-works, dove punta la CTA secondaria dell'hero. Le sue
// 1182 righe di contenuto informativo — anatomia di una lettura, prezzi reali,
// guide, FAQ — restano indicizzabili, su un URL che dice cosa sono.
//
// SEO: i tre segnali che c'erano, e dove sono finiti.
//   · canonical "/"   → resta qui invariato. "/" è ancora l'URL forte del
//                       sito, e ora ci sta il prodotto.
//   · description     → aggiunta. Prima "/" non ne aveva una propria: ereditava
//                       quella del layout, scritta per la landing.
//   · FAQPage JSON-LD → resta su "/", ma NON da solo: le sei risposte sono
//                       renderizzate visibili in coda alla lobby
//                       (components/lobby/HomeFaq.tsx, dalla stessa unica fonte
//                       lib/home-faq.ts). Uno schema senza risposta visibile è
//                       rischio manual action — era la nota di questo stesso
//                       file quando su "/" stava la landing, e vale ancora.
import type { Metadata } from "next";
import { JsonLd, faqJsonLd } from "@/components/seo/json-ld";
import { HOME_FAQ } from "@/lib/home-faq";
import Dashboard from "./app/page";

export const metadata: Metadata = {
  description:
    "Football and tennis predictions: the model's calibrated probability next to the market's, the edge between the two, and the reasoning behind every number. Readable before you sign up.",
  alternates: { canonical: "/" },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqJsonLd(HOME_FAQ.en.map(([q, a]) => [q, a]), "en")} />
      <Dashboard initialTab="bets" />
    </>
  );
}
