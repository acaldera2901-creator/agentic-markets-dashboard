// scripts/v3c/mock-news.ts (#REDESIGN-V3C news) — a FAKE FotMob feed and a FAKE
// Claude endpoint for the local dev server and Playwright, so nothing leaves the
// machine (use with scripts/v3c/no-network.cjs and scripts/v3c/mock-db.ts).
//
//   npx tsx scripts/v3c/mock-news.ts &                     # 127.0.0.1:54398
//   NEWS_FOTMOB_ENABLED=1 NEWS_FOTMOB_FEED_URL=http://127.0.0.1:54398/topnews/feed?format=rss \
//   ANTHROPIC_API_KEY=mock NEWS_REWRITE_API_URL=http://127.0.0.1:54398 …  next dev / next start
//
// Serves: /robots.txt (FotMob's rules as read on 07/10), /topnews/feed (the
// recorded fixture re-dated to the last hours + 3 INVENTED items naming teams of
// the mock board), POST /v1/messages (canned rewrites; unknown items answer
// «insufficient», so the page also shows the «not rewritten» state).
// Every request is logged with its user-agent: the cache must keep them rare.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.MOCK_NEWS_PORT ?? 54398);
const H = 3_600_000;
const now = Date.now();
const rfc = (t: number) => new Date(t).toUTCString();

const fixture = readFileSync(join(__dirname, "../../lib/v3c/news/__fixtures__/fotmob-topnews.xml"), "utf8");
// recorded items, re-dated: 3 h, 9 h, 15 h … ago (keeps the recorded order)
let k = 0;
const recorded = fixture.replace(/<pubDate>[^<]*<\/pubDate>/g, () => `<pubDate>${rfc(now - (3 + 6 * k++) * H)}</pubDate>`);

// INVENTED items (fake facts) naming mock-board teams, so links and «Most moved» have something to show
const INVENTED = [
  { id: "mock-1", h: 1.5, title: "Inter confirm Lautaro Martinez fit for Torino trip", text: "Inter said on Tuesday that Lautaro Martinez trained fully and is available for the Serie A game against Torino at the weekend." },
  { id: "mock-2", h: 7, title: "Manchester United name unchanged squad for Tottenham visit", text: "Manchester United have named the same 23 players who faced Brentford for Sunday's Premier League match against Tottenham Hotspur." },
  { id: "mock-3", h: 20, title: "Bologna defender suspended after fifth booking", text: "Bologna will be without their first-choice centre-back against Genoa after he picked up a fifth yellow card of the season." },
];
const invented = INVENTED.map(
  (i) => `<item><title>${i.title}</title><link>https://www.fotmob.com/topnews/${i.id}?utm_source=fotmob</link><description>${i.text}</description><pubDate>${rfc(now - i.h * H)}</pubDate><guid isPermaLink="false">urn:fotmob:feed:topnews:${i.id}</guid><author>no-reply@fotmob.com (FotMob)</author></item>`,
).join("");
const feed = recorded.replace("<item>", `${invented}<item>`);

const CANNED: Record<string, [string, string, string, string]> = {
  "mock-1": ["Lautaro Martinez available for Inter at Torino", "Inter reported on Tuesday that the striker completed full training. He can play in this weekend’s Serie A match.", "Lautaro Martinez disponibile per l’Inter a Torino", "L’Inter ha comunicato martedì che l’attaccante si è allenato con il gruppo. Può giocare nel weekend."],
  "mock-2": ["Manchester United keep the same 23 for Spurs", "The club named the players used against Brentford for Sunday’s Premier League game at home to Tottenham.", "Manchester United conferma i 23 contro il Tottenham", "Il club ha convocato gli stessi giocatori della gara con il Brentford per la sfida di domenica."],
  "mock-3": ["Bologna lose a centre-back to suspension against Genoa", "A fifth yellow card of the season rules out Bologna’s usual central defender for the Genoa match.", "Bologna senza un centrale contro il Genoa", "Il difensore titolare salta la sfida con il Genoa per la quinta ammonizione stagionale."],
  "29859": ["Croatia and England meet in Rijeka on Saturday", "It is matchday three of the Nations League. Both sides won against Czechia and lost to Spain in their opening games.", "Croazia e Inghilterra si sfidano sabato a Fiume", "Terza giornata di Nations League: entrambe hanno battuto la Cechia e perso con la Spagna."],
  "29838": ["Germany still searching for form under Klopp", "Germany missed the World Cup last 16 again after a loss to Paraguay. Julian Nagelsmann left the job on July 3.", "La Germania di Klopp cerca ancora la forma", "Dopo l’eliminazione con il Paraguay ai Mondiali, Julian Nagelsmann si è dimesso il 3 luglio."],
};

let n = 0;
createServer((req, res) => {
  n += 1;
  console.log(`[mock-news #${n}] ${req.method} ${req.url} ua=${req.headers["user-agent"] ?? "-"}`);
  if (req.method === "GET" && req.url === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("User-agent: *\nAllow: /\nDisallow: /api/*\nDisallow: /auth/*\n\nUser-agent: Googlebot\nAllow: /api/*\n");
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
      const hit = Object.entries(CANNED).find(([id]) => {
        const title = id.startsWith("mock") ? INVENTED.find((i) => i.id === id)!.title : null;
        return title ? prompt.includes(title) : prompt.includes(fixture.split(`topnews:${id}`)[0].split("<title>").pop()!.split("</title>")[0]);
      });
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
}).listen(PORT, "127.0.0.1", () => console.log(`[mock-news] http://127.0.0.1:${PORT}`));
