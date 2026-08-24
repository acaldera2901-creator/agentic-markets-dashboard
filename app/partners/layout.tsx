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
          "Some of those platforms are commercial partners, and the links to them are affiliate links. The list is restricted by country: what appears below depends on where the page is opened from, and in a large part of the world nothing appears at all.",
        ]}
        faq={[
          [
            "Why is this page sometimes empty?",
            "The partner list is restricted by country and fails closed. If the country cannot be established, or the country is one where these links are not permitted, nothing is shown. An empty page here is the gate working, not a fault.",
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
