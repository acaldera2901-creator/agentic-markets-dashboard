// scripts/v3c/mock-news.ts (#REDESIGN-V3C news, news2) — a FAKE FotMob (news page +
// RSS) and a FAKE Claude endpoint for the local dev server and Playwright, so
// nothing leaves the machine (use with scripts/v3c/no-network.cjs and scripts/v3c/mock-db.ts).
//
//   npx tsx scripts/v3c/mock-news.ts &                     # 127.0.0.1:54398
//   NEWS_FOTMOB_ENABLED=1 \
//   NEWS_FOTMOB_PAGE_URL=http://127.0.0.1:54398/en/news \
//   NEWS_FOTMOB_FEED_URL=http://127.0.0.1:54398/topnews/feed?format=rss \
//   ANTHROPIC_API_KEY=mock NEWS_REWRITE_API_URL=http://127.0.0.1:54398 …  next dev / next start
//
// MOCK_NEWS_BLOCK=1 → the news page answers 403 with a challenge page (the source must stop itself).
//
// Serves: /robots.txt (FotMob's rules as read on 07/10), /en/news (the page recorded on
// 07/10, re-dated to the last hours, + 3 INVENTED items naming teams of the mock board),
// /topnews/feed (the recorded RSS, re-dated), POST /v1/messages (canned rewrites written
// by hand from the facts; unknown items answer «insufficient» and are therefore NOT shown).
// Every request is logged with its user-agent: the cache must keep them rare.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.MOCK_NEWS_PORT ?? 54398);
const BLOCK = process.env.MOCK_NEWS_BLOCK === "1";
const MIN = 60_000;
const H = 60 * MIN;
const now = Date.now();
const rfc = (t: number) => new Date(t).toUTCString();
const fx = (f: string) => readFileSync(join(__dirname, "../../lib/v3c/news/__fixtures__", f), "utf8");

// ─── RSS: recorded, re-dated 3 h, 9 h, 15 h … ago ───────────────────────────
const rssFixture = fx("fotmob-topnews.xml");
let k = 0;
const feed = rssFixture.replace(/<pubDate>[^<]*<\/pubDate>/g, () => `<pubDate>${rfc(now - (3 + 6 * k++) * H)}</pubDate>`);

// ─── news page: recorded list re-dated (same spacing as on 07/10, newest 6 min ago) + invented ──
type Raw = { id: string; title: string; lead?: string; gmtTime: string; sourceStr: string; page: { url: string } };
const pageFixture = fx("fotmob-news-page.html");
const nd = pageFixture.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)![1];
const data = JSON.parse(nd);
const fb = data.props.pageProps.fallback as Record<string, Raw[]>;
const key = Object.keys(fb).find((x) => /news/.test(x))!;
const rec = fb[key];
const shift = now - 6 * MIN - Date.parse(rec[0].gmtTime);
for (const r of rec) r.gmtTime = new Date(Date.parse(r.gmtTime) + shift).toISOString();
// INVENTED items (fake facts) naming mock-board teams, so links and «Most moved» have something to show
const INVENTED: Raw[] = [
  { id: "mock-1", title: "Inter confirm Lautaro Martinez fit for Torino trip", lead: "Inter said on Tuesday that Lautaro Martinez trained fully and is available for the Serie A game against Torino at the weekend.", gmtTime: new Date(now - 22 * MIN).toISOString(), sourceStr: "FotMob", page: { url: "/news/mock-1-inter-lautaro" } },
  { id: "mock-2", title: "Manchester United name unchanged squad for Tottenham visit", lead: "Manchester United have named the same 23 players who faced Brentford for Sunday's Premier League match against Tottenham Hotspur.", gmtTime: new Date(now - 3 * H).toISOString(), sourceStr: "FotMob", page: { url: "/news/mock-2-man-utd-squad" } },
  { id: "mock-3", title: "Bologna defender suspended after fifth booking", lead: "Bologna will be without their first-choice centre-back against Genoa after he picked up a fifth yellow card of the season.", gmtTime: new Date(now - 9 * H).toISOString(), sourceStr: "SI", page: { url: "/embed/news/mock-3/bologna-defender-suspended" } },
];
fb[key] = [...INVENTED, ...rec];
const page = pageFixture.replace(nd, JSON.stringify(data));
const CHALLENGE = "<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><div id='cf-chl-widget'></div></body></html>";

