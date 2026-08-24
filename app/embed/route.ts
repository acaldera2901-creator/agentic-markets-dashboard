// #WIDGET-EMBED-0824 — la pagina dentro l'iframe del partner.
//
// È l'UNICO path del sito incorporabile da terzi: la deroga a
// X-Frame-Options/frame-ancestors vive in next.config.ts ed è confinata qui,
// dove non c'è sessione né azione da rubare con un clickjack.
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  fetchEmbedRows, normalizeEmbedRef, resolveEmbedMode, clampEmbedLimit, isRefBlocked,
  type EmbedLang, type EmbedRow,
} from "@/lib/embed-feed";
import { renderEmbedHtml, EMBED_INLINE_SCRIPT, type EmbedTheme } from "./embed-html";
import { chromeLang, isToolLocale } from "@/lib/tools/registry";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Hash dello script inline: la pagina del widget non concede 'unsafe-inline'
 *  agli script, così un'eventuale injection nei dati non diventa esecuzione. */
const SCRIPT_HASH = `sha256-${createHash("sha256").update(EMBED_INLINE_SCRIPT).digest("base64")}`;

const CSP = [
  "default-src 'none'",
  "img-src 'self' data:",
  "style-src 'unsafe-inline'",
  `script-src '${SCRIPT_HASH}'`,
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  // La ragione d'essere del widget: essere incorniciato da chiunque.
  "frame-ancestors *",
].join("; ");

const cleanHost = (raw: string | null): string | null => {
  const h = (raw ?? "").trim().toLowerCase().slice(0, 80);
  return /^[a-z0-9.-]{3,80}$/.test(h) ? h : null;
};

const cleanSport = (raw: string | null): string | null => {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s === "all") return null;
  return /^[a-z_]{2,20}$/.test(s) ? s : null;
};

const cleanTheme = (raw: string | null): EmbedTheme =>
  raw === "light" || raw === "dark" ? raw : "auto";

const cleanLang = (raw: string | null): EmbedLang => {
  const l = (raw ?? "").trim().toLowerCase();
  return isToolLocale(l) ? chromeLang(l) : "en";
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawRef = normalizeEmbedRef(searchParams.get("ref"));
  // #WIDGET-TRUTH-0824 — spegnimento per codice: la guida partner promette che
  // possiamo disattivare il widget su un singolo ref, quindi deve esistere qui.
  // Spegne PRIMA di tutto: niente predizioni, niente attribuzione, nemmeno la
  // versione teaser. Il widget resta un guscio che dice di non essere attivo.
  const blocked = isRefBlocked(rawRef, process.env.EMBED_BLOCKED_REFS);
  const ref = blocked ? null : rawRef;
  const mode = resolveEmbedMode(ref, process.env.EMBED_FULL_REFS);
  const lang = cleanLang(searchParams.get("lang"));
  const host = cleanHost(searchParams.get("host"));

  // Fail-soft ovunque: dentro il sito di un partner un errore nostro deve
  // degradare a widget vuoto, mai a una pagina di errore. Stessa ragione per
  // cui il rate limit non risponde 429: protegge il DB servendo il guscio.
  let rows: EmbedRow[] = [];
  if (!blocked && !rateLimit(`embed:${clientIp(req)}`, 120, 60_000)) {
    try {
      rows = await fetchEmbedRows({
        sport: cleanSport(searchParams.get("sport")),
        limit: clampEmbedLimit(searchParams.get("limit")),
        mode,
        lang,
      });
    } catch (err) {
      console.error("[embed] read failed:", err);
    }
  }

  const html = renderEmbedHtml({ rows, ref, lang, theme: cleanTheme(searchParams.get("theme")), host, mode, disabled: blocked });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
      // Nessun cookie letto: la risposta è identica per tutti a parità di URL,
      // quindi è share-cacheable senza il rischio di /api/v2/predictions.
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}
