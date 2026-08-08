"use client";
// components/tools/StakeCalculator.tsx (#TOOLS-11-0808)
// Lo stake che serve per vincere una cifra decisa in partenza. È il calcolo che
// la gente cerca e il ragionamento peggiore che possa fare, quindi la pagina
// mostra il numero E la sua conseguenza: la fetta di cassa che quello stake
// impegna. Senza quella terza riga il tool sarebbe solo una divisione.
//
// Il campo bankroll non è decorativo ed è per questo un CAMPO e non una
// costante: la fetta di cassa dipende da una cifra che solo chi legge conosce,
// e un 6,67% calcolato su un 1.000 assunto in silenzio non vorrebbe dire nulla.

import { useMemo, useState } from "react";
import { parseOdds, stakeForTarget } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, num, parseAmount, pct } from "./parts";
import { Meter, type MeterSegment } from "./Meter";

// Soglia del verdetto, la stessa del bankroll calculator: sopra il 5% di cassa
// per giocata una serie negativa ordinaria diventa un problema. Non è nascosta —
// entrambe le versioni del verdetto scrivono il numero, come su Kelly e yield.
const HEAVY_SHARE = 0.05;

export function StakeCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  // Default 2.50 / 100 / 1.000: sono i numeri dell'esempio lavorato più sotto
  // (stake 66.67, ritorno 166.67, 6.67% della cassa). Chi apre la pagina vede
  // subito il caso di cui parla il testo.
  const [odds, setOdds] = useState("2.50");
  const [target, setTarget] = useState("100");
  const [bankroll, setBankroll] = useState("1000");

  const result = useMemo(() => {
    const decimal = parseOdds(odds, "decimal");
    const targetProfit = parseAmount(target);
    if (decimal === null || targetProfit === null) return null;
    const stake = stakeForTarget({ targetProfit, decimal });
    if (stake === null) return null;
    // La cassa è l'unico input che può mancare senza fermare il calcolo: lo
    // stake resta valido, la fetta diventa il trattino.
    const bank = parseAmount(bankroll);
    return {
      stake,
      totalReturn: stake + targetProfit,
      share: bank === null ? null : stake / bank,
    };
  }, [odds, target, bankroll]);

  const share = result?.share ?? null;
  const heavy = share !== null && share > HEAVY_SHARE;

  // La traccia è la cassa intera: la fetta impegnata contro tutto il resto, col
  // marcatore al 5%. È l'unico modo per far vedere che «66,67» non è un numero
  // grande o piccolo in sé — lo diventa accanto alla cassa che lo copre.
  const meterSegments: MeterSegment[] = !result || share === null
    ? []
    : [
        { value: Math.min(1, Math.max(0, share)), tone: heavy ? "loss" : "margin" },
        { value: Math.max(0, 1 - share), tone: "muted" },
      ];

  return (
    <div className="tl-calc tl-calc--stake">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        <Field label={L.odds} value={odds} onChange={setOdds} placeholder="2.50" />
        <Field label={L.targetProfit} value={target} onChange={setTarget} placeholder="100" />
        <Field label={L.bankroll} value={bankroll} onChange={setBankroll} placeholder="1000" />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout
          label={L.stakeNeeded}
          testId="out-stake-needed"
          value={num(result?.stake, dash)}
          strong
        />
        <Readout
          label={L.totalReturn}
          testId="out-total-return"
          value={num(result?.totalReturn, dash)}
        />
        <Readout
          label={L.bankrollShare}
          testId="out-bankroll-share"
          value={pct(share, dash)}
          tone={heavy ? "down" : undefined}
        />
        <Meter
          segments={meterSegments}
          markers={share === null ? [] : [{ at: HEAVY_SHARE, label: pct(HEAVY_SHARE, dash, 0) }]}
        />
        <p className={`tl-verdict ${heavy ? "is-warn" : ""}`}>
          {heavy ? L.verdictHeavy : L.verdictModest}
        </p>
      </div>
    </div>
  );
}
