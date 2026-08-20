// #SEO-PACK-0810: la pagina è client e non può esportare metadata — il layout
// di segmento (server) porta title/description propri, canonical e breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Creator Picks and Community | BetRedge",
  description: "Slips published by BetRedge creators with the Match Builder. Browse community picks and build your own from the same model.",
  alternates: { canonical: "/community" },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Creator Picks", "/community"]])} />
      {children}
    </>
  );
}
