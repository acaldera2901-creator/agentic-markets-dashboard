"use client";
// components/tools/ProbabilityCalculator.tsx (#TOOLS-HUB-0805)
// Due domande in una pagina: "che quota vale questa probabilità" (e viceversa,
// cioè la break-even che una quota pretende) e "quanto vale davvero la multipla".
// La moltiplicazione assume gambe indipendenti: il limite è scritto nel testo.

import { useMemo, useState } from "react";
import {
  impliedProbability,
  parlayOdds,
  parlayProbability,
  parseOdds,
  probabilityToDecimal,
} from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, Segmented, num, parsePercent, pct } from "./parts";
import { Meter } from "./Meter";

type Mode = "probability" | "odds";

export function ProbabilityCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  const [mode, setMode] = useState<Mode>("probability");
  const [prob, setProb] = useState("50");
  const [odds, setOdds] = useState("2.00");
  const [legs, setLegs] = useState<string[]>(["1.91", "2.10"]);

  const fromProbability = useMemo(() => {
    const p = parsePercent(prob);
    return p === null ? null : probabilityToDecimal(p);
  }, [prob]);

  const fromOdds = useMemo(() => {
    const d = parseOdds(odds, "decimal");
    return d === null ? null : impliedProbability(d);
  }, [odds]);

  const parlay = useMemo(() => {
    const decimals = legs.map((l) => parseOdds(l, "decimal"));
    if (!decimals.length || decimals.some((d) => d === null)) return null;
    const list = decimals as number[];
    const price = parlayOdds(list);
    const probability = parlayProbability(list.map((d) => impliedProbability(d) as number));
    return price === null || probability === null ? null : { price, probability };
  }, [legs]);

  // La catena scritta per esteso ("52.63% × 47.62% = 25.06%") è l'elemento che
  // spiega la multipla meglio di qualsiasi barra: si vede che ogni gamba
  // MOLTIPLICA, e quanto resta alla fine.
  const chain = useMemo(() => {
    const decimals = legs.map((l) => parseOdds(l, "decimal"));
    if (!decimals.length || decimals.some((d) => d === null)) return null;
    const probs = (decimals as number[]).map((d) => impliedProbability(d) as number);
    const combined = probs.reduce((a, b) => a * b, 1);
    return `${probs.map((x) => pct(x, dash)).join(" × ")} = ${pct(combined, dash)}`;
  }, [legs, dash]);

  const setLeg = (i: number, v: string) =>
    setLegs((prev) => prev.map((l, idx) => (idx === i ? v : l)));

  return (
    <div className="tl-calc tl-calc--prob">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        <Segmented
          label={L.modeTitle}
          value={mode}
          onChange={(id) => setMode(id as Mode)}
          options={[
            { id: "probability", label: L.modeProbability },
            { id: "odds", label: L.modeOdds },
          ]}
        />
        {mode === "probability" ? (
          <Field label={L.probability} value={prob} onChange={setProb} suffix="%" placeholder="50" />
        ) : (
          <Field label={L.odds} value={odds} onChange={setOdds} placeholder="2.00" />
        )}
        <p className="tl-hint">{L.hint}</p>

        <h3 className="tl-panel-title tl-panel-title--sub">{L.parlayTitle}</h3>
        {legs.map((l, i) => (
          <div className="tl-row" key={i}>
            <Field
              label={`${L.leg} ${i + 1}`}
              value={l}
              onChange={(v) => setLeg(i, v)}
              placeholder="1.91"
            />
            {legs.length > 2 && (
              <button
                type="button"
                className="tl-btn-ghost"
                onClick={() => setLegs((prev) => prev.filter((_, idx) => idx !== i))}
              >
                {L.removeLeg}
              </button>
            )}
          </div>
        ))}
        <button type="button" className="tl-btn" onClick={() => setLegs((prev) => [...prev, ""])}>
          {L.addLeg}
        </button>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        {mode === "probability" ? (
          <Readout label={L.fairOdds} testId="out-fair-odds" value={num(fromProbability, dash)} strong />
        ) : (
          <Readout label={L.breakEven} testId="out-breakeven" value={pct(fromOdds, dash)} strong />
        )}

        <h3 className="tl-panel-title tl-panel-title--sub">{L.parlayTitle}</h3>
        <Readout
          label={L.parlayOdds}
          testId="out-parlay-odds"
          value={num(parlay?.price, dash)}
          strong
        />
        <Readout
          label={L.parlayProbability}
          testId="out-parlay-prob"
          value={pct(parlay?.probability, dash)}
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
      </div>
    </div>
  );
}
