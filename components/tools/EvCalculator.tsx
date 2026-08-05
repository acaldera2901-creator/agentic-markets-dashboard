"use client";
// components/tools/EvCalculator.tsx (#TOOLS-HUB-0805)
// EV di una puntata. Due modi di avere la probabilità: la tua stima, oppure la
// linea di un book sharp con il margine tolto — il secondo è il flusso vero di
// chi cerca +EV, e non richiede di fidarsi del proprio istinto.

import { useMemo, useState } from "react";
import { expectedValue, noVigProbabilities, parseOdds } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, Segmented, num, parseAmount, parsePercent, pct, signed, signedPct, toneOf } from "./parts";

type Mode = "manual" | "sharp";

export function EvCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  const [mode, setMode] = useState<Mode>("manual");
  const [odds, setOdds] = useState("2.10");
  const [prob, setProb] = useState("50");
  const [sharpA, setSharpA] = useState("1.95");
  const [sharpB, setSharpB] = useState("1.95");
  const [stake, setStake] = useState("100");

  const decimal = useMemo(() => parseOdds(odds, "decimal"), [odds]);

  const derived = useMemo(() => {
    const a = parseOdds(sharpA, "decimal");
    const b = parseOdds(sharpB, "decimal");
    if (a === null || b === null) return null;
    const probs = noVigProbabilities([a, b]);
    return probs ? probs[0] : null;
  }, [sharpA, sharpB]);

  const probability = mode === "manual" ? parsePercent(prob) : derived;
  const stakeValue = parseAmount(stake);

  const result = useMemo(() => {
    if (decimal === null || probability === null || stakeValue === null) return null;
    return expectedValue({ probability, decimal, stake: stakeValue });
  }, [decimal, probability, stakeValue]);

  const verdict =
    !result ? null : result.edge > 0 ? L.positive : result.edge < 0 ? L.negative : L.neutral;

  return (
    <div className="tl-calc tl-calc--ev">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        <Segmented
          label={L.modeTitle}
          value={mode}
          onChange={(id) => setMode(id as Mode)}
          options={[
            { id: "manual", label: L.modeManual },
            { id: "sharp", label: L.modeSharp },
          ]}
        />
        <Field label={L.yourOdds} value={odds} onChange={setOdds} placeholder="2.10" />
        {mode === "manual" ? (
          <Field label={L.yourProbability} value={prob} onChange={setProb} suffix="%" placeholder="50" />
        ) : (
          <>
            <Field label={L.sharpOddsA} value={sharpA} onChange={setSharpA} placeholder="1.95" />
            <Field label={L.sharpOddsB} value={sharpB} onChange={setSharpB} placeholder="1.95" />
            <Readout
              label={L.derivedProbability}
              testId="out-derived"
              value={pct(derived, dash)}
            />
          </>
        )}
        <Field label={L.stake} value={stake} onChange={setStake} placeholder="100" />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout
          label={L.ev}
          testId="out-ev"
          value={signed(result?.ev, dash)}
          tone={toneOf(result?.ev)}
          strong
        />
        <Readout
          label={L.edge}
          testId="out-edge"
          value={signedPct(result?.edge, dash)}
          tone={toneOf(result?.edge)}
        />
        <Readout label={L.fairOdds} testId="out-fair" value={num(result?.fairDecimal, dash)} />
        {verdict ? <p className="tl-verdict">{verdict}</p> : null}
      </div>
    </div>
  );
}
