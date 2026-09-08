// /blog — indice pubblico dei post published (#BLOG-SSR-0814, D3 di
// #LAUNCHDEC-0814: serving SSR, il widget embed resta fuori).
// Rende SOLO status='published' (lib/blog.ts); i draft catturati dal poller
// Soro non esistono per questa pagina. ISR 10 min: un publish dal pannello
// admin diventa visibile senza deploy al giro di revalidate.
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { listPublishedPosts, formatPostDate } from "@/lib/blog";
// #SEO-ORPHANS-0908: l'indice non usciva verso i tool né verso i due pillar,
// e non aveva footer. Le guide spiegano i conti che i calcolatori fanno.
import { SiteFooter } from "@/components/SiteFooter";

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
    <div className="min-h-screen font-mono mc-scene-court" data-mc-ground style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      {/* #UI-MACHINA-0802 fase 3 — la scena del fondo cinematico, come sul desk. */}
      <span className="bgfix" aria-hidden="true" />
      <JsonLd data={breadcrumbJsonLd([["Blog", "/blog"]])} />
      <main className="mx-auto max-w-3xl px-6 py-12" style={{ lineHeight: 1.7 }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--am-coral, #f97316)" }}>Blog</p>
        <h1 className="text-3xl font-bold mt-2 mb-6" style={{ color: "var(--am-text)" }}>
          Betting guides and insights
        </h1>
        <p className="mb-4">
          How odds work, what a calibrated probability means, and how to read an AI model without
          fooling yourself. Educational content: no tips, no guarantees.
        </p>
        {/* #SEO-ORPHANS-0908 — le due uscite naturali dell'indice: i calcolatori
            che fanno gli stessi conti, e le pagine che spiegano come il modello
            arriva al numero. Una riga di prosa, non una griglia di card: qui
            l'attenzione deve restare sull'elenco degli articoli. */}
        <p className="mb-10 text-sm">
          The arithmetic in these articles is done for you by the free{" "}
          <Link href="/tools" className="underline" style={{ color: "var(--am-text)" }}>calculators</Link>{" "}
          — no account needed. How the model itself reaches a number:{" "}
          <Link href="/ai-football-predictions" className="underline" style={{ color: "var(--am-text)" }}>AI football predictions</Link>{" "}
          and{" "}
          <Link href="/ai-tennis-predictions" className="underline" style={{ color: "var(--am-text)" }}>AI tennis predictions</Link>.
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
      <SiteFooter lang="en" />
    </div>
  );
}
