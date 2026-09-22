// components/ui/EdgeBadge.tsx — #RESTYLING-0921
//
// L'edge è un numero con un segno, non una parola. Verde SOLO se positivo e
// oltre il rumore (EDGE_FLAT_PP), rosso se negativo, neutro se piatto,
// «—» se non c'è un prezzo di mercato: senza mercato non si dichiara un edge.
import { IconLock } from "@/components/ui/icons";
import { edgeTone, formatEdge } from "@/lib/ui/prediction-card";

export type EdgeBadgeSize = "chip" | "sm" | "md" | "lg";

type Props = {
  edgePct: number | null | undefined;
  size?: EdgeBadgeSize;
  /** Pick Pro: mostra il lucchetto al posto del numero. */
  locked?: boolean;
  className?: string;
};

export function EdgeBadge({ edgePct, size = "chip", locked = false, className }: Props) {
  if (locked) {
    return (
      <span className={["br-edge", className].filter(Boolean).join(" ")} data-tone="locked" data-size={size} aria-label="Edge available on Pro">
        <IconLock size={size === "chip" ? 12 : 14} stroke={2} />Pro
      </span>
    );
  }
  const tone = edgeTone(edgePct);
  const text = formatEdge(edgePct);
  return (
    <span
      className={["br-edge", className].filter(Boolean).join(" ")}
      data-tone={tone}
      data-size={size}
      aria-label={tone === "none" ? "No market price, no edge claimed" : `Edge ${text} points`}
    >
      {text}
      {tone !== "none" && <span className="br-edge__pc" aria-hidden="true">%</span>}
    </span>
  );
}
