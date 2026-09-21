// #RESTYLING-0921 round 2 — la vecchia landing, su un URL che dice cosa è.
//
// Da quando "/" porta direttamente nel prodotto (app/page.tsx), il contenuto
// informativo della landing non ha più una porta: anatomia di una lettura,
// cosa contiene un piano, i prezzi reali, le guide, la FAQ. Buttarlo sarebbe
// stato il modo più rapido di perdere 1182 righe di copy verificato e i suoi
// link interni, quindi vive qui, INVARIATO — `landing-client.tsx` non è stato
// toccato (lo sorveglia per nome anche lib/landing-claims.test.ts).
//
// Ci arriva la CTA secondaria dell'hero, «How it works».
//
// Il FAQPage JSON-LD NON è qui: sta su "/", dove le stesse risposte sono ora
// renderizzate visibili (components/lobby/HomeFaq.tsx). Dichiararlo su due URL
// significherebbe far scegliere a Google quale delle due pagine è la FAQ.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import LandingPage from "../landing-client";

export const metadata: Metadata = {
  title: "How it works | BetRedge",
  description:
    "What a BetRedge reading contains, how the model's probability is compared with the market's, what each plan opens, and what BetRedge does not do.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["How it works", "/how-it-works"]])} />
      <LandingPage />
    </>
  );
}
