// app/components/sport-icon.tsx
// #SPORT-ICONS-1: i NUOVI loghi sport (palla/pallina/trofeo trasparenti con scia
// coral) vivono come raster in /public/banners. Questo helper li monta nei punti
// PROMINENTI (header di sezione, FeaturedEdge, hub World Cup) dove la scia coral
// rende come brand-moment. Nei punti minuscoli inline (ticker ~13px, righe tabella,
// filtri ~14px, top-card ~15px) restano i glifi vettoriali #g-* on-brand: un raster
// con scia a quelle dimensioni impasta e perde l'adattività currentColor/coral-on-state.
//
// Sorgente: public/banners/sport-{football,tennis,worldcup}.png (320px, alpha).
// NON usare next/image: replichiamo il pattern <img> già adottato dai tasti landing
// (.lp-sport-img) per coerenza e zero dipendenze dalla pipeline immagini.

type SportKind = "football" | "tennis" | "worldcup";

const SRC: Record<SportKind, string> = {
  football: "/banners/sport-football.png",
  tennis: "/banners/sport-tennis.png",
  worldcup: "/banners/sport-worldcup.png",
};

export function SportIcon({
  sport,
  size = 22,
  className,
}: {
  sport: SportKind;
  /** lato del box quadrato in px; il logo è contain dentro al box */
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={SRC[sport]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      // contain: i loghi hanno alpha e proporzioni proprie, non vanno croppati
      style={{ width: size, height: size, objectFit: "contain", display: "block", flex: "0 0 auto" }}
    />
  );
}