// canned rewrites, keyed by a piece of the ORIGINAL headline (local mock only)
const CANNED: [string, [string, string, string, string]][] = [
  ["Lautaro Martinez fit", ["Lautaro Martinez available for Inter at Torino", "Inter reported on Tuesday that the striker completed full training. He can play in this weekend’s Serie A match.", "Lautaro Martinez disponibile per l’Inter a Torino", "L’Inter ha comunicato martedì che l’attaccante si è allenato con il gruppo. Può giocare nel weekend."]],
  ["unchanged squad for Tottenham", ["Manchester United keep the same 23 for Spurs", "The club named the players used against Brentford for Sunday’s Premier League game against Tottenham.", "Manchester United conferma i 23 contro il Tottenham", "Il club ha convocato gli stessi giocatori della gara con il Brentford per la sfida di domenica."]],
  ["Bologna defender suspended", ["Bologna lose a centre-back to suspension against Genoa", "Bologna’s usual central defender misses the Genoa match after his fifth booking this season.", "Bologna senza un centrale contro il Genoa", "Il difensore titolare salta la sfida con il Genoa per la quinta ammonizione stagionale."]],
  ["Plenty to play for as Croatia and England", ["Croatia and England meet in Rijeka on Saturday", "This is the third round of their Nations League group. Each side has beaten Czechia and lost to Spain so far.", "Croazia e Inghilterra si sfidano sabato a Fiume", "Terza giornata di Nations League: entrambe hanno battuto la Cechia e perso con la Spagna."]],
  ["United States 1-0 Canada", ["United States beat Canada 1-0 in Minnesota", "Mauricio Pochettino’s team won a tight game against their neighbours and finished the international window unbeaten.", "Gli Stati Uniti battono il Canada 1-0 in Minnesota", "La squadra di Mauricio Pochettino vince una partita equilibrata e chiude la finestra internazionale da imbattuta."]],
  ["Argentina 3-0 Benin", ["Argentina beat Benin 3-0 in Messi’s farewell", "The game at Estadio Monumental was Lionel Messi’s 208th and last appearance for his country.", "L’Argentina batte il Benin 3-0 nell’addio di Messi", "Al Monumental Lionel Messi ha giocato la sua 208ª e ultima partita con la nazionale."]],
  ["England 3-0 Czechia", ["Kane scores twice as England beat Czechia 3-0", "Harry Kane matched the England appearance record at Wembley and added two goals in Thomas Tuchel’s win.", "Doppietta di Kane, l’Inghilterra batte la Cechia 3-0", "A Wembley Harry Kane eguaglia il record di presenze e segna due gol nella vittoria di Tuchel."]],
  ["Croatia 1-2 Spain", ["Spain come from behind to beat Croatia 2-1", "Mikel Merino came off the bench and scored both goals. Spain go through to the Nations League quarter-finals.", "La Spagna rimonta e batte la Croazia 2-1", "Mikel Merino entra dalla panchina e segna una doppietta. La Spagna va ai quarti di Nations League."]],
  ["Scotland 'outfought'", ["Slovenia beat Scotland at Hampden Park", "Slovenia recovered from a goal down. Scotland are still waiting for a home win under Sebastien Pocognoli.", "La Slovenia batte la Scozia a Hampden Park", "La Slovenia rimonta lo svantaggio. La Scozia aspetta ancora una vittoria in casa con Sebastien Pocognoli."]],
  ["Arsenal Suffer Late International Break Injury", ["Arsenal lose a player to injury during the international break", "A fitness problem late in the October international window has hit Arsenal.", "Arsenal, un infortunio durante la sosta per le nazionali", "Un problema fisico nella parte finale della sosta di ottobre colpisce l’Arsenal."]],
];

let n = 0;
createServer((req, res) => {
  n += 1;
  console.log(`[mock-news #${n}] ${req.method} ${req.url} ua=${req.headers["user-agent"] ?? "-"}`);
  if (req.method === "GET" && req.url === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("User-agent: *\nAllow: /\nDisallow: /api/*\nDisallow: /auth/*\n\nUser-agent: Googlebot\nAllow: /api/*\n");
  }
  if (req.method === "GET" && req.url === "/en/news") {
    if (BLOCK) {
      res.writeHead(403, { "content-type": "text/html", "cf-mitigated": "challenge" });
      return res.end(CHALLENGE);
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(page);
  }
  if (req.method === "GET" && req.url?.startsWith("/topnews/feed")) {
    res.writeHead(200, { "content-type": "application/rss+xml" });
    return res.end(feed);
  }
  if (req.method === "POST" && req.url === "/v1/messages") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const prompt = String(JSON.parse(body).messages?.[0]?.content ?? "");
      const hit = CANNED.find(([needle]) => prompt.includes(needle));
      const out = hit
        ? { status: "ok", headline_en: hit[1][0], body_en: hit[1][1], headline_it: hit[1][2], body_it: hit[1][3] }
        : { status: "insufficient", headline_en: "", body_en: "", headline_it: "", body_it: "" };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(out) }] }));
    });
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, "127.0.0.1", () => console.log(`[mock-news] http://127.0.0.1:${PORT}${BLOCK ? " (news page BLOCKED)" : ""}`));
