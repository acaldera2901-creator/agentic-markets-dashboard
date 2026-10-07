// /v3c/blog/[slug] — l'articolo nella cornice v3c. Stesso HTML sanitizzato, stessi
// JSON-LD (Article + breadcrumb), stesso canonical.
// (#REDESIGN-V3C pages) NON è un URL pubblico: con NEXT_PUBLIC_REDESIGN acceso
// next.config.ts riscrive la URL di oggi qui (beforeFiles, lib/v3c/pages-routes.ts;
// l'URL nel browser non cambia); spento risponde 404 e la pagina di oggi resta
// intatta. Metadata identici a quelli di oggi (app/v3c/v3c-pages-routes.test.tsx).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  JsonLd,
  articleJsonLd,
  breadcrumbJsonLd,
} from "@/components/seo/json-ld";
import {
  getPublishedPost,
  listPublishedPosts,
  sanitizeBlogHtml,
  metaTitleOf,
} from "@/lib/blog";
import { readingMinutes } from "@/lib/v3c/news";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cArticle } from "@/components/v3c/pages/News";
import { newsEnabled } from "@/lib/v3c/news/news.server";

export const revalidate = 600;
export const dynamicParams = true;

// generateMetadata: copia di app/blog/[slug]/page.tsx (il test lo confronta)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return {};
  return {
    title: `${metaTitleOf(post.title)} | BetRedge`,
    description: post.description ?? undefined,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: metaTitleOf(post.title),
      description: post.description ?? undefined,
      ...(post.featured_image_url ? { images: [post.featured_image_url] } : {}),
      ...(post.pub_date || post.published_at
        ? { publishedTime: (post.pub_date ?? post.published_at)! }
        : {}),
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!v3cProductOn()) notFound();
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();
  const dateIso = post.pub_date ?? post.published_at;
  const html = sanitizeBlogHtml(post.content_html);
  const all = await listPublishedPosts(4);
  const more = all
    .filter((p) => p.slug !== slug)
    .slice(0, 3)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      date: p.pub_date ?? p.published_at,
    }));
  return (
    <>
      <JsonLd
        data={articleJsonLd({
          title: post.title,
          description: post.description,
          path: `/blog/${slug}`,
          image: post.featured_image_url,
          datePublished: dateIso,
          dateModified: post.published_at ?? dateIso,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          ["Blog", "/blog"],
          [post.title, `/blog/${slug}`],
        ])}
      />
      <V3cFrame current="news">
        <V3cArticle
          slug={slug}
          title={post.title}
          date={dateIso}
          minutes={readingMinutes(html)}
          image={post.featured_image_url}
          html={html}
          more={more}
          liveNews={newsEnabled()}
        />
      </V3cFrame>
    </>
  );
}
