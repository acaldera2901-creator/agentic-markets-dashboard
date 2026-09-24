// app/components/menu-icon.tsx
// #MENU-ICONS-0626: icone illustrate del menu sinistro (rail), stile "come il
// World Cup" — raster 3D oggetto su trasparente + scia coral. Master 320px in
// /public/icons/menu-*.png, variante -sm 64px ottimizzata per il rail (~17px).
// Stesso pattern di SportIcon (img, niente next/image). World Cup resta su SportIcon.
type MenuName =
  | "prediction" | "history" | "plans" | "creator" | "builder"
  // #RAIL-ICONS-V2: podio classifica, busta invito, biglietto weekly pick, stemma account.
  | "leaderboard" | "invite" | "weeklypick" | "account"
  // #PARTNERS-RAIL-1: stretta di mano (vetrina /partners nel rail).
  | "partner"
  // #TOOLS-HUB-0805: calcolatrice (hub /tools nel rail, al posto della World Cup).
  | "tools";

const SRC: Record<MenuName, string> = {
  prediction: "/icons/menu-prediction.png",
  history: "/icons/menu-history.png",
  plans: "/icons/menu-plans.png",
  creator: "/icons/menu-creator.png",
  builder: "/icons/menu-builder.png",
  leaderboard: "/icons/menu-leaderboard.png",
  invite: "/icons/menu-invite.png",
  weeklypick: "/icons/menu-weeklypick.png",
  account: "/icons/menu-account.png",
  partner: "/icons/menu-partner.png",
  tools: "/icons/menu-tools.png",
};
const SRC_SM: Record<MenuName, string> = {
  prediction: "/icons/menu-prediction-sm.png",
  history: "/icons/menu-history-sm.png",
  plans: "/icons/menu-plans-sm.png",
  creator: "/icons/menu-creator-sm.png",
  builder: "/icons/menu-builder-sm.png",
  leaderboard: "/icons/menu-leaderboard-sm.png",
  invite: "/icons/menu-invite-sm.png",
  weeklypick: "/icons/menu-weeklypick-sm.png",
  account: "/icons/menu-account-sm.png",
  partner: "/icons/menu-partner-sm.png",
  tools: "/icons/menu-tools-sm.png",
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

// #RESTYLING-0921 round 5 — le icone della NAV PRIMARIA.
//
// Componente a sé e non un nome in più dentro `MenuIcon`: il nome `tools`
// esiste già lì e punta a `menu-tools.png` (la calcolatrice del menu Account).
// Sono due set con due mestieri — il menu illustra una voce di servizio, la
// nav sta in cima a ogni pagina — e farli collidere su una chiave avrebbe
// significato scegliere quale dei due perdere.
//
// Sostituiscono le SVG flat del round 3 (`IconHome`/`IconLive`/`IconFootball`/
// `IconTennis`/`IconTools` in components/ui/icons.tsx), che restano in uso
// altrove (bottom-nav, chip, card): qui cambia la nav, non il registro.
type NavName = "home" | "live" | "football" | "tennis" | "tools";

const NAV_SRC: Record<NavName, string> = {
  home: "/icons/nav-home.png",
  live: "/icons/nav-live.png",
  football: "/icons/nav-football.png",
  tennis: "/icons/nav-tennis.png",
  tools: "/icons/nav-tools.png",
};
const NAV_SRC_SM: Record<NavName, string> = {
  home: "/icons/nav-home-sm.png",
  live: "/icons/nav-live-sm.png",
  football: "/icons/nav-football-sm.png",
  tennis: "/icons/nav-tennis-sm.png",
  tools: "/icons/nav-tools-sm.png",
};

export type { NavName };

export function NavIcon({
  name,
  size = 18,
  className,
}: {
  name: NavName;
  size?: number;
  className?: string;
}) {
  // Stessa soglia di MenuIcon: il master 320px sotto i 24px impasta, la -sm è
  // un 64px con l'alpha già ripulita.
  const src = size <= 24 ? NAV_SRC_SM[name] : NAV_SRC[name];
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

// #NAV-ICONS-ELECTRIC-0924 — la BOTTOM BAR mobile (.am-bottomnav, 5 voci:
// home/live/watchlist/tools/profile). Fin qui usava le SVG flat del round 3
// (components/ui/icons.tsx, `<Icon name={...} />`), l'unico posto rimasto
// fuori dallo stile "electric" introdotto round 14 sulle tool icons e
// round 5 sulla nav primaria — la lamentela di Andrea del 24/09 ("icone
// stilizzate non nel nostro stile") era su QUESTA barra.
//
// Le chiavi ricalcano `IconName` di components/ui/icons.tsx usate da
// BOTTOM_TABS in app/app/page.tsx ("bookmark" = watchlist) così il chiamante
// non cambia forma, cambia solo il componente che rende l'icona.
type BottomNavName = "home" | "live" | "bookmark" | "tools" | "profile";

const BOTTOMNAV_SRC: Record<BottomNavName, string> = {
  home: "/icons/bottomnav-home.png",
  live: "/icons/bottomnav-live.png",
  bookmark: "/icons/bottomnav-watchlist.png",
  tools: "/icons/bottomnav-tools.png",
  profile: "/icons/bottomnav-profile.png",
};
const BOTTOMNAV_SRC_SM: Record<BottomNavName, string> = {
  home: "/icons/bottomnav-home-sm.png",
  live: "/icons/bottomnav-live-sm.png",
  bookmark: "/icons/bottomnav-watchlist-sm.png",
  tools: "/icons/bottomnav-tools-sm.png",
  profile: "/icons/bottomnav-profile-sm.png",
};

export type { BottomNavName };

export function BottomNavIcon({
  name,
  size = 22,
  className,
}: {
  name: BottomNavName;
  size?: number;
  className?: string;
}) {
  // Stessa soglia di NavIcon/MenuIcon: il master 320px sotto i 24px impasta.
  // La bottom bar renderizza a 22px → prende sempre la -sm.
  const src = size <= 24 ? BOTTOMNAV_SRC_SM[name] : BOTTOMNAV_SRC[name];
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
