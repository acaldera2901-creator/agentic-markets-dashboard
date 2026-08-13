// soro-rss.ts — poller PULL del feed RSS Soro (#SORO-RSS-0813).
//
// Soro non ha webhook nel prodotto (rettifica #SORO-BLOG-0812): la via
// server-side è il pull di https://app.trysoro.com/api/rss/<uuid>. Trappole
// misurate sul feed reale e gestite qui:
//   (a) l'edge Cloudflare serve copie stantie e ignora Cache-Control -> ogni
//       fetch aggiunge un query param cache-buster `_cb=<ts>`;
//   (b) <link> punta al dominio configurato nell'account Soro; lo slug viene
//       derivato dall'ultimo segmento del path (con o senza prefisso /blog/),
//       fallback slugify(title);
//   (c) le immagini stanno sullo storage Supabase DI SORO e diventano 404 a
//       fine abbonamento -> vengono scaricate e ri-ospitate nel bucket
//       `blog-images` all'ingestione (featured + inline nel corpo);
//   (d) l'auto-publish di Soro col pull è innocuo: entrare nel feed non
//       pubblica nulla da noi — ogni riga nasce status='draft' e il gate di
//       pubblicazione resta umano.
// Idempotenza: guid del feed, INSERT ... ON CONFLICT (guid) DO NOTHING.
// Mai UPDATE: una bozza corretta a mano non viene sovrascritta.
import { dbExecute, dbQueryStrict, getSupabaseAdminClient } from "@/lib/db";
import { opsAlert } from "@/lib/ops-alert";

const BUCKET = "blog-images";
const FEED_TIMEOUT_MS = 15_000;
const IMAGE_TIMEOUT_MS = 15_000;
// Un featured webp di Soro pesa ~100KB; 8MB è già un'anomalia da scartare.
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type SoroFeedItem = {
  guid: string;
  title: string;
  link: string;
  description: string;
  contentHtml: string;
  pubDate: string;
  imageUrl: string | null;
};

