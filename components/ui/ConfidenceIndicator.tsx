// components/ui/ConfidenceIndicator.tsx — #RESTYLING-0921
// Evoluzione di ConfidenceMeter per il nuovo sistema. Il brief lo vuole
// SECONDARIO rispetto a Model/Market/Edge, quindi: segmenti piccoli, colore
// strutturale (royal), niente verde, testo in inglese (il prodotto è in
// inglese; ConfidenceMeter resta com'è per il desk legacy). Il numero di
// segmenti e la parola portano la stessa informazione: regge anche senza colore.
import { confidenceBucket, confidencePercent, type ConfidenceBucket } from "@/lib/ui/confidence";

const SEGMENTS: Record<ConfidenceBucket, number> = { alta: 5, media: 3, bassa: 2 };
const WORD: Record<ConfidenceBucket, string> = { alta: "High", media: "Medium", bassa: "Low" };

type Props = {
  score: number | null;
  layout?: "inline" | "stack";
  showLabel?: boolean;
  showPercent?: boolean;
  className?: string;
};

export function ConfidenceIndicator({ score, layout = "inline", showLabel = true, showPercent = false, className }: Props) {
  const bucket = confidenceBucket(score);
  const on = SEGMENTS[bucket];
  const pct = confidencePercent(score);
  return (
    <div
      className={["br-conf", className].filter(Boolean).join(" ")}
      data-bucket={bucket}
      data-layout={layout}
      role="img"
      aria-label={`Model confidence ${WORD[bucket].toLowerCase()}${showPercent ? `, ${pct}%` : ""}`}
    >
      {showLabel && <span className="br-label">Confidence</span>}
      <span className="br-conf__segs" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <i key={i} data-on={i < on} />)}
      </span>
      <span className="br-conf__val" aria-hidden="true">
        {WORD[bucket]}{showPercent ? ` · ${pct}%` : ""}
      </span>
    </div>
  );
}
