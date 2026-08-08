"use client";
// components/tools/ArbitrageCalculator.tsx (#TOOLS-11-0808)
// Arbitraggio: due o più book che, sommati, lasciano un margine a chi scommette.
// Il verdetto è la prima cosa che si legge — il resto sono i numeri per eseguirlo.
//
// Struttura della lista di esiti copiata da MarginCalculator: `tl-row` con il
// campo e un `tl-btn-ghost` per togliere, un `tl-btn` in fondo per aggiungere.

import { useMemo, useState } from "react";
import { arbitrage, parseOdds } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, num, parseAmount, pct, signedPct, toneOf } from "./parts";
import { Meter, type MeterSegment } from "./Meter";

export function ArbitrageCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  // Default 2.10/2.10: è l'esempio lavorato nel testo della pagina (somma
  // 95.24%, profitto +5.00%) — chi arriva vede i numeri che poi legge spiegati.
  const [legs, setLegs] = useState<string[]>(["2.10", "2.10"]);
  const [total, setTotal] = useState("1000");

  const result = useMemo(() => {
    const decimals = legs.map((l) => parseOdds(l, "decimal"));
    if (!decimals.every((d): d is number => d !== null)) return null;
    const stake = parseAmount(total);
    if (stake === null) return null;
    return arbitrage({ decimals, total: stake });
  }, [legs, total]);

  const isArb = result !== null && result.profitPercent > 0;

  // La traccia è il 100% del mercato. Se le quote lo coprono per meno, la coda
  // verde è il margine che resta a te; se lo sforano, la traccia si allunga e il
  // marcatore mostra dove cade il 100%. La geometria è esatta in entrambi i casi.
  const meterSegments: MeterSegment[] = !result
    ? []
    : isArb
      ? [
          { value: result.impliedSum, tone: "fair" },
          { value: 1 - result.impliedSum, tone: "edge" },
        ]
      : [
          { value: 1, tone: "fair" },
          { value: result.impliedSum - 1, tone: "margin" },
        ];

  const setLeg = (i: number, v: string) =>
    setLegs((prev) => prev.map((p, j) => (j === i ? v : p)));

  return (
    <div className="tl-calc tl-calc--arbitrage">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        {legs.map((leg, i) => (
          <div className="tl-row" key={i}>
            <Field
              label={`${L.outcome} ${i + 1}`}
              value={leg}
              onChange={(v) => setLeg(i, v)}
              placeholder="2.10"
            />
            {legs.length > 2 && (
              <button
                type="button"
                className="tl-btn-ghost"
                onClick={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
              >
                {L.removeOutcome}
              </button>
            )}
          </div>
        ))}
        {legs.length < 4 && (
          <button type="button" className="tl-btn" onClick={() => setLegs((prev) => [...prev, ""])}>
            {L.addOutcome}
          </button>
        )}
        <Field label={L.total} value={total} onChange={setTotal} placeholder="1000" />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout
          label={L.profit}
          testId="out-arb-profit"
          value={signedPct(result?.profitPercent, dash)}
          tone={toneOf(result?.profitPercent)}
          strong
        />
        <Readout label={L.impliedSum} testId="out-arb-sum" value={pct(result?.impliedSum, dash)} />
        {legs.map((_, i) => (
          <Readout
            key={i}
            label={`${L.stakeOn} ${i + 1}`}
            testId={`out-arb-stake-${i + 1}`}
            value={num(result?.stakes[i], dash)}
          />
        ))}
        <Readout
          label={L.guaranteedReturn}
          testId="out-arb-return"
          value={num(result?.returns[0], dash)}
        />
        <Meter segments={meterSegments} markers={[{ at: 1 / Math.max(result?.impliedSum ?? 1, 1), label: "100%" }]} />
        {result ? (
          <p className={`tl-verdict ${isArb ? "" : "is-warn"}`}>
            {isArb ? L.verdictArb : L.verdictNoArb}
          </p>
        ) : null}
      </div>
    </div>
  );
}
