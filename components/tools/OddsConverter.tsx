"use client";
// components/tools/OddsConverter.tsx (#TOOLS-HUB-0805)
// Una quota, tutti i formati. Il componente non calcola niente da sé: parsa con
// lib/betting-math e formatta.

import { useMemo, useState } from "react";
import { ODDS_FORMATS, formatOdds, impliedProbability, parseOdds, type OddsFormat } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, Segmented, pct } from "./parts";
import { Meter } from "./Meter";

export function OddsConverter({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  const [raw, setRaw] = useState("2.50");
  const [format, setFormat] = useState<OddsFormat>("decimal");

  const decimal = useMemo(() => parseOdds(raw, format), [raw, format]);
  const implied = decimal === null ? null : impliedProbability(decimal);

  return (
    <div className="tl-calc tl-calc--converter">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        <Field label={L.oddsInput} value={raw} onChange={setRaw} placeholder="2.50" />
        <Segmented
          label={L.formatSelect}
          value={format}
          onChange={(id) => setFormat(id as OddsFormat)}
          options={ODDS_FORMATS.map((f) => ({ id: f, label: L[f] }))}
        />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        {ODDS_FORMATS.map((f) => (
          <Readout
            key={f}
            label={L[f]}
            testId={`out-${f}`}
            value={decimal === null ? dash : formatOdds(decimal, f)}
            strong={f === format}
          />
        ))}
        <Readout
          label={L.impliedProbability}
          testId="out-implied"
          value={pct(implied, dash)}
          strong
        />
        {/* La probabilità implicita come lunghezza, col riferimento a metà: si
            vede subito se il book dà la partita per favorita o no. */}
        {implied !== null && (
          <Meter
            segments={[{ value: implied, tone: "fair" }, { value: 1 - implied, tone: "muted" }]}
            markers={[{ at: 0.5, label: "50%" }]}
          />
        )}
      </div>
    </div>
  );
}
