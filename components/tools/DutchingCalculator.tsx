"use client";
// components/tools/DutchingCalculator.tsx
// Dutching: dividere uno stake su più esiti dello stesso mercato perché il
// ritorno sia uguale qualunque esito vinca. Cugino dell'arbitraggio, ma qui la
// somma delle probabilità implicite può superare il 100%: in quel caso il
// verdetto dice quanto perdi con certezza, ed è il numero che conta.
//
// Struttura copiata da ArbitrageCalculator: lista di esiti con `tl-row`, un
// `tl-btn-ghost` per togliere e un `tl-btn` in fondo per aggiungere. Il
// verdetto è la prima cosa che si legge; il resto sono i numeri per eseguirlo.

import { useMemo, useState } from "react";
import {
  DUTCHING_MAX_OUTCOMES,
  dutching,
  parseOdds,
  type DutchingRounding,
} from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, Segmented, num, parseAmount, pct, signed, signedPct, toneOf } from "./parts";
import { Meter, type MeterSegment } from "./Meter";

type Mode = "total" | "target";

export function DutchingCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  // Default 2.10/3.60/3.60: è l'esempio lavorato nel testo della pagina (somma
  // 103.17%, −3.08% su 100) — chi arriva vede i numeri che poi legge spiegati.
  const [legs, setLegs] = useState<string[]>(["2.10", "3.60", "3.60"]);
  const [mode, setMode] = useState<Mode>("total");
  const [amount, setAmount] = useState("100");
  const [rounding, setRounding] = useState("0");

  const { result, probe } = useMemo(() => {
    const decimals = legs.map((l) => parseOdds(l, "decimal"));
    if (!decimals.every((d): d is number => d !== null)) return { result: null, probe: null };
    const value = parseAmount(amount);
    if (value === null) return { result: null, probe: null };
    const result = dutching({
      decimals,
      mode,
      amount: value,
      roundTo: Number(rounding) as DutchingRounding,
    });
    // In modalità profitto, con la somma ≥ 100% nessuno stake dà il profitto
    // chiesto e `dutching` torna null: ma le quote sono valide e "non si può"
    // è un verdetto. Una sonda a stake 1 recupera la somma per dirlo.
    const probe =
      result === null && mode === "target"
        ? dutching({ decimals, mode: "total", amount: 1 })
        : null;
    return { result, probe };
  }, [legs, mode, amount, rounding]);

  const shown = result ?? probe;
  const sum = shown?.impliedSum;
  const isWin = result !== null && result.profitPercent > 0;
  const worstProfit = result ? Math.min(...result.profits) : undefined;

  // La traccia è il 100% del mercato: stessa geometria dell'arbitraggio — se le
  // quote lo coprono per meno, la coda è il margine che resta a te; se lo
  // sforano, la traccia si allunga e il marcatore mostra dove cade il 100%.
  const meterSegments: MeterSegment[] =
    sum === undefined
      ? []
      : sum < 1
        ? [
            { value: sum, tone: "fair" },
            { value: 1 - sum, tone: "edge" },
          ]
        : [
            { value: 1, tone: "fair" },
            { value: sum - 1, tone: "margin" },
          ];

  const verdict = (() => {
    if (result) {
      const p = pct(Math.abs(result.profitPercent), dash);
      if (result.profitPercent > 0) return L.verdictWin.replace("{pct}", p);
      if (result.profitPercent < 0) return L.verdictLoss.replace("{pct}", p);
      return L.verdictFlat;
    }
    return probe ? L.verdictUnreachable : null;
  })();

  const setLeg = (i: number, v: string) =>
    setLegs((prev) => prev.map((p, j) => (j === i ? v : p)));

  return (
    <div className="tl-calc tl-calc--dutching">
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
        {legs.length < DUTCHING_MAX_OUTCOMES && (
          <button type="button" className="tl-btn" onClick={() => setLegs((prev) => [...prev, ""])}>
            {L.addOutcome}
          </button>
        )}
        <Segmented
          label={L.modeTitle}
          value={mode}
          onChange={(id) => setMode(id as Mode)}
          options={[
            { id: "total", label: L.modeTotal },
            { id: "target", label: L.modeTarget },
          ]}
        />
        <Field
          label={mode === "total" ? L.total : L.targetProfit}
          value={amount}
          onChange={setAmount}
          placeholder="100"
        />
        <Segmented
          label={L.roundTitle}
          value={rounding}
          onChange={setRounding}
          options={[
            { id: "0", label: L.roundNone },
            { id: "1", label: "1" },
            { id: "5", label: "5" },
            { id: "10", label: "10" },
          ]}
        />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout
          label={L.profit}
          testId="out-dutch-profit"
          value={signed(worstProfit, dash)}
          tone={toneOf(worstProfit)}
          strong
        />
        <Readout
          label={L.profitPercent}
          testId="out-dutch-percent"
          value={signedPct(shown?.profitPercent, dash)}
          tone={toneOf(shown?.profitPercent)}
        />
        <Readout label={L.totalStake} testId="out-dutch-total" value={num(result?.totalStake, dash)} />
        <Readout label={L.coverage} testId="out-dutch-sum" value={pct(sum, dash)} />
        {legs.map((_, i) => (
          <Readout
            key={i}
            label={`${L.stakeOn} ${i + 1}`}
            testId={`out-dutch-stake-${i + 1}`}
            value={num(result?.stakes[i], dash)}
          />
        ))}
        {legs.map((_, i) => (
          <Readout
            key={i}
            label={`${L.returnOn} ${i + 1}`}
            testId={`out-dutch-return-${i + 1}`}
            value={num(result?.returns[i], dash)}
          />
        ))}
        <Readout label={L.meanOdds} testId="out-dutch-mean" value={num(shown?.meanOdds, dash)} />
        <Readout
          label={L.breakEvenOdds}
          testId="out-dutch-breakeven"
          value={num(shown?.breakEvenOdds, dash)}
        />
        <Meter
          segments={meterSegments}
          markers={[{ at: 1 / Math.max(sum ?? 1, 1), label: "100%" }]}
        />
        {verdict ? <p className={`tl-verdict ${isWin ? "" : "is-warn"}`}>{verdict}</p> : null}
      </div>
    </div>
  );
}
