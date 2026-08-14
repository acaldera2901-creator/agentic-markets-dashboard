// lib/blog.ts — lettura server-side dei post del blog (#BLOG-SSR-0814, fase 2
// di #SORO-RSS-0813; decisione D3 #LAUNCHDEC-0814: serving SSR, non widget).
//
// blog_posts ha RLS attiva con ZERO policy: ogni lettura passa dal service
// role lato server (dbQuery), niente arriva al client se non ciò che queste
// query selezionano. Le superfici pubbliche servono SOLO status='published':
// il gate umano draft->published resta l'unico punto di pubblicazione.
//
// Le letture pubbliche usano dbQuery (fail-soft): un hiccup del DB rende una
// lista vuota / un 404, mai un 500 su una pagina indicizzata dai crawler.
import { dbQuery } from "@/lib/db";

export type BlogPostSummary = {
  slug: string;
  title: string;
  description: string | null;
  featured_image_url: string | null;
  pub_date: string | null;
  published_at: string | null;
};

export type BlogPost = BlogPostSummary & {
  content_html: string;
};

// Indice pubblico e sitemap: solo published, dalla più recente. La data che
// conta per l'ordinamento è quella editoriale (pub_date dal feed), con la
// data di pubblicazione nostra come fallback. (Le colonne sono scritte per
// esteso in entrambe le query: il SQL-guard vieta ogni ${…} nelle stringhe
// dbQuery, ed è giusto così.)
export async function listPublishedPosts(limit = 200): Promise<BlogPostSummary[]> {
  return dbQuery<BlogPostSummary>(
    `SELECT slug, title, description, featured_image_url, pub_date, published_at
     FROM blog_posts
     WHERE status = 'published'
     ORDER BY COALESCE(pub_date, published_at, created_at) DESC
     LIMIT $1`,
    [limit]
  );
}

export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  const rows = await dbQuery<BlogPost>(
    `SELECT slug, title, description, featured_image_url, pub_date, published_at, content_html
     FROM blog_posts
     WHERE slug = $1 AND status = 'published'
     LIMIT 1`,
    [slug]
  );
  return rows[0] ?? null;
}

// Sanitizzazione difensiva del corpo HTML prima del render SSR.
//
// Il contenuto arriva dal feed Soro (fornitore esterno) e passa comunque da
// una revisione umana prima del publish — ma un reviewer legge il testo
// renderizzato, non il sorgente: uno script o un handler inline sarebbero
// invisibili all'occhio. Questa passata regex-based è defense-in-depth, non
// un sanitizer HTML completo (dichiarato in REQ): rimuove le classi di
// payload eseguibili, non pretende di normalizzare markup arbitrario.
export function sanitizeBlogHtml(html: string): string {
  let out = html;
  // Tag pericolosi CON il loro contenuto (uno <script> senza il body resta
  // codice sorgente visibile in pagina).
  out = out.replace(
    /<(script|style|iframe|object|embed|form|noscript|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  // Residui: aperture/chiusure orfane degli stessi tag + tag void di rete.
  out = out.replace(
    /<\/?(script|style|iframe|object|embed|form|noscript|svg|math|link|meta|base)\b[^>]*>/gi,
    ""
  );
  // Handler inline: onclick="…", onload='…', onerror=senza-quote.
  out = out
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  // URL eseguibili in href/src (javascript:, vbscript:, data: — le immagini
  // legittime sono già state ri-ospitate come https dal poller).
  out = out
    .replace(/\s(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data)\s*:[\s\S]*?\2/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*(?:javascript|vbscript|data)\s*:[^\s>]+/gi, ' $1="#"');
  return out;
}

// I metaTitle del sito sono dash-free per regola (#SEO-PACK-0810): i titoli
// arrivano da Soro e possono contenere em-dash, qui si normalizza SOLO il
// metadato (il titolo visibile in pagina resta quello originale).
export function metaTitleOf(title: string): string {
  return title.replace(/\s*[—–]\s*/g, ": ").trim();
}

// Data leggibile per l'indice e l'articolo (en-GB: il blog è il pezzo del
// piano SEO UK, lingua English UK impostata nell'account Soro).
export function formatPostDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
