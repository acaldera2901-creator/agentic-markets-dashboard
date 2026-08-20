"use client";
// components/tools/ParlayCalculator.tsx (#TOOLS-11-0808)
// Multipla: il prezzo cresce, la probabilità crolla, e il margine del book si
// moltiplica insieme alle gambe. Le tre cose vanno lette una accanto all'altra,
// altrimenti resta solo la quota grossa.
//
// La matematica è già in lib/betting-math (parlayOdds, parlayProbability): qui
// non se ne aggiunge. L'unico calcolo locale è la composizione del margine, che
// nasce da un'ASSUNZIONE dichiarata — per questo il margine per gamba è un
// campo e non una costante nascosta nel codice.

import { useMemo, useState } from "react";
import { impliedProbability, parlayOdds, parlayProbability, parseOdds } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, num, parsePercent, pct } from "./parts";
import { Meter } from "./Meter";

const MAX_LEGS = 8;

export function ParlayCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  // Default 4 × 1.80: sono i numeri dell'esempio lavorato più sotto nella
  // pagina (10.50 · 9.53% · 21.55%), come fa ArbitrageCalculator con 2.10/2.10.
  const [legs, setLegs] = useState<string[]>(["1.80", "1.80", "1.80", "1.80"]);
  const [margin, setMargin] = useState("5");

  const parlay = useMemo(() => {
    const decimals = legs.map((l) => parseOdds(l, "decimal"));
    if (!decimals.every((d): d is number => d !== null)) return null;
    const price = parlayOdds(decimals);
    const probs = decimals.map((d) => impliedProbability(d) as number);
    const probability = parlayProbability(probs);
    if (price === null || probability === null) return null;
    return { price, probability, probs };
  }, [legs]);

  // Il margine non si somma sulle gambe: gli overround si moltiplicano, quindi
  // n gambe al m% costano (1+m)^n − 1. Quattro al 5% fanno 21.55%, otto 47.75%.
  const compoundMargin = useMemo(() => {
    const m = parsePercent(margin);
    if (m === null || !parlay) return null;
    return (1 + m) ** legs.length - 1;
  }, [margin, parlay, legs.length]);

  // La catena scritta per esteso ("55.56% × 55.56% … = 9.53%") è ciò che rende
  // visibile la moltiplicazione: stesso trattamento della sezione multipla del
  // probability calculator, di cui questa pagina è la versione approfondita.
  const chain = parlay
    ? `${parlay.probs.map((p) => pct(p, dash)).join(" × ")} = ${pct(parlay.probability, dash)}`
    : null;

  const setLeg = (i: number, v: string) =>
    setLegs((prev) => prev.map((p, j) => (j === i ? v : p)));

  return (
    <div className="tl-calc tl-calc--parlay">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        {legs.map((leg, i) => (
          <div className="tl-row" key={i}>
            <Field
              label={`${L.leg} ${i + 1}`}
              value={leg}
              onChange={(v) => setLeg(i, v)}
              placeholder="1.80"
            />
            {legs.length > 2 && (
              <button
                type="button"
                className="tl-btn-ghost"
                onClick={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
              >
                {L.removeLeg}
              </button>
            )}
          </div>
        ))}
        {legs.length < MAX_LEGS && (
          <button type="button" className="tl-btn" onClick={() => setLegs((prev) => [...prev, ""])}>
            {L.addLeg}
          </button>
        )}
        <Field
          label={L.marginPerLeg}
          value={margin}
          onChange={setMargin}
          suffix="%"
          placeholder="5"
        />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout
          label={L.combinedOdds}
          testId="out-parlay-total"
          value={num(parlay?.price, dash)}
          strong
        />
        <Readout
          label={L.impliedProb}
          testId="out-parlay-implied"
          value={pct(parlay?.probability, dash)}
        />
        <Readout
          label={L.compoundMargin}
          testId="out-parlay-margin"
          value={pct(compoundMargin, dash)}
          tone={compoundMargin === null ? undefined : "down"}
        />
        {parlay && chain ? (
          <Meter
            segments={[
              { value: parlay.probability, tone: "fair" },
              { value: 1 - parlay.probability, tone: "muted" },
            ]}
            caption={chain}
          />
        ) : null}
        <p className="tl-verdict is-warn">{L.verdict}</p>
      </div>
    </div>
  );
}
