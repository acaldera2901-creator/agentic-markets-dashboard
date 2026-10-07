// /v3c/blog — «News» v3c: lista + spazio note partita, stessi post di lib/blog.
// (#REDESIGN-V3C pages) NON è un URL pubblico: con NEXT_PUBLIC_REDESIGN acceso
// next.config.ts riscrive la URL di oggi qui (beforeFiles, lib/v3c/pages-routes.ts;
// l'URL nel browser non cambia); spento risponde 404 e la pagina di oggi resta
// intatta. Metadata identici a quelli di oggi (app/v3c/v3c-pages-routes.test.tsx).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { listPublishedPosts } from "@/lib/blog";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cNewsIndex } from "@/components/v3c/pages/News";
import "@/components/v3c/pages/news.css";
import { newsEnabled, newsPage } from "@/lib/v3c/news/news.server";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Betting Guides and Insights | BetRedge",
  description:
    "Guides on betting probability, odds, and how AI prediction models work. Educational content from BetRedge: numbers explained, no tips, no guarantees.",
  alternates: { canonical: "/blog" },
};

export default async function Page() {
  if (!v3cProductOn()) notFound();
  const posts = await listPublishedPosts();
  // live notes only behind NEWS_FOTMOB_ENABLED (off: no request leaves, page as before).
  // The page stays ISR (revalidate above); the feed has its own 15-min cache.
  const live = newsEnabled() ? await newsPage() : null;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([["Blog", "/blog"]])} />
      <V3cFrame current="news">
        <V3cNewsIndex
          posts={posts.map((p) => ({
            slug: p.slug,
            title: p.title,
            description: p.description,
            date: p.pub_date ?? p.published_at,
          }))}
          live={live}
        />
      </V3cFrame>
    </>
  );
}
