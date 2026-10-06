// components/v3c/tools/ToolPage.tsx (#REDESIGN-V3C F5)
// La pagina di un tool v3c (DIRECTION-v3c §6): briciole, fascia, input
// precompilabili, risultato grande, formula, «la stessa matematica sul board di
// oggi», poi il contenuto che la pagina già aveva — frase chiave, spiegazione,
// esempio, FAQ (il JSON-LD FAQPage richiede che le domande siano nel documento),
// gli altri dieci tool a righe — e UNA uscita verso la board. Zero partner.
// Server Component; il calcolatore è l'isola client.
import { getToolsCopy } from "@/lib/tools/copy";
import { TOOL_SLUGS, hubPath, toolPath, type ToolLocale, type ToolSlug } from "@/lib/tools/registry";
import { toolJsonLd } from "@/lib/tools/seo";
import { getV3cToolsCopy, fmt } from "@/lib/i18n/v3c-tools";
import { toolBoardSource } from "@/lib/v3c/board-source.server";
import { toolDef, toolPreview } from "@/lib/v3c/tools";
import { v3cFontClass } from "../fonts";
import { BenchTool } from "../BenchTool";
import { SiteFrame } from "../Chrome";
import { Fascia } from "../Fascia";
import { V3cShell } from "../V3cShell";
import { BoardBridge } from "./BoardBridge";
import { PrefillNote, ToolCalc } from "./ToolCalc";
import "../v3c.css";

/** `**così**` → <strong>: un solo segno, come components/tools/Prose. */
function withBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

export async function V3cToolPage({ slug, locale }: { slug: ToolSlug; locale: ToolLocale }) {
  const copy = getToolsCopy(locale);
  const t = copy.tools[slug];
  const c = getV3cToolsCopy(locale);
  const tc = c.tools[slug];
  const def = toolDef(slug);
  const question = c.questions[def.question].q;

  const src = await toolBoardSource();
  const live = src.kind === "live" ? src.matches() : undefined;
  const m = src.matches()[0];
  const ctx = { outcomes: m.outcomes, lead: src.lead(m) };
  const others = TOOL_SLUGS.filter((s) => s !== slug);

  return (
    <V3cShell fontClass={v3cFontClass} lang={locale}>
      <SiteFrame current="tools" locale={locale} copy={c} slug={slug}>
      <main className="v3c-wrap" id="main">
        <p className="v3c-crumbs">
          <a href={hubPath(locale)}>{c.tool.crumbs}</a>
          <span aria-hidden="true">›</span>
          <span>{question}</span>
        </p>
        <Fascia
          tab={fmt(c.tool.tab, { q: question })}
          title={tc.name}
          meta={
            <>
              <b>{tc.line}</b>
              <PrefillNote prefilled={c.tool.prefilled} typeYours={c.tool.typeYours} live={live} />
            </>
          }
        />

        <ToolCalc slug={slug} copy={tc} invalid={c.tool.invalid} live={live} />

        <BoardBridge def={def} column={tc.column} copy={c.tool} src={src} />

        {/* Il contenuto che la pagina già aveva: la frase chiave, il perché, i numeri, le domande. */}
        <p className="v3c-lede v3c-takeaway">{t.takeaway}</p>

        <section className="v3c-sec v3c-prose" aria-labelledby="v3c-explainer-h">
          <h2 className="v3c-t-sec" id="v3c-explainer-h">
            {t.explainerTitle}
          </h2>
          {t.explainer.map((p, i) => (
            <p key={i} className={i === 0 ? "v3c-prose-lead" : undefined}>
              {withBold(p)}
            </p>
          ))}
        </section>

        <section className="v3c-sec v3c-example" aria-labelledby="v3c-example-h">
          <h2 className="v3c-t-sec" id="v3c-example-h">
            {t.example.title}
          </h2>
          <dl className="v3c-ex-rows">
            {t.example.rows.map((r, i) => (
              <div className="v3c-ex-row" key={i}>
                <dt>{r.label}</dt>
                <dd className="v3c-num">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="v3c-explain">{t.example.note}</p>
        </section>

        <section className="v3c-sec v3c-faq" aria-labelledby="v3c-faq-h">
          <h2 className="v3c-t-sec" id="v3c-faq-h">
            {copy.common.faqTitle}
          </h2>
          {t.faq.map((f, i) => (
            <div className="v3c-faq-i" key={i}>
              <h3 className="v3c-t-row">{f.q}</h3>
              <p className="v3c-explain">{f.a}</p>
            </div>
          ))}
        </section>

        <section className="v3c-sec v3c-others" aria-labelledby="v3c-others-h">
          <div className="v3c-sec-h">
            <h2 className="v3c-t-sec" id="v3c-others-h">
              {copy.common.otherTools}
            </h2>
            <a className="v3c-ghost" href={hubPath(locale)}>
              {c.tool.allTools}
            </a>
          </div>
          <div className="v3c-hq-l">
            {others.map((s) => {
              const d = toolDef(s);
              return <BenchTool key={s} variant="hub" slug={s} sigla={d.sigla} name={c.tools[s].name} line={c.tools[s].line} href={toolPath(s, locale)} example={toolPreview(s, ctx)} />;
            })}
          </div>
        </section>

        <section className="v3c-sec v3c-hub-end">
          <p className="v3c-explain">{c.hub.explain}</p>
          <a className="v3c-btn v3c-btn-line" href={src.boardHref}>
            {c.tool.openBoard}
          </a>
        </section>

      </main>
      </SiteFrame>
      <script
        type="application/ld+json"
        // Dati strutturati dal dizionario: nessun input utente entra in questo JSON.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd(slug, locale)) }}
      />
    </V3cShell>
  );
}
