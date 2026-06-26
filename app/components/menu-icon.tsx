// app/components/menu-icon.tsx
// #MENU-ICONS-0626: icone illustrate del menu sinistro (rail), stile "come il
// World Cup" — raster 3D oggetto su trasparente + scia coral. Master 320px in
// /public/icons/menu-*.png, variante -sm 64px ottimizzata per il rail (~17px).
// Stesso pattern di SportIcon (img, niente next/image). World Cup resta su SportIcon.
type MenuName = "prediction" | "history" | "plans" | "creator" | "builder";

const SRC: Record<MenuName, string> = {
  prediction: "/icons/menu-prediction.png",
  history: "/icons/menu-history.png",
  plans: "/icons/menu-plans.png",
  creator: "/icons/menu-creator.png",
  builder: "/icons/menu-builder.png",
};
const SRC_SM: Record<MenuName, string> = {
  prediction: "/icons/menu-prediction-sm.png",
  history: "/icons/menu-history-sm.png",
  plans: "/icons/menu-plans-sm.png",
  creator: "/icons/menu-creator-sm.png",
  builder: "/icons/menu-builder-sm.png",
};

export function MenuIcon({
  name,
  size = 17,
  className,
}: {
  name: MenuName;
  size?: number;
  className?: string;
}) {
  const src = size <= 24 ? SRC_SM[name] : SRC[name];
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", display: "block", flex: "0 0 auto" }}
    />
  );
}
