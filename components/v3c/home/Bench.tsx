"use client";
// components/v3c/home/Bench.tsx (#REDESIGN-V3C F3)
// Il banco (DIRECTION-v3c §3): Price check come pezzo grande + i 4 tool più
// usati, ognuno con «input → risultato» calcolato sui numeri di una partita
// VERA della board di oggi (benchMatch). Senza una partita con mercato si usa
// l'esempio del design system e la nota lo dice. Nessuna CTA royal: la board
// resta la cosa grande.
import Link from "next/link";
import { useMemo } from "react";
import type { V3BoardMatch } from "@/lib/v3c/contracts";
import { benchMatch, leadOutcome, outcomeLabel } from "@/lib/v3c/board-view";
import { useLocalTimeZone, useV3cCopy } from "@/lib/v3c/lang.client";
import { BENCH_SLUGS, SAMPLE_MATCH, benchExample, sampleTool, type LeadShape } from "@/lib/v3c/sample";
import { bookmakerMargin } from "@/lib/betting-math";
import { toolPath } from "@/lib/tools/registry";
import { BenchTool } from "../BenchTool";
import { exampleEligible, withoutMoney } from "@/lib/v3c/fixui2";
import { fixui2CopyFor } from "@/lib/v3c/fixui2-copy";
import { ToolMark } from "../Monogramma";
import { V3C_ROUTES } from "../V3cChrome";

type Example = { label: string; match: string; outcomes: LeadShape[]; lead: LeadShape; sample: boolean };

function fromBoard(m: V3BoardMatch, drawWord: string): Example | null {
  const outs = m.outcomes.filter((o) => o.market_price != null && o.market_p != null);
  if (outs.length !== 3) return null;
  const shapes = outs.map((o) => ({ price: o.market_price as number, market: Math.round((o.market_p as number) * 100), estimate: Math.round(o.estimate_p * 100) }));
  const lead = leadOutcome(m);
  const idx = Math.max(0, outs.findIndex((o) => o.outcome === lead.outcome));
  // l'esito guida della riga va per primo: benchExample a pari gap tiene il primo e il
  // calcolatore di probabilità mostra il primo esito — così il banco parla della stessa riga
  const ordered = [shapes[idx], ...shapes.filter((_, i) => i !== idx)];
  return { label: outcomeLabel(m, lead.outcome, drawWord), match: `${m.home} – ${m.away}`, outcomes: ordered, lead: shapes[idx], sample: false };
}

/** fixui2 N1: the bench speaks in percentages only — Kelly «10.7% · €54» → «10.7%». */
function benchSafe(e: ReturnType<typeof benchExample>): ReturnType<typeof benchExample> {
  return { ...e, input: withoutMoney(e.input), output: withoutMoney(e.output) };
}

export function Bench({ matches, nowIso }: { matches: V3BoardMatch[]; nowIso: string }) {
  const { lang, t } = useV3cCopy();
  const tz = useLocalTimeZone();
  const ex: Example = useMemo(() => {
    // fixui2 N1: only a match not started and not held back by the model guard (never EV/Kelly of a guarded match)
    const m = benchMatch(exampleEligible(matches, new Date(nowIso)), new Date(nowIso), tz);
    const real = m ? fromBoard(m, t.board.draw) : null;
    if (real) return real;
    const outs = SAMPLE_MATCH.outcomes.map((o) => ({ price: o.price, market: o.market, estimate: o.estimate }));
    return { label: SAMPLE_MATCH.outcomes[0].label, match: "", outcomes: outs, lead: outs[0], sample: true };
  }, [matches, nowIso, tz, t.board.draw]);
  // benchExample sceglie il suo esito guida (gap più ampio): lo stesso della riga
  const prices = ex.outcomes.map((o) => o.price);
  const margin = (bookmakerMargin(prices) ?? 0) * 100;
  return (
    <section className="v3c-bench" aria-labelledby="v3c-bench-h">
      <div className="v3c-bench-h">
        <div>
          <span className="v3c-lab">{t.bench.lab}</span>
          <h2 className="v3c-t-sec" id="v3c-bench-h">
            {t.bench.title}
          </h2>
        </div>
        <Link className="v3c-ghost" href="/tools">
          {t.bench.all}
        </Link>
      </div>
      <div className="v3c-bench-g">
        <a className="v3c-bench-pc" href={V3C_ROUTES.price}>
          <ToolMark sigla="3→1" name={t.bench.pcName} />
          <span className="v3c-tr-t">
            <b className="v3c-t-row">{t.bench.pcName}</b>
            <span className="v3c-tr-l">{t.bench.pcLine}</span>
          </span>
          <span className="v3c-pc-ex">
            <span className="v3c-in">{prices.map((p) => p.toFixed(2)).join(" · ")}</span>
            <span className="v3c-arr" aria-hidden="true">
              →
            </span>
            <span>
              {t.bench.marginWord} <b className="v3c-num">{margin.toFixed(1)}%</b> · {ex.label} <b className="v3c-num v3c-m">{ex.lead.market}%</b> {t.bench.vs}{" "}
              <mark className="v3c-num">{ex.lead.estimate}%</mark>
            </span>
          </span>
          <span className="v3c-btn v3c-btn-line v3c-btn-s">{t.bench.pcCta}</span>
        </a>
        {BENCH_SLUGS.map((slug) => {
          const tool = sampleTool(slug);
          const copy = t.bench.tools[slug];
          return <BenchTool key={slug} slug={slug} sigla={tool.sigla} name={copy?.name ?? tool.name} line={copy?.line ?? tool.line} href={toolPath(slug, "en")} example={benchSafe(benchExample(slug, { outcomes: ex.outcomes }))} />;
        })}
      </div>
      <p className="v3c-fine" data-bench={ex.sample ? "sample" : "match"}>{ex.sample ? fixui2CopyFor(lang).benchSample : t.bench.note(ex.match)}</p>
    </section>
  );
}
