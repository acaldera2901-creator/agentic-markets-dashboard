// components/ui/LiveBadge.tsx — #RESTYLING-0921
// Il giallo neon è un accento: la parola LIVE in giallo con il suo segno
// (IconLive) e il minuto. Round 3: niente fill, niente alone, niente puntino
// che pulsa — «sta succedendo adesso» lo dicono il colore del testo e l'icona,
// e in una card il giallo resta l'UNICO elemento colorato oltre al testo. Il
// minuto usa il primo tipografico (′).
import { IconLive } from "@/components/ui/icons";

type Props = {
  minute?: string | number | null;
  label?: string;
  className?: string;
};

export function LiveBadge({ minute, label = "Live", className }: Props) {
  const min = minute == null || minute === "" ? null : String(minute).replace(/['′]$/, "");
  return (
    <span className={["br-live", className].filter(Boolean).join(" ")} role="status">
      <IconLive size={12} stroke={2} />
      {label}
      {min != null && <span className="br-live__min">{min}&prime;</span>}
    </span>
  );
}