export type SoroSyncResult = {
  scanned: number;
  inserted: number;
  skipped: number;
  imagesRehosted: number;
  imageErrors: number;
  errors: string[];
};

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Estrae il testo di un tag: prima la forma CDATA, poi quella semplice.
function tagText(block: string, tag: string): string {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`)
  );
  if (cdata) return cdata[1];
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return plain ? decodeEntities(plain[1].trim()) : "";
}

export function parseSoroFeed(xml: string): SoroFeedItem[] {
  const items: SoroFeedItem[] = [];
  for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const enclosure = block.match(/<enclosure[^>]*\burl="([^"]+)"/);
    const media = block.match(/<media:content[^>]*\burl="([^"]+)"/);
    items.push({
      guid: tagText(block, "guid"),
      title: tagText(block, "title"),
      link: tagText(block, "link"),
      description: tagText(block, "description"),
      contentHtml: tagText(block, "content:encoded"),
      pubDate: tagText(block, "pubDate"),
      imageUrl: enclosure?.[1] ?? media?.[1] ?? null,
    });
  }
  return items;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Slug dall'ultimo segmento del path del <link> (funziona sia con la forma
// /blog/<slug> del piano sia con la forma piatta /<slug> vista sul feed
// reale); se il link non dà uno slug usabile si ripiega sul titolo.
export function slugFromItem(item: Pick<SoroFeedItem, "link" | "title">): string {
  try {
    const segments = new URL(item.link).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    const candidate = slugify(last);
    if (candidate && candidate !== "blog") return candidate;
  } catch {
    // link assente o malformato: si passa al titolo
  }
  return slugify(item.title);
}

// Va ri-ospitata ogni immagine che non sta già su un dominio nostro: quelle
// di Soro (storage Supabase loro / trysoro) muoiono a fine abbonamento.
export function needsRehost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  if (host === "www.betredge.com" || host === "betredge.com") return false;
  const own = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (own) {
    try {
      if (host === new URL(own).hostname) return false;
    } catch {
      // env malformata: si tratta come dominio esterno
    }
  }
  return true;
}

// Scarica un'immagine esterna e la carica nel bucket pubblico; ritorna la
// public URL nostra, o null se qualcosa va storto (il chiamante tiene la URL
// originale e conta l'errore — meglio una bozza con immagine Soro che nessuna
// bozza).
async function rehostImage(sourceUrl: string, destPath: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new Error(`not an image: ${contentType}`);
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > IMAGE_MAX_BYTES) {
      throw new Error(`bad size: ${buffer.byteLength} bytes`);
    }
    // upsert:true = il retry dopo un giro parzialmente fallito è idempotente
    // (l'item non è ancora in tabella, quindi al giro dopo si ripassa di qui).
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(destPath, buffer, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath);
    return data.publicUrl;
  } catch (e) {
    console.error(`[soro-rss] image rehost failed ${sourceUrl}:`, String(e));
    return null;
  }
}

function extensionOf(url: string): string {
  const m = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "img";
}

export async function runSoroRssSync(): Promise<SoroSyncResult> {
  const result: SoroSyncResult = {
    scanned: 0,
    inserted: 0,
    skipped: 0,
    imagesRehosted: 0,
    imageErrors: 0,
    errors: [],
  };

  const feedUrl = process.env.SORO_RSS_URL;
  if (!feedUrl) {
    throw new Error("SORO_RSS_URL not configured");
  }

  // (a) cache-buster contro l'edge Cloudflare di Soro.
  const sep = feedUrl.includes("?") ? "&" : "?";
  const res = await fetch(`${feedUrl}${sep}_cb=${Date.now()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) {
    const msg = `feed fetch failed: HTTP ${res.status}`;
    await opsAlert("cron/soro-rss", [msg]);
    throw new Error(msg);
  }

  const items = parseSoroFeed(await res.text());
  result.scanned = items.length;

  for (const item of items) {
    try {
      if (!item.guid || !item.title || !item.contentHtml) {
        result.errors.push(`malformed item skipped (guid=${item.guid || "?"})`);
        continue;
      }

      // Già catturato? Si esce prima di toccare le immagini: mai ri-scaricare
      // né ri-scrivere (una bozza corretta a mano resta com'è).
      const existing = await dbQueryStrict<{ guid: string }>(
        "SELECT guid FROM blog_posts WHERE guid = $1",
        [item.guid]
      );
      if (existing.length > 0) {
        result.skipped++;
        continue;
      }

      let slug = slugFromItem(item);
      if (!slug) {
        result.errors.push(`no usable slug (guid=${item.guid})`);
        continue;
      }
      const slugTaken = await dbQueryStrict<{ slug: string }>(
        "SELECT slug FROM blog_posts WHERE slug = $1",
        [slug]
      );
      if (slugTaken.length > 0) slug = `${slug}-${item.guid.slice(0, 8)}`;

      // (c) featured image sul nostro storage.
      let featuredUrl: string | null = null;
      if (item.imageUrl && needsRehost(item.imageUrl)) {
        featuredUrl = await rehostImage(
          item.imageUrl,
          `${item.guid}/featured.${extensionOf(item.imageUrl)}`
        );
        if (featuredUrl) result.imagesRehosted++;
        else result.imageErrors++;
      } else if (item.imageUrl) {
        featuredUrl = item.imageUrl;
      }

      // (c) anche le immagini inline nel corpo (oggi il feed non ne ha, ma il
      // giorno che compaiono punterebbero allo storage Soro).
      let contentHtml = item.contentHtml;
      const inlineSrcs = [...contentHtml.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)]
        .map((m) => m[1])
        .filter(needsRehost);
      let inlineIdx = 0;
      for (const src of [...new Set(inlineSrcs)]) {
        inlineIdx++;
        const hosted = await rehostImage(
          src,
          `${item.guid}/inline-${inlineIdx}.${extensionOf(src)}`
        );
        if (hosted) {
          contentHtml = contentHtml.split(src).join(hosted);
          result.imagesRehosted++;
        } else {
          result.imageErrors++;
        }
      }

      const pubDateMs = Date.parse(item.pubDate);
      await dbExecute(
        `INSERT INTO blog_posts
           (guid, slug, title, source_link, description, content_html,
            featured_image_url, source_featured_image_url, pub_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
         ON CONFLICT (guid) DO NOTHING`,
        [
          item.guid,
          slug,
          item.title,
          item.link || null,
          item.description || null,
          contentHtml,
          featuredUrl,
          item.imageUrl,
          Number.isNaN(pubDateMs) ? null : new Date(pubDateMs).toISOString(),
        ]
      );
      result.inserted++;
      console.log(`[soro-rss] captured draft guid=${item.guid} slug=${slug}`);
    } catch (e) {
      result.errors.push(`item guid=${item.guid || "?"}: ${String(e)}`);
    }
  }

  if (result.errors.length > 0 || result.imageErrors > 0) {
    await opsAlert("cron/soro-rss", [
      ...result.errors,
      ...(result.imageErrors > 0 ? [`${result.imageErrors} image(s) NOT rehosted (original Soro URL kept)`] : []),
    ]);
  }
  return result;
}
