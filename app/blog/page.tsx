// /blog — indice pubblico dei post published (#BLOG-SSR-0814, D3 di
// #LAUNCHDEC-0814: serving SSR, il widget embed resta fuori).
// Rende SOLO status='published' (lib/blog.ts); i draft catturati dal poller
// Soro non esistono per questa pagina. ISR 10 min: un publish dal pannello
// admin diventa visibile senza deploy al giro di revalidate.
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { listPublishedPosts, formatPostDate } from "@/lib/blog";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Betting Guides and Insights | BetRedge",
  description:
    "Guides on betting probability, odds, and how AI prediction models work. Educational content from BetRedge: numbers explained, no tips, no guarantees.",
  alternates: { canonical: "/blog" },
};

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();

  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      <JsonLd data={breadcrumbJsonLd([["Blog", "/blog"]])} />
      <main className="mx-auto max-w-3xl px-6 py-12" style={{ lineHeight: 1.7 }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--am-coral, #f97316)" }}>Blog</p>
        <h1 className="text-3xl font-bold mt-2 mb-6" style={{ color: "var(--am-text)" }}>
          Betting guides and insights
        </h1>
        <p className="mb-10">
          How odds work, what a calibrated probability means, and how to read an AI model without
          fooling yourself. Educational content: no tips, no guarantees.
        </p>

        {posts.length === 0 && (
          <p className="mb-4">No articles published yet. Check back soon.</p>
        )}

        {posts.map((post) => (
          <article key={post.slug} className="mb-10">
            {post.featured_image_url && (
              <Link href={`/blog/${post.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.featured_image_url}
                  alt={post.title}
                  loading="lazy"
                  className="mb-3 rounded"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              </Link>
            )}
            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--am-text)" }}>
              <Link href={`/blog/${post.slug}`} className="underline">
                {post.title}
              </Link>
            </h2>
            {(post.pub_date || post.published_at) && (
              <p className="text-xs mb-2 uppercase tracking-widest">
                {formatPostDate(post.pub_date ?? post.published_at)}
              </p>
            )}
            {post.description && <p>{post.description}</p>}
          </article>
        ))}

        <p className="mt-10 mb-2 text-sm">
          18+. Gamble responsibly. Probabilities are estimates, not guarantees, and no outcome is
          ever certain. If gambling stops being fun, help is available at{" "}
          <a href="https://www.begambleaware.org" rel="nofollow noopener" style={{ textDecoration: "underline" }}>BeGambleAware</a>.
        </p>
      </main>
    </div>
  );
}
