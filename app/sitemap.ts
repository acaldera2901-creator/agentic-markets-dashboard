import type { MetadataRoute } from "next";
import { TOOL_LOCALES, TOOL_SLUGS, hubPath, toolPath } from "@/lib/tools/registry";
import { listPublishedPosts } from "@/lib/blog";
import { GENERATED_AT, LAST_MODIFIED } from "@/lib/seo/last-modified.generated";

// #BLOG-SSR-0814: la sitemap ora legge i post published dal DB → ISR oraria,
// altrimenti resterebbe congelata al build e un publish senza deploy non
// entrerebbe mai (i post si pubblicano dal pannello admin, non con un deploy).
export const revalidate = 3600;

// #SEO-SCAFFOLDING-0721 — sitemap delle sole rotte pubbliche renderizzabili da
// anonimo (niente rotte dietro flag NEXT_PUBLIC_UX_NEW né aree auth/admin).
//
// #SEO-LASTMOD-0915 — lastModified su TUTTE le URL, non più solo sui 5 articoli.
// La nota di prima diceva "niente lastModified, un timestamp di build
// mentirebbe", e su un timestamp di build aveva ragione: con `revalidate = 3600`
// sarebbe diventato "adesso" su 150 URL ogni ora, cioè il caso che Google impara
// a ignorare. La data NON è quella del build: è quella dell'ultimo commit che ha
// toccato i file che producono ciascuna pagina, congelata al momento della
// generazione in lib/seo/last-modified.generated.ts (npm run seo:lastmod).
// Per le board (/, /predictions, /history) resta una SOTTOSTIMA deliberata —
// è la data del template, non dei dati, che cambiano a ogni ciclo agenti:
// changeFrequency=daily continua a dire ai crawler di tornare ogni giorno.
// Sottostimare è sicuro, sovrastimare no.
//
// #SEO-LASTMOD-0915 — via `priority`: Google lo ignora dichiaratamente da anni.
// Era peso morto che chiedeva una decisione a ogni rotta nuova.
const BASE = "https://www.betredge.com";

type Entry = { path: string; changeFrequency: "daily" | "weekly" | "monthly" };

const PUBLIC_ROUTES: Entry[] = [
  { path: "/", changeFrequency: "daily" },
  // #URL-PATHS-0810: /app è diventato un redirect permanente → in sitemap vanno
  // i path veri del desk. Plans/history sono pagine di prodotto indicizzabili;
  // leaderboard/match-builder/invite restano fuori (contenuto dietro login).
  { path: "/predictions", changeFrequency: "daily" },
  { path: "/plans", changeFrequency: "weekly" },
  { path: "/history", changeFrequency: "daily" },
  // #SEO-PACK-0810: pillar UK (brief 06) — contenuto statico, weekly.
  { path: "/ai-tennis-predictions", changeFrequency: "weekly" },
  { path: "/ai-football-predictions", changeFrequency: "weekly" },
  { path: "/weekly-pick", changeFrequency: "daily" },
  // #BLOG-SSR-0814: indice del blog (i singoli articoli entrano dinamicamente
  // dal DB in fondo alla sitemap).
  { path: "/blog", changeFrequency: "weekly" },
  { path: "/community", changeFrequency: "daily" },
  { path: "/partners", changeFrequency: "monthly" },
  { path: "/terms", changeFrequency: "monthly" },
  { path: "/privacy", changeFrequency: "monthly" },
  // #TOOLS-HUB-0805: il Mondiale 2026 è finito. La pagina resta online come
  // archivio ma esce dalla nav — dichiararla ancora "daily" manderebbe i
  // crawler a ricontrollare ogni giorno una pagina che non cambia più.
  { path: "/world-cup", changeFrequency: "monthly" },
];

// #TOOLS-HUB-0805: 11 hub + 121 pagine-tool. Contenuto statico (nessun dato di
// mercato dentro), quindi weekly e non daily. Il rango relativo fra inglese
// canonical e tradotte lo portano gli hreflang e i canonical delle pagine, non
// la sitemap (#SEO-LASTMOD-0915: `priority` è uscito, Google lo ignora).
const TOOLS_ROUTES: Entry[] = TOOL_LOCALES.flatMap((locale) => [
  { path: hubPath(locale), changeFrequency: "weekly" as const },
  ...TOOL_SLUGS.map((slug) => ({
    path: toolPath(slug, locale),
    changeFrequency: "weekly" as const,
  })),
]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Solo published (lib/blog.ts). listPublishedPosts è fail-soft: con DB non
  // raggiungibile la sitemap serve comunque le rotte statiche, mai un 500.
  const posts = await listPublishedPosts();

  const postDate = (p: (typeof posts)[number]) => p.published_at ?? p.pub_date ?? null;

  // L'indice /blog è la lista degli articoli: quando ne esce uno nuovo, l'indice
  // È cambiato, e il publish avviene dal pannello admin senza deploy — la data
  // del commit di app/blog/page.tsx non lo vedrebbe mai. L'articolo più recente
  // è quindi la data più onesta che abbiamo, e vince se batte quella del file.
  const newestPost = posts
    .map(postDate)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  const staticEntries: MetadataRoute.Sitemap = [...PUBLIC_ROUTES, ...TOOLS_ROUTES].map((r) => {
    // GENERATED_AT è il fallback per una rotta che la mappa non conosce (rotta
    // nuova, generato non rigenerato): mai un `undefined` silenzioso.
    let lastModified = LAST_MODIFIED[r.path] ?? GENERATED_AT;
    if (r.path === "/blog" && newestPost && newestPost > lastModified) {
      lastModified = newestPost;
    }
    return {
      url: r.path === "/" ? BASE : `${BASE}${r.path}`,
      lastModified,
      changeFrequency: r.changeFrequency,
    };
  });

  const blogEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    // Gli articoli non cambiano dopo il publish: la data del publish è la data
    // di modifica. Un post senza date resta senza lastModified — mai inventata.
    ...(postDate(p) ? { lastModified: postDate(p)! } : {}),
    changeFrequency: "monthly" as const,
  }));

  return [...staticEntries, ...blogEntries];
}
