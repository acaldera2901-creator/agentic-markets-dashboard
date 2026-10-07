// /v3c/community — Creator Picks in v3c: stessa API /api/match-builder, stesso
// lock, stessi link ?mb=&ref=.
// (#REDESIGN-V3C pages) NON è un URL pubblico: con NEXT_PUBLIC_REDESIGN acceso
// next.config.ts riscrive la URL di oggi qui (beforeFiles, lib/v3c/pages-routes.ts;
// l'URL nel browser non cambia); spento risponde 404 e la pagina di oggi resta
// intatta. Metadata identici a quelli di oggi (app/v3c/v3c-pages-routes.test.tsx).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/components/seo/json-ld";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cCommunity } from "@/components/v3c/community/Community";
import { COMMUNITY_SEO_V3C as COMMUNITY_SEO } from "@/app/community/seo";

// metadata e breadcrumb: quelli di app/community/layout.tsx (che qui non si applica)
export const metadata: Metadata = {
  title: "Creator Picks and Community | BetRedge",
  description:
    "Accumulators built by the BetRedge community with the Match Builder, each leg carrying the model's own probability.",
  alternates: { canonical: "/community" },
  // fixui2 N5: held for the legal review (docs/redesign/fixui2-legal-hold.md) — out of the index and the
  // v3c sitemap, no internal link. Only this v3c route (flag on): today's page is untouched.
  robots: { index: false, follow: false },
};

/** La prosa SEO del layout in v3c, prima del footer: stesso array, stesso FAQPage JSON-LD. h2: la fascia è l'h1. */
function V3cCommunitySeo() {
  return (
    <section className="v3c-wrap v3c-faq v3c-prose" aria-labelledby="cm-seo-h">
      <JsonLd data={faqJsonLd(COMMUNITY_SEO.faq, "en")} />
      <h2 className="v3c-t-sec" id="cm-seo-h">
        {COMMUNITY_SEO.heading}
      </h2>
      {COMMUNITY_SEO.intro.map((p) => (
        <p key={p.slice(0, 40)}>{p}</p>
      ))}
      {COMMUNITY_SEO.faq.map(([q, a]) => (
        <div key={q} className="v3c-faq-i">
          <h3 className="v3c-t-row">{q}</h3>
          <p>{a}</p>
        </div>
      ))}
    </section>
  );
}

export default async function Page() {
  if (!v3cProductOn()) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Creator Picks", "/community"]])} />
      <V3cFrame>
        <V3cCommunity />
        <V3cCommunitySeo />
      </V3cFrame>
    </>
  );
}
