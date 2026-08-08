"use client";
// components/tools/BankrollCalculator.tsx (#TOOLS-11-0808)
// Stake piatto in percentuale: unità, costo di una serie negativa, e quante
// giocate perse di fila la cassa copre. È l'altra metà dello stake calculator —
// là si parte da quanto vuoi vincere, qui da una regola che non chiede il tuo
// parere sul singolo evento. Il numero che decide non è l'unità: è il drawdown
// della serie, ed è per questo che ha la barra.
//
// La lunghezza della serie è un CAMPO e non una costante: il drawdown dipende
// interamente da essa, e un 20% calcolato su un dieci assunto in silenzio
// sarebbe un numero senza padre. Il default (10) è l'esempio della pagina, e
// l'explainer dice quanto è probabile incontrarlo davvero.

import { useMemo, useState } from "react";
import { bankrollPlan, parseCount } from "@/lib/betting-math";
import type { ToolCopy } from "@/lib/tools/copy";
import { Field, Readout, num, parseAmount, parsePercent, pct } from "./parts";
import { Meter, type MeterSegment } from "./Meter";

// Stessa soglia dello stake calculator, e nessuna delle due la nasconde: sopra
// il 5% per unità la serie negativa ordinaria si porta via metà della cassa.
// Entrambe le versioni del verdetto scrivono il numero.
const AGGRESSIVE_UNIT = 0.05;

export function BankrollCalculator({ copy, dash }: { copy: ToolCopy; dash: string }) {
  const L = copy.labels;
  // Default 2.000 / 2% / 10: l'esempio lavorato della pagina — unità 40, serie
  // da 400, drawdown 20%, cassa che copre 50 giocate perse consecutive.
  const [bankroll, setBankroll] = useState("2000");
  const [unitPercent, setUnitPercent] = useState("2");
  const [streak, setStreak] = useState("10");

  const result = useMemo(() => {
    const bank = parseAmount(bankroll);
    const share = parsePercent(unitPercent);
    const losingStreak = parseCount(streak);
    if (bank === null || share === null || losingStreak === null) return null;
    return { plan: bankrollPlan({ bankroll: bank, unitPercent: share, losingStreak }), share };
  }, [bankroll, unitPercent, streak]);

  const plan = result?.plan ?? null;
  const aggressive = result !== null && result.share > AGGRESSIVE_UNIT;

  // La traccia è la cassa intera: quanto se ne porta la serie dichiarata contro
  // quanto ne resta, col marcatore a metà. Il 50% non è decorativo — è il punto
  // oltre il quale il recupero chiede di raddoppiare ciò che è rimasto.
  const drawdown = plan?.streakDrawdown ?? null;
  const meterSegments: MeterSegment[] = drawdown === null
    ? []
    : [
        { value: Math.min(1, Math.max(0, drawdown)), tone: "loss" },
        { value: Math.max(0, 1 - drawdown), tone: "fair" },
      ];

  return (
    <div className="tl-calc tl-calc--bankroll">
      <div className="tl-panel tl-panel--in">
        <h3 className="tl-panel-title">{L.inputTitle}</h3>
        <Field label={L.bankroll} value={bankroll} onChange={setBankroll} placeholder="2000" />
        <Field
          label={L.unitPercent}
          value={unitPercent}
          onChange={setUnitPercent}
          suffix="%"
          placeholder="2"
        />
        <Field label={L.losingStreak} value={streak} onChange={setStreak} placeholder="10" />
        <p className="tl-hint">{L.hint}</p>
      </div>

      <div className="tl-panel tl-panel--out">
        <h3 className="tl-panel-title">{L.resultTitle}</h3>
        <Readout label={L.unit} testId="out-unit" value={num(plan?.unit, dash)} strong />
        <Readout
          label={L.streakLoss}
          testId="out-streak-loss"
          value={num(plan?.streakLoss, dash)}
        />
        <Readout
          label={L.drawdown}
          testId="out-drawdown"
          value={pct(drawdown, dash)}
          tone={drawdown === null || drawdown === 0 ? undefined : "down"}
        />
        {/* Zero decimali: è un conteggio di giocate, non un importo. 50, non 50.00. */}
        <Readout
          label={L.betsToRuin}
          testId="out-bets-to-ruin"
          value={num(plan?.betsToRuin, dash, 0)}
        />
        <Meter
          segments={meterSegments}
          markers={drawdown === null ? [] : [{ at: 0.5, label: pct(0.5, dash, 0) }]}
        />
        <p className={`tl-verdict ${aggressive ? "is-warn" : ""}`}>
          {aggressive ? L.verdictAggressive : L.verdictSafe}
        </p>
      </div>
    </div>
  );
}
