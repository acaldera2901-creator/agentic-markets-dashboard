import type { MetadataRoute } from "next";
import { TOOL_LOCALES, TOOL_SLUGS, hubPath, toolPath } from "@/lib/tools/registry";

// #SEO-SCAFFOLDING-0721 — sitemap delle sole rotte pubbliche renderizzabili da
// anonimo (niente rotte dietro flag NEXT_PUBLIC_UX_NEW né aree auth/admin).
// Niente lastModified: il contenuto delle board cambia a ogni ciclo agenti, un
// timestamp di build mentirebbe; changeFrequency comunica la stessa cosa.
const BASE = "https://www.betredge.com";

type Entry = { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number };

const PUBLIC_ROUTES: Entry[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  // #URL-PATHS-0810: /app è diventato un redirect permanente → in sitemap vanno
  // i path veri del desk. Plans/history sono pagine di prodotto indicizzabili;
  // leaderboard/match-builder/invite restano fuori (contenuto dietro login).
  { path: "/predictions", changeFrequency: "daily", priority: 0.9 },
  { path: "/plans", changeFrequency: "weekly", priority: 0.8 },
  { path: "/history", changeFrequency: "daily", priority: 0.7 },
  // #SEO-PACK-0810: pillar UK (brief 06) — contenuto statico, weekly.
  { path: "/ai-tennis-predictions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/ai-football-predictions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/weekly-pick", changeFrequency: "daily", priority: 0.8 },
  { path: "/community", changeFrequency: "daily", priority: 0.6 },
  { path: "/partners", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
  // #TOOLS-HUB-0805: il Mondiale 2026 è finito. La pagina resta online come
  // archivio ma esce dalla nav e scende di priorità — dichiararla ancora
  // "daily / 0.8" manderebbe i crawler a ricontrollare ogni giorno una pagina
  // che non cambia più.
  { path: "/world-cup", changeFrequency: "monthly", priority: 0.3 },
];

// #TOOLS-HUB-0805: 11 hub + 55 pagine-tool. L'inglese è la variante canonical e
// prende la priorità più alta, le tradotte la seguono. Contenuto statico
// (nessun dato di mercato dentro), quindi weekly e non daily.
const TOOLS_ROUTES: Entry[] = TOOL_LOCALES.flatMap((locale) => {
  const canonical = locale === "en";
  return [
    { path: hubPath(locale), changeFrequency: "weekly" as const, priority: canonical ? 0.8 : 0.6 },
    ...TOOL_SLUGS.map((slug) => ({
      path: toolPath(slug, locale),
      changeFrequency: "weekly" as const,
      priority: canonical ? 0.7 : 0.5,
    })),
  ];
});

export default function sitemap(): MetadataRoute.Sitemap {
  return [...PUBLIC_ROUTES, ...TOOLS_ROUTES].map((r) => ({
    url: r.path === "/" ? BASE : `${BASE}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
