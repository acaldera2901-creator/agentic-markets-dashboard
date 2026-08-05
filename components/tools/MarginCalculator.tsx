"use client";
// components/tools/MarginCalculator.tsx (#TOOLS-HUB-0805)
// Margine del book e linea equa. Il mercato è una lista di quote: due esiti per
// default, se ne aggiungono quanti serve (tre-way, antepost).

import { useMemo, useState } from "react";
import {
  bookmakerMargin,
  impliedProbability,
  noVigOdds,
  noVigProbabilities,
  parseOdds,
  payoutPercent,
} from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, num, pct } from "./parts";

export function MarginCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  const [rows, setRows] = useState<string[]>(["1.91", "1.91"]);

  const decimals = useMemo(
    () => rows.map((r) => parseOdds(r, "decimal")),
    [rows]
  );
  const complete = decimals.length >= 2 && decimals.every((d): d is number => d !== null);
  const valid = complete ? (decimals as number[]) : null;

  const margin = valid ? bookmakerMargin(valid) : null;
  const payout = valid ? payoutPercent(valid) : null;
  const fairProbs = valid ? noVigProbabilities(valid) : null;
  const fairOdds = valid ? noVigOdds(valid) : null;

  const setRow = (i: number, v: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? v : r)));

  return (
    <div className="tl-calc tl-calc--margin">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        {rows.map((r, i) => (
          <div className="tl-row" key={i}>
            <Field
              label={`${L.outcome} ${i + 1}`}
              value={r}
              onChange={(v) => setRow(i, v)}
              placeholder="1.91"
            />
            {rows.length > 2 && (
              <button
                type="button"
                className="tl-btn-ghost"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              >
                {L.removeOutcome}
              </button>
            )}
          </div>
        ))}
        <button type="button" className="tl-btn" onClick={() => setRows((prev) => [...prev, ""])}>
          {L.addOutcome}
        </button>
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout label={L.margin} testId="out-margin" value={pct(margin, dash)} strong />
        <Readout label={L.payout} testId="out-payout" value={pct(payout, dash)} />

        <h3 className="tl-panel-title tl-panel-title--sub">{L.fairOddsTitle}</h3>
        <div className="tl-table" role="table">
          <div className="tl-table-head" role="row">
            <span role="columnheader">{L.outcome}</span>
            <span role="columnheader">{L.impliedProbability}</span>
            <span role="columnheader">{L.fairProbability}</span>
            <span role="columnheader">{L.fairOdds}</span>
          </div>
          {rows.map((_, i) => (
            <div className="tl-table-row" role="row" key={i}>
              <span role="cell">{`${L.outcome} ${i + 1}`}</span>
              <span role="cell">
                {decimals[i] === null ? dash : pct(impliedProbability(decimals[i] as number), dash)}
              </span>
              <span role="cell" data-testid={`out-fairprob-${i + 1}`}>
                {fairProbs ? pct(fairProbs[i], dash) : dash}
              </span>
              <span role="cell" data-testid={`out-fair-${i + 1}`}>
                {fairOdds ? num(fairOdds[i], dash) : dash}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
