"use client";

// components/MobileBottomNav.tsx — #TOOLS-BOTTOMNAV-0924
//
// La bottom bar mobile (Home/Live/Watchlist/Tools/Profilo) esiste da tempo
// dentro il desk (app/app/page.tsx, `.am-bottomnav`) ma solo lì: `/tools` e
// `/how-it-works` sono pagine statiche a parte e non la montavano mai — su
// telefono, da lì, si resta senza modo di tornare al prodotto in un tocco.
// Stesso markup/classi CSS del desk (`.am-bottomnav`/`.bn`/`.bn-l`, già
// definite in app/globals.css — nessun CSS nuovo), stesse icone
// (`BottomNavIcon`, round 15 "electric"). L'unica differenza: qui "attivo" è
// la PAGINA corrente (`active` passato dal chiamante), non uno stato React
// condiviso — queste pagine non hanno `tab`/`deskView`.
//
// Live/Watchlist puntano a `/predictions?view=live|watchlist`: il deep-link
// `?view=` (#DESKVIEW-DEEPLINK-0924, app/app/page.tsx) è stato aggiunto
// insieme a questo componente — prima non esisteva alcun modo di atterrare lì
// da fuori il desk, sempre e solo Home.
import Link from "next/link";
import { BottomNavIcon, type BottomNavName } from "@/app/components/menu-icon";

type Lang = "it" | "en" | "es" | "fr" | "ru";

function pick5(lang: Lang, s: Record<Lang, string>): string {
  return s[lang] ?? s.en;
}

const ITEMS: { id: BottomNavName; href: string; label: Record<Lang, string> }[] = [
  { id: "home", href: "/predictions", label: { it: "Home", en: "Home", es: "Inicio", fr: "Accueil", ru: "Главная" } },
  { id: "live", href: "/predictions?view=live", label: { it: "Live", en: "Live", es: "En vivo", fr: "Live", ru: "Лайв" } },
  { id: "bookmark", href: "/predictions?view=watchlist", label: { it: "Watchlist", en: "Watchlist", es: "Watchlist", fr: "Watchlist", ru: "Избранное" } },
  { id: "tools", href: "/tools", label: { it: "Strumenti", en: "Tools", es: "Herramientas", fr: "Outils", ru: "Инструменты" } },
  { id: "profile", href: "/plans", label: { it: "Profilo", en: "Profile", es: "Perfil", fr: "Profil", ru: "Профиль" } },
];

export function MobileBottomNav({
  lang = "en",
  active,
}: {
  lang?: Lang;
  /** Quale voce mostrare come corrente. `undefined` = nessuna (pagina che non
   *  corrisponde a nessuna delle 5, es. /how-it-works). */
  active?: BottomNavName;
}) {
  return (
    <nav className="am-bottomnav" aria-label="Mobile navigation">
      {ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`bn ${active === item.id ? "on" : ""}`}
          aria-current={active === item.id ? "page" : undefined}
        >
          <BottomNavIcon name={item.id} size={22} />
          <span className="bn-l">{pick5(lang, item.label)}</span>
        </Link>
      ))}
    </nav>
  );
}
