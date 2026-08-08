"use client";
// components/tools/YieldCalculator.tsx (#TOOLS-11-0808)
// Yield: profitto sul TOTALE GIOCATO. Il turnover è l'input che tutti sbagliano
// (ci mettono la cassa, o i soldi esposti in un momento), quindi qui non si
// digita: si dichiarano scommesse e stake medio e il turnover è un readout.
//
// Il verdetto cambia col numero di scommesse. Non è decorazione: sotto il
// migliaio di giocate lo yield è un intervallo, non un risultato, e la pagina
// deve dirlo mentre mostra il numero — non dopo, in fondo al testo.

import { useMemo, useState } from "react";
import { parseSignedAmount, yieldPercent } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, num, parseAmount, pct, signedPct, toneOf } from "./parts";
import { Meter, type MeterSegment } from "./Meter";

// Soglia del verdetto. Non è nascosta: entrambe le versioni del verdetto
// scrivono il numero e la deviazione standard che lo giustifica (a stake piatto
// e quota 2.00 la SD dello yield è 1/√n → 7.07 punti su 200 giocate, 3.16 su
// 1.000), così chi legge sa da dove esce il confine.
const MEANINGFUL_SAMPLE = 1000;

export function YieldCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  // Default 200 × 50 con 400 di profitto: l'esempio lavorato della pagina
  // (turnover 10.000, yield +4.00%) e lo stesso 400 della pagina ROI.
  const [bets, setBets] = useState("200");
  const [avgStake, setAvgStake] = useState("50");
  const [profit, setProfit] = useState("400");

  const result = useMemo(() => {
    const n = parseAmount(bets);
    const s = parseAmount(avgStake);
    const p = parseSignedAmount(profit);
    if (n === null || s === null || p === null) return null;
    const turnover = n * s;
    const value = yieldPercent({ profit: p, turnover });
    if (value === null) return null;
    return { turnover, value, bets: n };
  }, [bets, avgStake, profit]);

  // Traccia con una scala dichiarata: 10 punti di yield, o il valore stesso se
  // lo sfonda. Il marcatore al 5% è il riferimento di cui parla l'explainer —
  // sopra quello, sostenuto su volume, è raro.
  const magnitude = result ? Math.abs(result.value) : 0;
  const scale = Math.max(magnitude, 0.1);
  const meterSegments: MeterSegment[] = !result
    ? []
    : [
        { value: magnitude, tone: result.value >= 0 ? "edge" : "loss" },
        { value: scale - magnitude, tone: "muted" },
      ];

  const smallSample = result === null || result.bets < MEANINGFUL_SAMPLE;

  return (
    <div className="tl-calc tl-calc--yield">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        <Field label={L.bets} value={bets} onChange={setBets} placeholder="200" />
        <Field label={L.avgStake} value={avgStake} onChange={setAvgStake} placeholder="50" />
        <Field label={L.profit} value={profit} onChange={setProfit} placeholder="400" />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout
          label={L.yieldPercent}
          testId="out-yield"
          value={signedPct(result?.value, dash)}
          tone={toneOf(result?.value)}
          strong
        />
        <Readout label={L.turnover} testId="out-turnover" value={num(result?.turnover, dash)} />
        <Meter
          segments={meterSegments}
          markers={
            result && result.value >= 0 ? [{ at: 0.05 / scale, label: pct(0.05, dash, 0) }] : []
          }
        />
        <p className={`tl-verdict ${smallSample ? "is-warn" : ""}`}>
          {smallSample ? L.verdictNoise : L.verdictVolume}
        </p>
      </div>
    </div>
  );
}
