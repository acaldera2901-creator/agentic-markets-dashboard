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
import { PARTNERS_SEO_FAQ, PARTNERS_SEO_HEADING, PARTNERS_SEO_INTRO } from "./seo";
// #REDESIGN-V3C pages: prosa e FAQ vivono in ./seo.ts (stesso testo) perché le
// usa anche app/v3c/partners (servita da una rewrite a flag acceso).

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
      <SeoProse heading={PARTNERS_SEO_HEADING} headingLevel="h1" intro={PARTNERS_SEO_INTRO} faq={PARTNERS_SEO_FAQ} />
    </>
  );
}
