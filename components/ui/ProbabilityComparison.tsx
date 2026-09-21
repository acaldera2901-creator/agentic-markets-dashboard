// components/ui/ProbabilityComparison.tsx — #RESTYLING-0921
//
// La riga che fa la card: MODEL | MARKET | EDGE, sempre in quest'ordine, su
// ogni dispositivo. Il numero sopra, grande e pesante; la label sotto, piccola
// e leggera. Sotto, una barra di 4px: fill azzurro fino al mercato, tacca
// bianca sul modello, il GAP fra i due colorato. È la domanda «perché?» resa
// visibile senza scriverla.
//
// Senza prezzo di mercato: il mercato è «—», l'edge è «—», la barra mostra
// solo la tacca del modello. Non si inventa un confronto che non c'è.
import { EdgeBadge } from "@/components/ui/EdgeBadge";
import { edgeTone, formatEdge, formatPct } from "@/lib/ui/prediction-card";

export type ProbabilitySize = "sm" | "md" | "lg";

type Props = {
  modelPct: number | null;
  marketPct: number | null;
  edgePct: number | null;
  size?: ProbabilitySize;
  locked?: boolean;
  showBar?: boolean;
  className?: string;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function ProbabilityComparison({ modelPct, marketPct, edgePct, size = "md", locked = false, showBar = true, className }: Props) {
  const hasMarket = marketPct != null && Number.isFinite(marketPct);
  const hasModel = modelPct != null && Number.isFinite(modelPct);
  const m = hasModel ? clamp(modelPct!) : null;
  const k = hasMarket ? clamp(marketPct!) : null;
  const gap = m != null && k != null ? { left: Math.min(m, k), width: Math.abs(m - k), tone: edgeTone(m - k) } : null;

  const aria = [
    hasModel ? `Model ${formatPct(m)}%` : "Model not available",
    hasMarket ? `market ${formatPct(k)}%` : "no market price",
    locked ? "edge on Pro" : hasMarket ? `edge ${formatEdge(edgePct)} points` : "no edge claimed",
  ].join(", ");

  return (
    <div className={["br-prob", className].filter(Boolean).join(" ")} data-size={size} data-market={hasMarket ? "yes" : "none"}>
      <div className="br-prob__cell" data-role="model">
        <span className="br-prob__num">{formatPct(m)}{hasModel && <span className="br-prob__pc">%</span>}</span>
        <span className="br-label">Model</span>
      </div>
      <div className="br-prob__cell" data-role="market" data-empty={hasMarket ? "false" : "true"}>
        <span className="br-prob__num">{formatPct(k)}{hasMarket && <span className="br-prob__pc">%</span>}</span>
        <span className="br-label">Market</span>
      </div>
      <div className="br-prob__cell" data-role="edge">
        <EdgeBadge edgePct={hasMarket ? edgePct : null} size={size} locked={locked} />
        <span className="br-label">Edge</span>
      </div>
      {showBar && (
        <div className="br-prob__bar" role="img" aria-label={aria}>
          {k != null && <span className="br-prob__bar-market" style={{ width: `${k}%` }} />}
          {gap && gap.tone !== "flat" && gap.tone !== "none" && (
            <span className="br-prob__bar-gap" data-tone={gap.tone} style={{ left: `${gap.left}%`, width: `${gap.width}%` }} />
          )}
          {m != null && <span className="br-prob__bar-model" style={{ left: `${m}%` }} />}
        </div>
      )}
    </div>
  );
}
