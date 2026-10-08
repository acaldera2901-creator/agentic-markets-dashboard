// components/v3c/Nastro.tsx (#REDESIGN-V3C F1)
// Il nastro mercato–stima: due punti su una scala comune con la finestra
// dichiarata (30–60%), etichette dirette sui punti, il gap in punti. Sky =
// mercato, lime = stima, tratteggio inchiostro = il gap. Sostituisce il «Price
// Temp»: non c'è un termometro, c'è una misura.
import { describeScale, formatSigned, gapPp, isFlat, positionIn, scaleWindow } from "@/lib/v3c/scale";

type Props = {
  /** % di mercato, margine rimosso. */
  market: number;
  /** % della stima. */
  estimate: number;
  marketLabel?: string;
  estimateLabel?: string;
  className?: string;
  /** F4: il gap esatto già mostrato accanto (es. −1.5 pp). Senza, si calcola dai due interi e può dire «gap −2» dove la pagina dice «in line». */
  gap?: number | null;
  /** F10: le due parole sotto la scala nella lingua del visitatore (board.inLine / board.gapWord). */
  inLineLabel?: string;
  gapLabel?: string;
};

export function Nastro({ market, estimate, marketLabel = "Market", estimateLabel = "Estimate", className, gap, inLineLabel = "in line", gapLabel = "gap" }: Props) {
  const w = scaleWindow(market, estimate);
  const g = gap != null && Number.isFinite(gap) ? Math.round(gap * 10) / 10 : gapPp(market, estimate);
  // fixq (QA-4 Q9): the exact gap is written exactly as beside it (gapText → toFixed(1)): a table «+4.0» never meets a bar «+4.1»
  const gText = gap != null && Number.isFinite(gap) ? formatSigned(gap, 1) : formatSigned(g);
  const lo = Math.min(market, estimate);
  const hi = Math.max(market, estimate);
  const pct = (v: number) => `${positionIn(v, w).toFixed(2)}%`;
  return (
    <div className={["v3c-gl", className].filter(Boolean).join(" ")} role="img" aria-label={describeScale(market, estimate)}>
      <div className="v3c-gl-track">
        {w.ticks.map((t) => (
          <u key={t} style={{ left: pct(t) }} />
        ))}
        <b style={{ left: pct(lo), width: `${(((hi - lo) / (w.hi - w.lo)) * 100).toFixed(2)}%` }} />
        <i className="v3c-tm" style={{ left: pct(market) }}>
          <span>
            {marketLabel}
            <b>{market}%</b>
          </span>
        </i>
        <i className="v3c-te" style={{ left: pct(estimate) }}>
          <span>
            {estimateLabel}
            <b>{estimate}%</b>
          </span>
        </i>
      </div>
      <div className="v3c-gl-k" aria-hidden="true">
        <span>{w.lo}%</span>
        <span className={["v3c-gl-g", isFlat(g) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
          {isFlat(g) ? inLineLabel : gapLabel} <b>{gText} pp</b>
        </span>
        <span>{w.hi}%</span>
      </div>
    </div>
  );
}
