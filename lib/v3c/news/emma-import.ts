// lib/v3c/news/emma-import.ts — Emma → blog channel (T11 block 2): pure rules of the importer that puts ONE approved Emma card
// (drafts/social/ig-pronti/<date>/<slot>/) into the news feed (/blog#news). No I/O here: the CLI (scripts/news_watcher/emma-blog-import.ts)
// reads the manifest, converts the image and talks to Supabase. Everything that can refuse, refuses HERE and is tested.
import { createHash } from "node:crypto";
import type { NoteText } from "./rewrite";

export type BlogCredit = { person: string; author: string; license: string; licenseUrl?: string | null; url: string };
export type BlogBlock = { pubblica?: boolean; en?: Partial<NoteText>; it?: Partial<NoteText>; teams?: unknown; fonte_url?: string; credito?: Partial<BlogCredit>; published_at?: string };
export type EmmaManifest = {
  id?: string; account?: string; slot?: string; tipo?: string; image?: string; fonte?: string;
  checks?: Record<string, unknown>; qa_orchestratore?: unknown; qa_data?: string; qa_nota?: string; blog?: BlogBlock;
};

/** Same list as the IG executor (scripts/ig-publish.mjs): none of this reaches the blog either. */
const FORBIDDEN: [RegExp, string][] = [
  [/\broi\b/i, "ROI"], [/\b(win|hit)[\s-]?rate\b/i, "win/hit-rate"], [/\bclv\b/i, "CLV"], [/guarantee[ds]?\b/i, "guaranteed"],
  [/\block(s|ed)?\b/i, "lock"], [/\bsure[\s-]?(win|bet|thing)\b/i, "sure win"], [/migliori\s+quote/i, "migliori quote"], [/\bbest\s+odds\b/i, "best odds"],
  [/battiamo\s+il\s+mercato/i, "battiamo il mercato"], [/beat(ing)?\s+the\s+(market|bookies)/i, "beat the market"], [/\bvpn\b/i, "VPN"],
];

export const guidFor = (manifestId: string): string => createHash("sha256").update(`emma-blog|${manifestId}`).digest("hex");
export const baseFor = (guid: string): string => `news-${guid.slice(0, 12)}`; // the DB constraint wants news-<12hex>(-e).webp
export const normTitle = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const httpUrl = (u: unknown): u is string => { try { const p = new URL(String(u)).protocol; return p === "https:" || p === "http:"; } catch { return false; } };
const filled = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;

/** Everything that must be true before a card goes to the blog. [] = ok. */
export function validate(m: EmmaManifest | null | undefined): string[] {
  const e: string[] = [];
  if (!m || typeof m !== "object") return ["manifest non valido"];
  if (m.account !== "betr.edge") e.push(`account deve essere betr.edge (trovato: ${String(m.account)})`);
  if (!filled(m.id)) e.push("manca id");
  if (m.tipo !== undefined && m.tipo !== "post") e.push(`tipo «${String(m.tipo)}»: nel blog solo post con immagine (i reel no)`);
  // QA orchestratore: stato ok + data + nota (same rule as the IG executor)
  const q = m.qa_orchestratore as { stato?: string; data?: string; nota?: string } | string | undefined;
  const qs = typeof q === "string" ? q : q?.stato;
  const qd = typeof q === "object" && q ? q.data : m.qa_data;
  const qn = typeof q === "object" && q ? q.nota : m.qa_nota;
  if (qs !== "ok") e.push("qa_orchestratore ≠ ok");
  else if (!filled(qd) || !filled(qn)) e.push("qa_orchestratore ok ma senza data e nota");
  for (const k of ["logo", "persone_reali", "loghi_autentici", "no_18_in_immagine"]) if (m.checks?.[k] !== true) e.push(`checks.${k} deve essere true`);
  const b = m.blog;
  if (!b || b.pubblica !== true) return [...e, "blog.pubblica deve essere true (Emma sceglie esplicitamente cosa va nel blog)"];
  for (const lang of ["en", "it"] as const) {
    const n = b[lang];
    if (!filled(n?.title) || !filled(n?.body)) e.push(`blog.${lang}: servono title e body`);
    else {
      if (n!.title!.length > 140) e.push(`blog.${lang}.title troppo lungo (${n!.title!.length} > 140)`);
      for (const [re, name] of FORBIDDEN) if (re.test(`${n!.title} ${n!.body}`)) e.push(`claim vietato in blog.${lang}: ${name}`);
    }
  }
  if (!Array.isArray(b.teams) || b.teams.some((t) => !filled(t))) e.push("blog.teams deve essere un elenco (anche vuoto) di nomi");
  if (!httpUrl(b.fonte_url)) e.push("blog.fonte_url deve essere un URL http(s)");
  const c = b.credito;
  for (const k of ["person", "author", "license", "url"] as const) if (!filled(c?.[k])) e.push(`blog.credito.${k} mancante: senza credito completo non si pubblica`);
  if (c?.url && !httpUrl(c.url)) e.push("blog.credito.url non è un URL");
  if (b.published_at !== undefined && !Number.isFinite(Date.parse(b.published_at))) e.push("blog.published_at non è una data");
  return e;
}

export type ExistingRow = { guid_hash: string; source_url?: string | null; rewritten_en?: { title?: string } | null };
/** Never twice, never next to the watcher's own version of the same story. null = free to publish. */
export function duplicateOf(rows: readonly ExistingRow[], guid: string, fonteUrl: string, title: string): string | null {
  const nt = normTitle(title);
  for (const r of rows) {
    if (r.guid_hash === guid) return `già importata (guid ${guid.slice(0, 12)})`;
    if (r.source_url && r.source_url === fonteUrl && !/betredge\.com\/blog/.test(fonteUrl)) return `stessa fonte già nel feed (${r.guid_hash.slice(0, 12)})`;
    if (r.rewritten_en?.title && normTitle(r.rewritten_en.title) === nt) return `stesso titolo già nel feed (${r.guid_hash.slice(0, 12)})`;
  }
  return null;
}

/**
 * Exact-guid lookup, NO time window (calde's review 06/11): a manifest imported long ago and re-run must stop BEFORE the upload,
 * which would overwrite the existing news' image (same news-<guid12>-e.webp). A failed read throws: no upload without knowing.
 */
export async function guidExists(rest: string, headers: Record<string, string>, guid: string, f: typeof fetch = fetch): Promise<boolean> {
  const r = await f(`${rest}?guid_hash=eq.${encodeURIComponent(guid)}&select=guid_hash`, { headers });
  if (!r.ok) throw new Error(`lettura guid_hash → http ${r.status}`);
  const rows = (await r.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/** The news_items row (image_url is added by the CLI once the file is verified in the bucket). */
export function buildRow(m: EmmaManifest, now: number) {
  const b = m.blog!;
  const guid = guidFor(m.id!);
  const at = b.published_at ? Math.min(Date.parse(b.published_at), now) : now; // never in the future
  return {
    guid_hash: guid,
    source: "BetRedge",
    source_url: b.fonte_url!,
    published_at: new Date(at).toISOString(),
    rewritten_en: { title: b.en!.title!.trim(), body: b.en!.body!.trim() },
    rewritten_it: { title: b.it!.title!.trim(), body: b.it!.body!.trim() },
    teams: (b.teams as string[]).map((t) => t.trim()),
    rewrite_model: "emma · manual",
    rewritten_at: new Date(now).toISOString(),
  };
}
