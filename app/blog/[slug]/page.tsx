// /blog/[slug] — articolo SSR (#BLOG-SSR-0814, D3 di #LAUNCHDEC-0814).
// Serve SOLO status='published': un draft o uno slug inesistente sono lo
// stesso 404 (nessuna esistenza rivelata). Canonical + schema Article +
// breadcrumb come da piano SEO UK (#SEO-PACK-0810). Il corpo HTML passa da
// sanitizeBlogHtml prima del render: il feed Soro è un fornitore esterno e
// la revisione umana pre-publish legge il testo, non il sorgente.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { getPublishedPost, listPublishedPosts, sanitizeBlogHtml, metaTitleOf, formatPostDate } from "@/lib/blog";

export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const posts = await listPublishedPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
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

export default async function BlogPostPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const dateIso = post.pub_date ?? post.published_at;

  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
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
      <JsonLd data={breadcrumbJsonLd([["Blog", "/blog"], [post.title, `/blog/${slug}`]])} />
      <main className="mx-auto max-w-3xl px-6 py-12" style={{ lineHeight: 1.7 }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--am-coral, #f97316)" }}>
          <Link href="/blog" className="underline">Blog</Link>
        </p>
        <h1 className="text-3xl font-bold mt-2 mb-2" style={{ color: "var(--am-text)" }}>
          {post.title}
        </h1>
        {dateIso && (
          <p className="text-xs mb-6 uppercase tracking-widest">{formatPostDate(dateIso)}</p>
        )}
        {post.featured_image_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.featured_image_url}
            alt={post.title}
            className="mb-8 rounded"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        )}

        {/* Stili minimi per l'HTML del feed (h2/h3/p/ul/a): il markup arriva
            da fuori e non porta classi Tailwind, senza queste regole
            renderizza tutto attaccato. Scoped sotto .blog-content. */}
        <style>{`
          .blog-content h2 { color: var(--am-text); font-size: 1.25rem; font-weight: 700; margin: 2.5rem 0 1rem; }
          .blog-content h3 { color: var(--am-text); font-size: 1.05rem; font-weight: 700; margin: 1.75rem 0 0.75rem; }
          .blog-content p { margin-bottom: 1rem; }
          .blog-content ul, .blog-content ol { margin: 0 0 1rem 1.25rem; }
          .blog-content ul { list-style: disc; }
          .blog-content ol { list-style: decimal; }
          .blog-content li { margin-bottom: 0.35rem; }
          .blog-content a { color: var(--am-text); text-decoration: underline; }
          .blog-content img { max-width: 100%; height: auto; border-radius: 0.25rem; }
          .blog-content blockquote { border-left: 3px solid var(--am-coral, #f97316); padding-left: 1rem; margin-bottom: 1rem; }
          .blog-content table { width: 100%; margin-bottom: 1rem; border-collapse: collapse; }
          .blog-content th, .blog-content td { border: 1px solid var(--am-muted); padding: 0.4rem 0.6rem; text-align: left; }
        `}</style>
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(post.content_html) }}
        />

        <p className="mt-10 mb-2 text-sm">
          18+. Gamble responsibly. Probabilities are estimates, not guarantees, and no outcome is
          ever certain. If gambling stops being fun, help is available at{" "}
          <a href="https://www.begambleaware.org" rel="nofollow noopener" style={{ textDecoration: "underline" }}>BeGambleAware</a>.
        </p>
        <p className="mt-6">
          <Link href="/blog" className="underline" style={{ color: "var(--am-text)" }}>
            All articles
          </Link>
        </p>
      </main>
    </div>
  );
}
