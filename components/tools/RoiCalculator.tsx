"use client";
// components/tools/RoiCalculator.tsx (#TOOLS-11-0808)
// ROI: profitto sul CAPITALE. Vive in coppia con lo yield calculator — stesso
// profitto, denominatore diverso — e la pagina lo dice a voce alta invece di
// lasciare che qualcuno confronti un 40% di ROI con un 4% di yield.
//
// Il profitto entra da parseSignedAmount e non da parseAmount: un periodo in
// perdita è il caso onesto, e −250 deve poter essere digitato.

import { useMemo, useState } from "react";
import { parseSignedAmount, roi } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, num, parseAmount, signedPct, toneOf } from "./parts";
import { Meter, type MeterSegment } from "./Meter";

export function RoiCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  // Default 1.000 / 400: sono i numeri dell'esempio lavorato più sotto nella
  // pagina (+40.00%, cassa a 1.400), come fanno arbitrage e parlay.
  const [capital, setCapital] = useState("1000");
  const [profit, setProfit] = useState("400");

  const result = useMemo(() => {
    const c = parseAmount(capital);
    const p = parseSignedAmount(profit);
    if (c === null || p === null) return null;
    const value = roi({ profit: p, capital: c });
    if (value === null) return null;
    return { value, ending: c + p };
  }, [capital, profit]);

  // La traccia è il capitale di partenza. In guadagno le si aggiunge la coda del
  // profitto e il marcatore dice dove finiva la cassa; in perdita la traccia
  // resta il capitale e la parte rossa è il pezzo che non c'è più.
  const meterSegments: MeterSegment[] = !result
    ? []
    : result.value >= 0
      ? [
          { value: 1, tone: "fair" },
          { value: result.value, tone: "edge" },
        ]
      : [
          { value: Math.max(0, 1 + result.value), tone: "fair" },
          { value: Math.min(1, -result.value), tone: "loss" },
        ];

  return (
    <div className="tl-calc tl-calc--roi">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        <Field label={L.capital} value={capital} onChange={setCapital} placeholder="1000" />
        <Field label={L.profit} value={profit} onChange={setProfit} placeholder="400" />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout
          label={L.roi}
          testId="out-roi"
          value={signedPct(result?.value, dash)}
          tone={toneOf(result?.value)}
          strong
        />
        <Readout label={L.endingCapital} testId="out-roi-ending" value={num(result?.ending, dash)} />
        <Meter
          segments={meterSegments}
          markers={
            result && result.value > 0
              ? [{ at: 1 / (1 + result.value), label: L.capital }]
              : []
          }
        />
        <p className="tl-verdict">{L.verdict}</p>
      </div>
    </div>
  );
}
