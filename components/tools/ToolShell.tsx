// components/tools/ToolShell.tsx (#TOOLS-HUB-0805)
// Impaginazione di una pagina-tool: calcolatore sopra la piega, la frase chiave,
// la spiegazione, l'esempio numerico, le FAQ, gli altri tool e UN blocco CTA.
// Server component — solo il calcolatore ha bisogno del browser.
//
// I blocchi formula sono stati rimossi da tutte le pagine (Andrea, 2026-08-05):
// una riga di simboli non la legge nessuno, un esempio con numeri veri sì.

import Link from "next/link";
import SiteTopbar from "@/components/world-cup/SiteTopbar";
import { SiteFooter } from "@/components/SiteFooter";
import { getToolsCopy } from "@/lib/tools/copy";
import { TOOL_SLUGS, chromeLang, toolPath, type ToolLocale, type ToolSlug } from "@/lib/tools/registry";
import { toolJsonLd } from "@/lib/tools/seo";
import { ToolCalculator } from "./ToolCalculator";
import { ToolSaveScope } from "./ToolSaveScope";
import { LocalePicker } from "./LocalePicker";
import { Prose } from "./Prose";
import { ToolIcon } from "./ToolIcon";

export function ToolShell({ slug, locale }: { slug: ToolSlug; locale: ToolLocale }) {
  const copy = getToolsCopy(locale);
  const t = copy.tools[slug];
  const others = TOOL_SLUGS.filter((s) => s !== slug);

  return (
    <div className="portal-root tl-root">
      <SiteTopbar backHref="/" backLabel={copy.common.backLabel} hideLang lang={chromeLang(locale)} />
      <main className="tl-page">
        <header className="tl-head tl-head--tool">
          {/* L'icona identifica il tool a colpo d'occhio e lega la pagina al rail
              e alla card dell'hub: stesso oggetto, tre posti. */}
          <ToolIcon slug={slug} size={72} className="tl-head-ic" />
          <div className="tl-head-txt">
            <div className="tl-eyebrow">
              <span className="tl-free">{copy.common.free}</span>
              <span>BetRedge</span>
            </div>
            <h1>{t.h1}</h1>
            <p className="tl-lede">{t.lede}</p>
            <LocalePicker slug={slug} locale={locale} label={copy.common.langLabel} />
          </div>
        </header>

        {/* #TOOLS-SAVE-0810: lo scope avvolge il calcolatore senza modificarlo e
            gli aggiunge la riga "salva questo calcolo" — un link per l'anonimo,
            un salvataggio vero per chi è loggato. */}
        <ToolSaveScope slug={slug} copy={copy.common}>
          <ToolCalculator slug={slug} copy={t} dash={copy.common.invalid} />
        </ToolSaveScope>

        {/* La frase chiave subito sotto il calcolatore: chi non scorre oltre ha
            comunque capito a cosa serve la pagina. */}
        <p className="tl-takeaway">{t.takeaway}</p>

        <section className="tl-section tl-prose">
          <h2>{t.explainerTitle}</h2>
          <Prose paragraphs={t.explainer} />
        </section>

        {/* L'esempio chiude la spiegazione: prima il perché, poi i numeri veri.
            Ha preso il posto del blocco formula su tutte le pagine. */}
        <section className="tl-section">
          <h2>{t.example.title}</h2>
          <div className="tl-example">
            <dl className="tl-example-rows">
              {t.example.rows.map((r, i) => (
                <div className="tl-example-row" key={i}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
            <p className="tl-example-note">{t.example.note}</p>
          </div>
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
                <ToolIcon slug={s} size={22} />
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
      <SiteFooter lang={chromeLang(locale)} />
      <script
        type="application/ld+json"
        // Dati strutturati generati da noi da stringhe del dizionario: nessun
        // input utente entra in questo JSON.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd(slug, locale)) }}
      />
    </div>
  );
}
