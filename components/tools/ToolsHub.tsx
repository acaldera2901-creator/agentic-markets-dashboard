// components/tools/ToolsHub.tsx (#TOOLS-HUB-0805)
// L'hub: cosa sono questi tool, le cinque card, un CTA. Nessun calcolatore qui —
// la pagina che deve classificarsi su "free betting tools" ha il compito di
// mandare l'utente sul tool giusto, non di fare i conti al posto di quello.

import Link from "next/link";
import SiteTopbar from "@/components/world-cup/SiteTopbar";
import { SiteFooter } from "@/components/SiteFooter";
import { getToolsCopy } from "@/lib/tools/copy";
import { TOOL_SLUGS, toolPath, type ToolLocale } from "@/lib/tools/registry";
import { hubJsonLd } from "@/lib/tools/seo";
import { LocalePicker } from "./LocalePicker";

export function ToolsHub({ locale }: { locale: ToolLocale }) {
  const copy = getToolsCopy(locale);

  return (
    <div className="portal-root tl-root">
      <SiteTopbar backHref="/" backLabel={copy.common.backLabel} hideLang />
      <main className="tl-page">
        <header className="tl-head">
          <div className="tl-eyebrow">
            <span className="tl-free">{copy.common.free}</span>
            <span>BetRedge</span>
          </div>
          <h1>{copy.hub.h1}</h1>
          <p className="tl-lede">{copy.hub.lede}</p>
          <LocalePicker locale={locale} label={copy.common.langLabel} />
        </header>

        <div className="tl-grid">
          {TOOL_SLUGS.map((slug) => (
            <Link key={slug} href={toolPath(slug, locale)} className="tl-card">
              <h2>{copy.tools[slug].h1}</h2>
              <p>{copy.tools[slug].lede}</p>
              <span className="tl-card-cta">{copy.hub.cardCta} →</span>
            </Link>
          ))}
        </div>

        <section className="tl-section tl-prose">
          {copy.hub.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <aside className="tl-cta">
          <div className="tl-cta-body">
            <h2>{copy.common.ctaTitle}</h2>
            <p>{copy.common.ctaBody}</p>
          </div>
          <Link href="/app" className="tl-cta-btn">
            {copy.common.ctaButton}
          </Link>
        </aside>
      </main>
      <SiteFooter lang={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hubJsonLd(locale)) }}
      />
    </div>
  );
}
