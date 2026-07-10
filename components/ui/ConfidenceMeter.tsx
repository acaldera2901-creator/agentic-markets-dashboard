import { confidenceBucket, confidenceLabel, confidencePercent, type ConfidenceBucket } from "@/lib/ui/confidence";
import { Chip } from "@/components/ui/Chip";

const SEGMENTS: Record<ConfidenceBucket, number> = { alta: 5, media: 3, bassa: 2 };
const CHIP: Record<ConfidenceBucket, "high" | "mid" | "low"> = { alta: "high", media: "mid", bassa: "low" };
const SEGCOLOR: Record<ConfidenceBucket, string> = {
  alta: "var(--am-green)", media: "var(--am-amber)", bassa: "var(--am-muted-2)",
};

export function ConfidenceMeter({ score, showPercent }: { score: number | null; showPercent?: boolean }) {
  const bucket = confidenceBucket(score);
  const on = SEGMENTS[bucket];
  const pct = confidencePercent(score);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--am-muted-2)" }}>
          Sicurezza del modello
        </span>
        <Chip variant={CHIP[bucket]}>{confidenceLabel(bucket)}{showPercent ? ` · ${pct}%` : ""}</Chip>
      </div>
      <div style={{ display: "flex", gap: 3, height: 8 }}>
        {Array.from({ length: 5 }, (_, i) => {
          const active = i < on;
          return (
            <span key={i} data-on={active}
              style={{ flex: 1, borderRadius: 3, background: active ? SEGCOLOR[bucket] : "var(--am-panel-3)" }} />
          );
        })}
      </div>
    </div>
  );
}
