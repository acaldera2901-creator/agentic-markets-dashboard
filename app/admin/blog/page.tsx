"use client";
// /admin/blog — the human draft->published gate for the Soro blog, as a page.
// State-only: it calls the existing /api/admin/blog (GET list, POST
// {slug, action}) and never touches content_html. Not a CMS.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { splitPosts, actionFor, type AdminBlogPost } from "@/lib/blog-admin";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminBlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<AdminBlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/blog", { cache: "no-store" });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    if (!res.ok) {
      let msg = `Caricamento post fallito (${res.status})`;
      try { const d = await res.json(); msg = d.error ?? msg; } catch {}
      setError(msg);
      return;
    }
    const data = await res.json();
    setPosts(data.posts ?? []);
  }, [router]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- il setState sta dentro la callback async di load(), non nel corpo dell'effect: e' un fetch al mount
  useEffect(() => { void load(); }, [load]);

  const toggle = useCallback(async (post: AdminBlogPost) => {
    const action = actionFor(post);
    const question = action === "publish"
      ? `Pubblicare "${post.title}"?\n\nSarà online su /blog/${post.slug} entro ~10 minuti.`
      : `Ritirare "${post.title}"?\n\nTorna in bozza e sparisce da /blog.`;
    if (!window.confirm(question)) return;

    setBusySlug(post.slug); setError(null); setNotice(null);
    const res = await fetch("/api/admin/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: post.slug, action }),
    });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    if (!res.ok) {
      let msg = `${action} fallito (${res.status})`;
      try { const d = await res.json(); msg = d.error ?? msg; } catch {}
      setError(msg);
      setBusySlug(null);
      return;
    }
    setNotice(action === "publish" ? `Pubblicato: ${post.slug}` : `Ritirato in bozza: ${post.slug}`);
    setBusySlug(null);
    void load();
  }, [load, router]);

  const { drafts, published } = splitPosts(posts ?? []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-300">← Dashboard</Link>
        <h1 className="text-xl font-bold mt-1">Blog — bozze e pubblicati</h1>
        <p className="text-sm text-gray-500 mt-1">
          Il cron Soro scrive solo bozze. Qui si cambia lo stato, non il contenuto: il publish è
          servito su /blog entro ~10 minuti, in sitemap entro un&apos;ora.
        </p>
      </header>

      <main className="px-6 py-6 max-w-5xl mx-auto space-y-8">
        {error && (
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">⚠️ {error}</p>
        )}
        {notice && (
          <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300">{notice}</p>
        )}
        {posts === null && !error && <p className="text-sm text-gray-500">Caricamento…</p>}

        {posts !== null && (
          <>
            <PostTable
              title="Bozze"
              posts={drafts}
              empty="Nessuna bozza in attesa."
              dateOf={(p) => p.pub_date ?? p.created_at}
              dateLabel="Data feed"
              busySlug={busySlug}
              onToggle={toggle}
            />
            <PostTable
              title="Pubblicati"
              posts={published}
              empty="Nessun post pubblicato."
              dateOf={(p) => p.published_at}
              dateLabel="Pubblicato il"
              busySlug={busySlug}
              onToggle={toggle}
            />
          </>
        )}
      </main>
    </div>
  );
}

function PostTable({
  title, posts, empty, dateOf, dateLabel, busySlug, onToggle,
}: {
  title: string;
  posts: AdminBlogPost[];
  empty: string;
  dateOf: (p: AdminBlogPost) => string | null;
  dateLabel: string;
  busySlug: string | null;
  onToggle: (p: AdminBlogPost) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
        {title} <span className="text-gray-600">({posts.length})</span>
      </h2>
      {posts.length === 0 ? (
        <p className="text-sm text-gray-600">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Titolo / slug</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">{dateLabel}</th>
                <th className="px-4 py-2 font-medium">Stato</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => {
                const isPublished = p.status === "published";
                return (
                  <tr key={p.guid} className="border-t border-gray-800 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-100">{p.title}</div>
                      <div className="font-mono text-xs text-gray-500 mt-0.5">
                        {isPublished ? (
                          <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="hover:text-gray-300 underline">
                            {p.slug}
                          </a>
                        ) : p.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(dateOf(p))}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        isPublished ? "bg-emerald-950 text-emerald-400" : "bg-gray-800 text-gray-400"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onToggle(p)}
                        disabled={busySlug !== null}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                          isPublished
                            ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
                            : "bg-emerald-600 text-white hover:bg-emerald-500"
                        }`}
                      >
                        {busySlug === p.slug ? "…" : isPublished ? "Ritira" : "Pubblica"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
