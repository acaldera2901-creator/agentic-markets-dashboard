// components/tools/ToolsHub.tsx (#TOOLS-HUB-0805)
// L'hub: cosa sono questi tool, le cinque card, un CTA. Nessun calcolatore qui —
// la pagina che deve classificarsi su "free betting tools" ha il compito di
// mandare l'utente sul tool giusto, non di fare i conti al posto di quello.

import Link from "next/link";
import SiteTopbar from "@/components/world-cup/SiteTopbar";
import { SiteFooter } from "@/components/SiteFooter";
import { getToolsCopy } from "@/lib/tools/copy";
import { TOOL_SLUGS, chromeLang, toolPath, type ToolLocale } from "@/lib/tools/registry";
import { hubJsonLd } from "@/lib/tools/seo";
import { LocalePicker } from "./LocalePicker";
import { ToolIcon } from "./ToolIcon";
import { MenuIcon } from "@/app/components/menu-icon";

export function ToolsHub({ locale }: { locale: ToolLocale }) {
  const copy = getToolsCopy(locale);

  return (
    <div className="portal-root tl-root">
      <SiteTopbar backHref="/" backLabel={copy.common.backLabel} hideLang lang={chromeLang(locale)} />
      <main className="tl-page">
        <header className="tl-head tl-head--tool">
          {/* Stessa calcolatrice della voce "Strumenti" nel rail: l'hub si
              riconosce come la destinazione di quel menu. */}
          <MenuIcon name="tools" size={72} className="tl-head-ic" />
          <div className="tl-head-txt">
            <div className="tl-eyebrow">
              <span className="tl-free">{copy.common.free}</span>
              <span>BetRedge</span>
            </div>
            <h1>{copy.hub.h1}</h1>
            <p className="tl-lede">{copy.hub.lede}</p>
            <LocalePicker locale={locale} label={copy.common.langLabel} />
          </div>
        </header>

        <div className="tl-grid">
          {TOOL_SLUGS.map((slug) => (
            <Link key={slug} href={toolPath(slug, locale)} className="tl-card">
              <span className="tl-card-head">
                <ToolIcon slug={slug} size={44} className="tl-card-ic" />
                <h2>{copy.tools[slug].h1}</h2>
              </span>
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
          <Link href="/predictions" className="tl-cta-btn">
            {copy.common.ctaButton}
          </Link>
        </aside>
      </main>
      <SiteFooter lang={chromeLang(locale)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hubJsonLd(locale)) }}
      />
    </div>
  );
}
