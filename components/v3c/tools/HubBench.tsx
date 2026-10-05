"use client";
// components/v3c/tools/HubBench.tsx (#REDESIGN-V3C F5)
// La parte viva dell'hub: la ricerca e i gruppi per domanda. Riceve dati già
// calcolati e serializzabili dal Server Component (Hub.tsx); qui solo il
// filtro. Lo stato vuoto è scritto, non un elenco che sparisce.
import { useId, useState } from "react";
import type { TeamIdentity } from "@/lib/v3c/monogram";
import type { ToolPreview } from "@/lib/v3c/tools";
import { fmt } from "@/lib/i18n/v3c-tools";
import { BenchTool } from "../BenchTool";
import { Monogrammi, ToolMark } from "../Monogramma";

export type HubTool = { slug: string; sigla: string; name: string; line: string; href: string; example: ToolPreview };
export type HubGroup = { id: string; q: string; s: string; tools: HubTool[] };
export type HubLine = {
  notATool: string;
  q: string;
  s: string;
  match: { title: string; line: string; href: string; home: TeamIdentity; away: TeamIdentity; input: string; output: string };
  price: { title: string; line: string; href: string; input: string; output: string };
};

type Props = {
  groups: HubGroup[];
  line: HubLine;
  total: number;
  matchTitle: string;
  sample: boolean;
  copy: {
    searchLabel: string;
    searchPlaceholder: string;
    count: string;
    countMatch: string;
    empty: string;
    toolsN: string;
    toolOne: string;
    sample: string;
    sampleNote: string;
  };
};

export function HubBench({ groups, line, total, matchTitle, sample, copy }: Props) {
  const [q, setQ] = useState("");
  const id = useId();
  const needle = q.trim().toLowerCase();

  const visible = groups.map((g) => ({
    ...g,
    tools: g.tools.filter((t) => !needle || `${t.name} ${t.line} ${g.q}`.toLowerCase().includes(needle)),
  }));
  const n = visible.reduce((a, g) => a + g.tools.length, 0);

  return (
    <div className="v3c-hub">
      <div className="v3c-hub-s">
        <label className="v3c-search" htmlFor={id}>
          <span className="v3c-sr">{copy.searchLabel}</span>
          <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.searchPlaceholder} autoComplete="off" />
        </label>
        <span className="v3c-small" aria-live="polite">
          {needle ? fmt(copy.countMatch, { n, total, q: q.trim() }) : fmt(copy.count, { n: total, match: matchTitle })}
          {sample ? (
            <>
              {" "}
              <em className="v3c-tag v3c-tag-sample" title={copy.sampleNote}>
                {copy.sample}
              </em>
            </>
          ) : null}
        </span>
      </div>

      {visible.map((g) => (
        <section key={g.id} className="v3c-hq" data-q={g.id} hidden={g.tools.length === 0} aria-labelledby={`${id}-${g.id}`}>
          <div className="v3c-hq-q">
            <span className="v3c-lab">{g.tools.length === 1 ? copy.toolOne : fmt(copy.toolsN, { n: g.tools.length })}</span>
            <h2 className="v3c-t-q" id={`${id}-${g.id}`}>
              {g.q}
            </h2>
            <p className="v3c-small">{g.s}</p>
          </div>
          <div className="v3c-hq-l">
            {g.tools.map((t) => (
              <BenchTool key={t.slug} variant="hub" slug={t.slug} sigla={t.sigla} name={t.name} line={t.line} href={t.href} example={t.example} />
            ))}
          </div>
        </section>
      ))}

      <section className="v3c-hq v3c-hq-prod" hidden={!!needle} aria-labelledby={`${id}-line`}>
        <div className="v3c-hq-q">
          <span className="v3c-lab">{line.notATool}</span>
          <h2 className="v3c-t-q" id={`${id}-line`}>
            {line.q}
          </h2>
          <p className="v3c-small">{line.s}</p>
        </div>
        <div className="v3c-hq-l">
          <a className="v3c-bench-t v3c-hub-t" href={line.match.href}>
            <Monogrammi home={line.match.home} away={line.match.away} />
            <span className="v3c-tr-t">
              <b className="v3c-t-row">{line.match.title}</b>
              <span className="v3c-tr-l">{line.match.line}</span>
            </span>
            <span className="v3c-tr-ex">
              <span className="v3c-in">{line.match.input}</span>
              <span className="v3c-arr" aria-hidden="true">
                →
              </span>
              <span className="v3c-out v3c-num">{line.match.output}</span>
            </span>
            <i className="v3c-chev" aria-hidden="true">
              ›
            </i>
          </a>
          <a className="v3c-bench-t v3c-hub-t" href={line.price.href}>
            <ToolMark sigla="3→1" name={line.price.title} />
            <span className="v3c-tr-t">
              <b className="v3c-t-row">{line.price.title}</b>
              <span className="v3c-tr-l">{line.price.line}</span>
            </span>
            <span className="v3c-tr-ex">
              <span className="v3c-in">{line.price.input}</span>
              <span className="v3c-arr" aria-hidden="true">
                →
              </span>
              <span className="v3c-out v3c-num">{line.price.output}</span>
            </span>
            <i className="v3c-chev" aria-hidden="true">
              ›
            </i>
          </a>
        </div>
      </section>

      <p className="v3c-empty" hidden={n > 0} role="status">
        {fmt(copy.empty, { q: q.trim() })}
      </p>
    </div>
  );
}
