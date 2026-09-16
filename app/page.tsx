// #SEO-PACK-0810: wrapper server della landing — la pagina client vive in
// landing-client.tsx (colocato, non-rotta); qui solo metadata con il canonical
// di "/", che in un client component non si può esportare.
// #CONVERSION-FAQ-0916: FAQPage JSON-LD della sezione FAQ in home. Le stesse
// sei domande sono renderizzate visibili in landing-client (lib/home-faq.ts è
// l'unica fonte) — una FAQ schema senza risposta visibile è rischio manual action.
import type { Metadata } from "next";
import { JsonLd, faqJsonLd } from "@/components/seo/json-ld";
import { HOME_FAQ } from "@/lib/home-faq";
import LandingPage from "./landing-client";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqJsonLd(HOME_FAQ.en.map(([q, a]) => [q, a]), "en")} />
      <LandingPage />
    </>
  );
}
