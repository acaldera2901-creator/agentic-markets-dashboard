// components/tools/ToolShell.tsx (#TOOLS-HUB-0805)
// Impaginazione di una pagina-tool: calcolatore sopra la piega, poi formula,
// spiegazione, FAQ, gli altri tool e UN blocco CTA. Server component — solo il
// calcolatore ha bisogno del browser.

import Link from "next/link";
import SiteTopbar from "@/components/world-cup/SiteTopbar";
import { SiteFooter } from "@/components/SiteFooter";
import { getToolsCopy } from "@/lib/tools/copy";
import { TOOL_SLUGS, toolPath, type ToolLocale, type ToolSlug } from "@/lib/tools/registry";
import { toolJsonLd } from "@/lib/tools/seo";
import { ToolCalculator } from "./ToolCalculator";
import { LocalePicker } from "./LocalePicker";

export function ToolShell({ slug, locale }: { slug: ToolSlug; locale: ToolLocale }) {
  const copy = getToolsCopy(locale);
  const t = copy.tools[slug];
  const others = TOOL_SLUGS.filter((s) => s !== slug);

  return (
    <div className="portal-root tl-root">
      <SiteTopbar backHref="/" backLabel={copy.common.backLabel} hideLang />
      <main className="tl-page">
        <header className="tl-head">
          <div className="tl-eyebrow">
            <span className="tl-free">{copy.common.free}</span>
            <span>BetRedge</span>
          </div>
          <h1>{t.h1}</h1>
          <p className="tl-lede">{t.lede}</p>
          <LocalePicker slug={slug} locale={locale} label={copy.common.langLabel} />
        </header>

        <ToolCalculator slug={slug} copy={t} dash={copy.common.invalid} />

        <section className="tl-section">
          <h2>{t.formulaTitle}</h2>
          <div className="tl-formula">
            <code>{t.formula.join("\n")}</code>
          </div>
        </section>

        <section className="tl-section tl-prose">
          <h2>{t.explainerTitle}</h2>
          {t.explainer.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section className="tl-section">
          <h2>{copy.common.faqTitle}</h2>
          <div className="tl-faq">
            {t.faq.map((f, i) => (
              <div className="tl-faq-item" key={i}>
                <p className="tl-faq-q">{f.q}</p>
                <p className="tl-faq-a">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="tl-section">
          <h2>{copy.common.otherTools}</h2>
          <div className="tl-others">
            {others.map((s) => (
              <Link key={s} href={toolPath(s, locale)}>
                {copy.tools[s].h1}
              </Link>
            ))}
          </div>
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
        // Dati strutturati generati da noi da stringhe del dizionario: nessun
        // input utente entra in questo JSON.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd(slug, locale)) }}
      />
    </div>
  );
}
