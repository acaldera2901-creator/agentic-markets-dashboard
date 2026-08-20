// #SEO-PACK-0810: la pagina è client e non può esportare metadata — il layout
// di segmento (server) porta title/description propri (prima ereditava i
// duplicati del root e una description italiana sotto lang="en"), canonical
// e breadcrumb. Il contenuto resta geo-gated fail-closed: qui solo metadata.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";

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
    </>
  );
}
