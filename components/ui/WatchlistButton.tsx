"use client";
// components/ui/WatchlistButton.tsx — #RESTYLING-0921
// Controllato dal genitore (saved/onToggle): la card non sa dove vive la
// watchlist. Lo stato salvato è ROYAL (struttura/selected), non verde: il
// verde è dell'edge. aria-pressed dice lo stato agli screen reader, la label
// cambia col verbo. 32px su desktop, 40px al pollice (design-system.css).
import { GlyphBookmark } from "@/components/ui/glyphs";

type Props = {
  saved: boolean;
  onToggle: () => void;
  className?: string;
  labels?: { save: string; remove: string };
};

export function WatchlistButton({ saved, onToggle, className, labels }: Props) {
  const l = labels ?? { save: "Save to watchlist", remove: "Remove from watchlist" };
  return (
    <button
      type="button"
      className={["br-watch", className].filter(Boolean).join(" ")}
      aria-pressed={saved}
      aria-label={saved ? l.remove : l.save}
      title={saved ? l.remove : l.save}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <GlyphBookmark size={16} />
    </button>
  );
}
