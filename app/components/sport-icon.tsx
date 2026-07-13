// app/components/sport-icon.tsx
// #PRO-ICONS: SportIcon rende ora il GLIFO SVG sleek-coral (line-art, stroke ~1.5,
// UNA forma in --am-coral) dalla sprite #g-* — non più i raster 3D di /public/banners.
// Coerenza piena col resto del branding a glifo (rail, nav, hero): l'icona eredita
// currentColor dal contesto + l'accent coral razionato, e resta nitida a QUALSIASI
// dimensione (13–17px card/righe fino ai 40px+ header) senza bitmap né -sm.
//
// Mappatura sport → glifo (sprite in app/components/sport-glyphs.tsx):
//   football / soccer → #g-ball   (pallone: cerchio + pentagono coral)
//   tennis            → #g-tball  (pallina: cerchio + cuciture coral — parallela al pallone,
//                                  più pulita del racket a piccole dimensioni)
//   worldcup          → #g-trophy (trofeo: coppa + gemma coral)
//
// La sprite (<SportGlyphSprite/>) è già montata su tutte le pagine che usano SportIcon
// (landing, /app board, world-cup, weekly-pick). API invariata: i ~24 call-site non cambiano.
// `variant` è mantenuto per compat di firma ma non incide più (nessuna variante raster).

type SportKind = "football" | "tennis" | "worldcup";

const GLYPH: Record<SportKind, string> = {
  football: "#g-ball",
  tennis: "#g-tball",
  worldcup: "#g-trophy",
};

export function SportIcon({
  sport,
  size = 22,
  className,
  variant: _variant = "auto",
}: {
  sport: SportKind;
  /** lato del box quadrato in px */
  size?: number;
  className?: string;
  /** mantenuto per compat di firma; non incide (i glifi SVG scalano puliti a ogni size) */
  variant?: "auto" | "lg" | "sm";
}) {
  const href = GLYPH[sport] ?? GLYPH.football;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      style={{ width: size, height: size, display: "block", flex: "0 0 auto" }}
    >
      <use href={href} />
    </svg>
  );
}

// SportMark — contesti PICCOLI: delega a SportIcon (stesso glifo SVG, scala pulita).
// `className` va all'<svg>, così eredita sizing/box/color del contesto esistente.
export function SportMark({
  sport,
  size,
  className,
}: {
  sport: SportKind;
  size?: number;
  className?: string;
}) {
  return <SportIcon sport={sport} size={size} className={className} />;
}
