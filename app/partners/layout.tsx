// #SEO-PACK-0810: la pagina è client e non può esportare metadata — il layout
// di segmento (server) porta title/description propri (prima ereditava i
// duplicati del root e una description italiana sotto lang="en"), canonical
// e breadcrumb. Il contenuto resta geo-gated fail-closed.
//
// #SEO-AEO-0825: l'HTML servito non aveva NESSUN h1 e 65 parole in tutto,
// perché nello stato di caricamento la pagina rende un div vuoto. Qui sopra il
// gate va la parte che non è gattata: cos'è BetRedge, perché la lista può
// essere vuota, e la disclosure sugli affiliati. Nessun nome di partner esce
// dal server: quello resta dietro il gate geo, che è il motivo per cui esiste.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { SeoProse } from "@/components/seo/SeoProse";

export const metadata: Metadata = {
  title: "Partners and Integrations | BetRedge",
  description: "The platforms and operators BetRedge works with, and what each one contributes.",
  alternates: { canonical: "/partners" },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Partners", "/partners"]])} />
      {children}
      <SeoProse
        heading="Partners and integrations"
        headingLevel="h1"
        intro={[
          "BetRedge is a predictions and analytics product. It publishes a probability and the reasoning behind it for every match it covers. It does not take bets, does not hold customer funds, and does not operate any of the platforms listed on this page.",
          // #GEO-PARTNERS-ALWAYS-0917 / #CASEA-ALWAYS-0917 (17/09) — questa frase
          // diceva "the list is restricted by country: what appears below depends on
          // where the page is opened from". Da oggi è FALSA: la vetrina mostra gli
          // stessi partner ovunque, e il paese decide solo QUALE link apre chi ha una
          // registrazione localizzata (oggi il solo Casea). Il gate che resta è quello
          // sull'intera pagina, non sul singolo partner — ed è quello che la FAQ sotto
          // descrive.
          // #PARTNER-BETWINNER-0924 — "the same partners wherever" è tornata FALSA per
          // un caso: BetWinner ha un tracking link solo per 9 mercati e nessun link
          // neutro, quindi fuori di lì non c'è niente da aprire e la sua card non c'è.
          // Questa frase e la FAQ sotto finiscono nel JSON-LD (FAQPage): una frase
          // falsa qui è una dichiarazione falsa in structured data, non una svista di
          // copy. Si riscrive con la regola vera, non col caso particolare.
          "Some of those platforms are commercial partners, and the links to them are affiliate links. Nearly all of them are listed wherever the page is opened from; where an operator runs a country-specific sign-up page, the link points at that country's one, and an operator that only runs sign-up pages for a few countries is listed in those countries only.",
        ]}
        faq={[
          [
            "Why is this page sometimes empty?",
            "The page as a whole is geo-gated and fails closed: if the location check cannot be completed, or the links are not permitted where the page is opened from, nothing is shown at all. An empty page here is the gate working, not a fault. An operator whose sign-up page only exists for a few countries is listed in those countries only, so the list can be one entry shorter elsewhere.",
          ],
          [
            "Does BetRedge take bets?",
            "No. BetRedge publishes probabilities, confidence and the reasoning behind each call. Placing a bet happens elsewhere, on a platform BetRedge does not run.",
          ],
          [
            "Are the partner links paid?",
            "Yes. Partner links are commercial affiliate links. That is disclosed on every page that carries one, including this one.",
          ],
          [
            "Can a site embed BetRedge predictions?",
            "Yes. BetRedge publishes an embeddable widget that renders current picks on a third-party site with a single script tag.",
          ],
        ]}
      />
    </>
  );
}
