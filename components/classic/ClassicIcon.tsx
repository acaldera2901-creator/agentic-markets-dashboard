// components/classic/ClassicIcon.tsx — #CLASSIC-ASSET-1013 · le icone 3D della lobby
//
// Lo stesso set matte royal + lime già in produzione (public/icons/menu-*,
// market-*: feedback_custom_icons_keep.md) più i pezzi nuovi `classic-*` fatti
// nello stesso stile. Master 320 px e variante -sm 64 px: il browser sceglie
// per densità (`sizes` = la misura resa), non per soglia fissa come MenuIcon.
// Niente next/image: sono PNG trasparenti sotto i 10 KB, già ottimizzati.
//
// NON si usano qui: `nav-*` e `bottomnav-*` (stile glossy elettrico) e `sport-*`
// (swoosh arancio fuori palette) — un rail con due stili è un rail senza stile.
export type ClassicIconName =
  | "menu-prediction" | "menu-history" | "menu-tools" | "menu-partner"
  | "market-result" | "market-soft"
  | "classic-tennis" | "classic-live" | "classic-popular" | "classic-board";

export function ClassicIcon({ name, size = 20, className }: { name: ClassicIconName; size?: number; className?: string }) {
  return (
    <img
      className={["brc-ico", className].filter(Boolean).join(" ")}
      src={`/icons/${name}-sm.png`}
      srcSet={`/icons/${name}-sm.png 64w, /icons/${name}.png 320w`}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
    />
  );
}
