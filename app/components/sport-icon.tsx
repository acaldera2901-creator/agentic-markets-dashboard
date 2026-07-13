// app/components/sport-icon.tsx
// #SPORT-ICONS-1 / #SPORT-ICONS-2: i NUOVI loghi sport (palla/pallina/trofeo
// trasparenti con scia coral) vivono come raster in /public/banners. Questo helper
// li monta sia nei punti PROMINENTI (header di sezione, FeaturedEdge, hub World Cup)
// sia — dal 2026-06-18 — nei punti PICCOLI (top-card ~15px, righe tabella ~16px,
// filtri ~14px, ticker ~13px, rail ~17px), dove però usiamo varianti raster
// OTTIMIZZATE (-sm.png, 64px, alpha ripulita) per restare nitidi a quelle dimensioni
// invece di scalare il master da 320px (che impastava e pesava 10x sui byte).
//
// Sorgenti:
//   master  : public/banners/sport-{football,tennis,worldcup}.png       (320px, scia piena)
//   small   : public/banners/sport-{football,tennis,worldcup}-sm.png    (64px, alpha pulita)
// 2026-06-18 (override Andrea): il World Cup HA ora la variante -sm (downscale Lanczos
// dal master + tail-haze ripulita) e usa il NUOVO logo trofeo anche ai piccoli (13–17px)
// — non più il glifo vettoriale #g-trophy. A queste dimensioni il trofeo gold resta
// leggibile con la sua scia coral; vedi <SportMark>.
//
// NON usare next/image: replichiamo il pattern <img> già adottato dai tasti landing
// (.lp-sport-img) per coerenza e zero dipendenze dalla pipeline immagini.

type SportKind = "football" | "tennis" | "worldcup";

const SRC: Record<SportKind, string> = {
  football: "/banners/sport-football.png",
  tennis: "/banners/sport-tennis.png",
  worldcup: "/banners/sport-worldcup.png",
};

// varianti 64px ottimizzate per i contesti ≤24px (alpha-tail ripulita, downscale Lanczos)
const SRC_SM: Partial<Record<SportKind, string>> = {
  football: "/banners/sport-football-sm.png",
  tennis: "/banners/sport-tennis-sm.png",
  worldcup: "/banners/sport-worldcup-sm.png",
};

export function SportIcon({
  sport,
  size = 22,
  className,
  variant = "auto",
}: {
  sport: SportKind;
  /** lato del box quadrato in px; il logo è contain dentro al box */
  size?: number;
  className?: string;
  /** "auto" sceglie il master sopra 24px e la variante -sm sotto; "lg" forza il master */
  variant?: "auto" | "lg" | "sm";
}) {
  const useSmall =
    (variant === "sm" || (variant === "auto" && size <= 24)) && SRC_SM[sport] != null;
  const src = useSmall ? (SRC_SM[sport] as string) : SRC[sport];
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      // contain: i loghi hanno alpha e proporzioni proprie, non vanno croppati.
      // image-rendering auto: sono foto, il bicubic del browser sul -sm (64→~16px,
      // downscale ≤4x già ottimizzato) resta più morbido di un nearest.
      style={{ width: size, height: size, objectFit: "contain", display: "block", flex: "0 0 auto" }}
    />
  );
}

// SportMark — usato nei contesti PICCOLI: football/tennis/worldcup montano tutti il
// logo raster (variante -sm). Dal 2026-06-18 anche il World Cup usa il nuovo logo
// trofeo (override Andrea), non più il glifo vettoriale #g-trophy. `className` va
// all'<img> renderizzato, così eredita il sizing/box del contesto esistente.
export function SportMark({
  sport,
  size,
  className,
}: {
  sport: SportKind;
  size?: number;
  className?: string;
}) {
  return <SportIcon sport={sport} size={size} className={className} variant="sm" />;
}
