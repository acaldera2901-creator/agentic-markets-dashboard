// #SEO-PACK-0810: la pagina è client e non può esportare metadata — il layout
// di segmento (server) porta title/description propri, canonical e breadcrumb.
import type { Metadata } from "next";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";

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
    </>
  );
}
