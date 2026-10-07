"use client";
// components/v3c/guide/HeroExample.tsx (#REDESIGN-V3C fixui · QA A1, POSITIONING §2 segmento A)
// Sotto la frase della home, UNA partita vera del giorno letta dalla board (non numeri
// fissi): quota → probabilità del book → nostra stima → gap, e il link alla partita.
// Una riga di testo, nessun evidenziatore pieno (UX-AUDIT #4: la stima non è «la risposta»).
// L'altezza è riservata dal contenitore anche mentre arriva (fixui.css), quindi niente CLS.
import { useV3cCopy } from "@/lib/v3c/lang.client";
import { guideCopyFor } from "@/lib/v3c/guide-copy";
import { gapText } from "@/lib/v3c/board-view";

export type HeroExampleData = {
  href: string;
  home: string;
  away: string;
  outcome: "home" | "draw" | "away";
  price: number;
  market: number;
  estimate: number;
  gap: number | null;
  today: boolean;
};

export function HeroExample({ d }: { d: HeroExampleData | null }) {
  const { lang, t } = useV3cCopy();
  const h = guideCopyFor(lang).hero;
  if (!d) return <div className="v3c-hx" aria-hidden="true" />;
  const label = d.outcome === "home" ? d.home : d.outcome === "away" ? d.away : t.board.draw;
  return (
    <div className="v3c-hx">
      <p className="v3c-hx-line">
        <span className="v3c-lab">{d.today ? h.exampleToday : h.exampleNext}</span>
        <b className="v3c-hx-m" title={`${d.home} — ${d.away}`}>
          {d.home} — {d.away}
        </b>
        <span className="v3c-num">{h.odds(label, d.price.toFixed(2))}</span>
        <span className="v3c-num v3c-m">{h.market(String(d.market))}</span>
        <span className="v3c-num v3c-hx-e">{h.estimate(String(d.estimate))}</span>
        {d.gap != null ? <span className="v3c-num">{h.gap(gapText(d.gap))}</span> : null}
        <a className="v3c-hx-go" href={d.href}>
          {h.open} →
        </a>
      </p>
    </div>
  );
}
