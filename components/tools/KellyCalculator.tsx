"use client";
// components/tools/KellyCalculator.tsx (#TOOLS-HUB-0805)
// Kelly: quanto puntare. Il default è mezzo Kelly, non pieno — il pieno assume
// che la tua probabilità sia esatta, e non lo è mai (il caveat è nella pagina).

import { useMemo, useState } from "react";
import { kelly, parseOdds } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, Segmented, num, parseAmount, parsePercent, pct, signedPct, toneOf } from "./parts";

const FRACTIONS: Record<string, number> = { full: 1, half: 0.5, quarter: 0.25 };

export function KellyCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  const [odds, setOdds] = useState("2.10");
  const [prob, setProb] = useState("52");
  const [bankroll, setBankroll] = useState("1000");
  const [fractionId, setFractionId] = useState("full");

  const result = useMemo(() => {
    const decimal = parseOdds(odds, "decimal");
    const probability = parsePercent(prob);
    const bank = parseAmount(bankroll);
    if (decimal === null || probability === null || bank === null) return null;
    return kelly({ probability, decimal, bankroll: bank, fraction: FRACTIONS[fractionId] });
  }, [odds, prob, bankroll, fractionId]);

  const noEdge = result !== null && result.stake === 0;

  return (
    <div className="tl-calc tl-calc--kelly">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        <Field label={L.odds} value={odds} onChange={setOdds} placeholder="2.10" />
        <Field label={L.probability} value={prob} onChange={setProb} suffix="%" placeholder="52" />
        <Field label={L.bankroll} value={bankroll} onChange={setBankroll} placeholder="1000" />
        <Segmented
          label={L.fractionTitle}
          value={fractionId}
          onChange={setFractionId}
          options={[
            { id: "full", label: L.fractionFull },
            { id: "half", label: L.fractionHalf },
            { id: "quarter", label: L.fractionQuarter },
          ]}
        />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout label={L.stake} testId="out-stake" value={num(result?.stake, dash)} strong />
        <Readout
          label={L.stakePercent}
          testId="out-stake-pct"
          value={pct(result?.stakeFraction, dash)}
        />
        <Readout
          label={L.edge}
          testId="out-edge"
          value={signedPct(result?.edge, dash)}
          tone={toneOf(result?.edge)}
        />
        <Readout label={L.fullKelly} testId="out-full-kelly" value={pct(result?.fullKelly, dash)} />
        <Readout
          label={L.growth}
          testId="out-growth"
          value={num(result?.growthRate, dash, 4)}
        />
        {noEdge ? <p className="tl-verdict is-warn">{L.noEdge}</p> : null}
        {copy.caveat ? <p className="tl-caveat">{copy.caveat}</p> : null}
      </div>
    </div>
  );
}
