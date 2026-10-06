// components/v3c/tools/Hub.tsx (#REDESIGN-V3C F5)
// L'hub dei tool v3c: «il banco da lavoro, non un elenco» (DIRECTION-v3c §5).
// Tre domande dell'utente (5 · 4 · 2 tool), ogni riga con l'anteprima
// «input → risultato» calcolata sui numeri dell'esito guida della board; una
// ricerca che filtra per nome, riga d'uso e domanda; la quarta sezione «Not a
// calculator» è il ponte verso la board. Nessun partner, tutto in Free.
//
// Server Component. Stesse URL, stesso JSON-LD (hubJsonLd) e stessi metadata
// della pagina precedente: cambia solo ciò che si vede.
import { getToolsCopy } from "@/lib/tools/copy";
import { TOOL_SLUGS, toolPath, type ToolLocale } from "@/lib/tools/registry";
import { hubJsonLd } from "@/lib/tools/seo";
import { getV3cToolsCopy, fmt } from "@/lib/i18n/v3c-tools";
import { matchTitle } from "@/lib/v3c/board-source";
import { toolBoardSource } from "@/lib/v3c/board-source.server";
import { QUESTIONS, toolPreview, toolsFor } from "@/lib/v3c/tools";
import { v3cFontClass } from "../fonts";
import { Fascia } from "../Fascia";
import { SiteFrame } from "../Chrome";
import { V3cShell } from "../V3cShell";
import { HubBench, type HubGroup, type HubLine } from "./HubBench";
import "../v3c.css";

export async function V3cToolsHub({ locale }: { locale: ToolLocale }) {
  const copy = getToolsCopy(locale);
  const c = getV3cToolsCopy(locale);
  const src = await toolBoardSource();
  const matches = src.matches();
  const m = matches[0];
  const lead = src.lead(m);
  const ctx = { outcomes: m.outcomes, lead };
  const title = matchTitle(m);

  const groups: HubGroup[] = QUESTIONS.map((q) => ({
    id: q,
    q: c.questions[q].q,
    s: c.questions[q].s,
    tools: toolsFor(q).map((t) => ({
      slug: t.slug,
      sigla: t.sigla,
      name: c.tools[t.slug].name,
      line: c.tools[t.slug].line,
      href: toolPath(t.slug, locale),
      example: toolPreview(t.slug, ctx),
    })),
  }));

  const open = m.openPrice ?? lead.price;
  // polish: il gap della board quando c'è (stesso numero di board e partita), altrimenti la differenza degli interi
  const gap = lead.gap ?? lead.estimate - lead.market;
  const line: HubLine = {
    notATool: c.hub.notATool,
    q: c.hub.lineQ,
    s: c.hub.lineS,
    match: { title: fmt(c.hub.lineRow, { match: title }), line: c.hub.lineRowLine, href: m.href, home: m.home, away: m.away, input: m.openPrice != null ? open.toFixed(2) : "", output: lead.price.toFixed(2) },
    price: {
      title: c.hub.priceCheck,
      line: c.hub.priceCheckLine,
      href: "/price-check",
      input: m.outcomes.map((o) => o.price.toFixed(2)).join(" · "),
      output: `${gap > 0 ? "+" : gap < 0 ? "−" : "±"}${Number.isInteger(gap) ? Math.abs(gap) : Math.abs(gap).toFixed(1)} pp`,
    },
  };

  return (
    <V3cShell fontClass={v3cFontClass} lang={locale}>
      <SiteFrame current="tools" locale={locale} copy={c} hub>
      <main className="v3c-wrap" id="main">
        <Fascia
          tab={c.hub.tab}
          title={c.hub.title}
          meta={
            <>
              <b>{c.hub.metaStrong}</b>
              <span>{c.hub.metaRest}</span>
            </>
          }
        />
        {/* La riga che dice cosa sono i tool, con le parole con cui la pagina si posiziona (lib/tools/copy). */}
        <p className="v3c-lede v3c-hub-lede">{copy.hub.lede}</p>
        <HubBench
          groups={groups}
          line={line}
          total={TOOL_SLUGS.length}
          matchTitle={title}
          sample={src.kind === "sample"}
          copy={{
            searchLabel: c.hub.searchLabel,
            searchPlaceholder: c.hub.searchPlaceholder,
            count: c.hub.count,
            countMatch: c.hub.countMatch,
            empty: c.hub.empty,
            toolsN: c.hub.toolsN,
            toolOne: c.hub.toolOne,
            sample: c.tool.sample,
            sampleNote: c.hub.sampleNote,
          }}
        />
        <section className="v3c-sec v3c-hub-end">
          <p className="v3c-explain">{c.hub.explain}</p>
          <a className="v3c-btn v3c-btn-line" href={src.boardHref}>
            {c.hub.openBoard}
          </a>
        </section>
      </main>
      </SiteFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubJsonLd(locale)) }} />
    </V3cShell>
  );
}
