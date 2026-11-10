// lib/v3c/news/feed.ts (#REDESIGN-V3C news) — the FotMob top-news RSS, parsed.
// Pure: no network, no Next. Reads ONLY the fields we are allowed to use
// (title/description as raw material for the rewrite and the team matching,
// never shown; link, guid, date, source name). Images (`media:thumbnail`,
// `<image>`) are never read. Debt accepted by Andrea on 2026-10-05, guardrails
// in ~/Desktop/01-BETREDGE/redesign/PIANO-COSTRUZIONE.md «News da FotMob».

/** The one public feed we read. Never /api, never HTML pages. */
export const FOTMOB_FEED_URL = "https://www.fotmob.com/topnews/feed?format=rss";
/** Identifiable user-agent with a contact, sent on every request. */
export const NEWS_USER_AGENT = "BetRedgeNews/1.0 (+https://www.betredge.com/about; info@betredge.com)";
/** The robots.txt token we answer to (the product token of the UA). */
export const NEWS_UA_TOKEN = "BetRedgeNews";

export type FeedItem = {
  /** stable id from the feed (`urn:fotmob:feed:topnews:29859`), the cache key */
  guid: string;
  /** original headline: input for the rewrite and the matching, NEVER shown when rewritten */
  title: string;
  /** original teaser, tags stripped: input only, never shown */
  text: string;
  /** link to the original article (tracking query removed) */
  url: string;
  /** publication time, ms */
  t: number;
  /** who published it, from <author> «(FotMob)», else the channel title */
  source: string;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  const raw = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  return raw;
}

/** Plain text: tags out, entities decoded, «Continue reading →» out, spaces collapsed. */
export function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/Continue reading\s*→?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Only http(s) links to the publisher; utm_* parameters dropped. */
export function cleanLink(raw: string): string | null {
  try {
    const u = new URL(decodeEntities(raw.trim()));
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return null;
  }
}

export type ParsedFeed = { channel: string; items: FeedItem[] };

/** Parse RSS 2.0. Items without guid/link/date/title are skipped, never patched. */
export function parseRss(xml: string): ParsedFeed {
  const channelBlock = xml.split(/<item[\s>]/i)[0] ?? "";
  const channel = plainText(tag(channelBlock, "title") ?? "") || "FotMob";
  const items: FeedItem[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    const title = plainText(tag(block, "title") ?? "");
    const url = cleanLink(plainText(tag(block, "link") ?? ""));
    const guid = plainText(tag(block, "guid") ?? "") || url || "";
    const t = Date.parse(plainText(tag(block, "pubDate") ?? ""));
    if (!title || !url || !guid || !Number.isFinite(t) || seen.has(guid)) continue;
    seen.add(guid);
    const author = plainText(tag(block, "author") ?? "");
    const named = author.match(/\(([^()]{2,40})\)\s*$/)?.[1]?.trim();
    items.push({ guid, title, text: plainText(tag(block, "description") ?? ""), url, t, source: named || channel.replace(/\s+News$/i, "") || "FotMob" });
  }
  items.sort((a, b) => b.t - a.t);
  return { channel, items };
}

// ─── robots.txt ──────────────────────────────────────────────────────────────

/**
 * Is `path` allowed for `token` by this robots.txt? The group for our token
 * wins over `*`; inside a group the longest matching rule wins, Allow on a tie
 * (RFC 9309). `*` and `$` in rules are supported.
 */
export function robotsAllows(robots: string, path: string, token = NEWS_UA_TOKEN): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; pat: string }[] };
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const line of robots.split(/\r?\n/)) {
    const l = line.replace(/#.*/, "").trim();
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      if (val) cur.rules.push({ allow: key === "allow", pat: val });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const t = token.toLowerCase();
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && t.startsWith(a)));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    const re = new RegExp("^" + r.pat.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"));
    if (!re.test(path)) continue;
    const len = r.pat.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
  }
  return best ? best.allow : true;
}
