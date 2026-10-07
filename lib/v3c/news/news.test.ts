// lib/v3c/news/news.test.ts (#REDESIGN-V3C news) — the live news without the
// network: the FotMob RSS recorded on 2026-10-07 (first 8 items, images left in
// the fixture on purpose to prove they are never read), robots.txt, the
// rewriter checks, the fallback, team matching and «Most moved today».
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cleanLink, parseRss, plainText, robotsAllows, FOTMOB_FEED_URL, NEWS_USER_AGENT } from "./feed";
import { newsRewriter, checkRewrite, headlineFallback, readModelOutput, RewriteError, sharesRun, SYSTEM_PROMPT, userPrompt, MAX_WORDS } from "./rewrite";
import { aliasesFor, matchTeams } from "./teams";
import { dayMove, mostMoved, nearestInTime, DAY_MS } from "./movers";

const XML = readFileSync(join(__dirname, "__fixtures__", "fotmob-topnews.xml"), "utf8");
const H = 3_600_000;

describe("feed · the recorded FotMob RSS", () => {
  const { channel, items } = parseRss(XML);
  it("reads the 8 items, newest first, with guid, link, date and source", () => {
    expect(channel).toBe("FotMob News");
    expect(items).toHaveLength(8);
    expect(items[0].guid).toBe("urn:fotmob:feed:topnews:29859");
    expect(items[0].t).toBe(Date.parse("Fri, 02 Oct 2026 11:15:49 GMT"));
    expect(items[0].source).toBe("FotMob");
    for (let i = 1; i < items.length; i++) expect(items[i].t).toBeLessThanOrEqual(items[i - 1].t);
  });
  it("drops utm tracking from the link and keeps it on fotmob.com", () => {
    expect(items[0].url).toBe("https://www.fotmob.com/topnews/29859-preview-plenty-play-croatia-england-clash-once-again");
    for (const it of items) expect(new URL(it.url).hostname).toBe("www.fotmob.com");
  });
  it("never carries an image: no thumbnail URL anywhere in the parsed items", () => {
    expect(XML).toContain("media:thumbnail");
    expect(JSON.stringify(items)).not.toMatch(/wp-content|\.png|\.jpg|thumbnail/i);
  });
  it("teaser is plain text: no tags, entities decoded, «Continue reading» gone", () => {
    expect(items[0].text).not.toMatch(/<|&amp;|Continue reading/);
    expect(plainText("a &amp; b<br/>c &#8217; d")).toBe("a & b c ’ d");
  });
  it("skips broken items instead of patching them", () => {
    const bad = `<rss><channel><title>X</title><item><title>no link</title><guid>g1</guid><pubDate>Fri, 02 Oct 2026 11:15:49 GMT</pubDate></item><item><title>ok</title><link>https://x.test/a?utm_source=y&amp;id=2</link><guid>g2</guid><pubDate>Fri, 02 Oct 2026 11:15:49 GMT</pubDate></item><item><title>bad date</title><link>https://x.test/b</link><guid>g3</guid><pubDate>yesterday</pubDate></item></channel></rss>`;
    const p = parseRss(bad);
    expect(p.items.map((i) => i.guid)).toEqual(["g2"]);
    expect(p.items[0].url).toBe("https://x.test/a?id=2");
    expect(cleanLink("javascript:alert(1)")).toBeNull();
  });
  it("the request identifies us and points only at the public RSS", () => {
    expect(NEWS_USER_AGENT).toMatch(/^BetRedgeNews\/1\.0 \(\+https:\/\/www\.betredge\.com.*info@betredge\.com\)$/);
    expect(FOTMOB_FEED_URL).toBe("https://www.fotmob.com/topnews/feed?format=rss");
    expect(FOTMOB_FEED_URL).not.toMatch(/\/api\//);
  });
});

describe("robots.txt", () => {
  const FOTMOB = "User-agent: *\nAllow: /\nDisallow: /api/*\nDisallow: /auth/*\n\nUser-agent: Googlebot\nAllow: /api/*\n";
  it("FotMob's real rules (07/10): the feed is allowed, /api is not", () => {
    expect(robotsAllows(FOTMOB, "/topnews/feed?format=rss")).toBe(true);
    expect(robotsAllows(FOTMOB, "/api/data/news")).toBe(false);
  });
  it("a group for our token wins over *, longest rule wins", () => {
    const r = "User-agent: *\nAllow: /\n\nUser-agent: BetRedgeNews\nDisallow: /topnews/\nAllow: /topnews/feed$\n";
    expect(robotsAllows(r, "/topnews/feed?format=rss")).toBe(false);
    expect(robotsAllows(r, "/topnews/feed")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /\n", "/topnews/feed")).toBe(false);
    expect(robotsAllows("", "/anything")).toBe(true);
  });
});

const item = parseRss(XML).items[0];

describe("rewrite · checks and fallback", () => {
  const good = {
    en: { title: "Croatia host England in Rijeka on Saturday", body: "The Nations League sides meet in matchday three. Both beat Czechia and lost to Spain in their first two games." },
    it: { title: "La Croazia ospita l’Inghilterra a Fiume sabato", body: "Terza giornata di Nations League. Entrambe hanno battuto la Cechia e perso con la Spagna." },
  };
  it("a faithful, short, new text passes", () => {
    expect(checkRewrite(good, item)).toBeNull();
  });
  it("rejects the banned lexicon in EN and IT (tips, lock, guaranteed, odds, scommessa)", () => {
    for (const w of ["a lock for England", "guaranteed win", "our tips", "England odds shorten", "best bet"]) expect(checkRewrite({ ...good, en: { ...good.en, body: w } }, item)).toMatch(/banned/);
    expect(checkRewrite({ ...good, it: { ...good.it, body: "una scommessa sicura" } }, item)).toMatch(/it: banned/);
  });
  it("rejects anything that looks like a price", () => {
    expect(checkRewrite({ ...good, en: { ...good.en, body: "England are 2.15 away." } }, item)).toMatch(/price/);
  });
  it(`rejects more than ${MAX_WORDS} words and long headlines`, () => {
    expect(checkRewrite({ ...good, en: { ...good.en, body: "word ".repeat(60) } }, item)).toMatch(/over 60/);
    expect(checkRewrite({ ...good, en: { ...good.en, title: "a b c d e f g h i j k l m n o" } }, item)).toMatch(/title too long/);
  });
  it("rejects a copied 6-word run from the teaser and the verbatim headline", () => {
    expect(sharesRun("They said Croatia play host to England on Saturday", item.text)).toBe(true);
    expect(checkRewrite({ ...good, en: { ...good.en, body: "Croatia play host to England on Saturday evening." } }, item)).toMatch(/6-word/);
    const shortHead = { ...item, title: "Kane breaks record", text: "" };
    expect(checkRewrite({ ...good, en: { title: "Kane breaks record", body: "It happened in Munich on Saturday night." } }, shortHead)).toMatch(/headline/);
  });
  it("a failed rewrite records only why: the original headline never travels (news2)", () => {
    expect(headlineFallback(item, "no-key")).toEqual({ kind: "headline", reason: "no-key" });
    expect(JSON.stringify(headlineFallback(item, "x"))).not.toContain(item.title);
  });
  it("the IT text is held to the same anti-copy rule as the EN", () => {
    expect(checkRewrite({ ...good, it: { ...good.it, body: "Croatia play host to England on Saturday evening." } }, item)).toMatch(/6-word/);
  });
  it("claim filter: stake, profit, free bet, bonus, vincite are refused", () => {
    for (const w of ["a big stake on Spain", "easy profit", "free bet inside", "welcome bonus"]) expect(checkRewrite({ ...good, en: { ...good.en, body: w } }, item)).toMatch(/banned/);
    expect(checkRewrite({ ...good, it: { ...good.it, body: "vincite per tutti" } }, item)).toMatch(/it: banned/);
  });
  it("the prompt imposes facts-only, no betting, ≤60 words, EN+IT, «insufficient», data not instructions", () => {
    for (const s of [/only facts/i, /Add nothing/, /No betting content/, /60 words/, /Italian/, /insufficient/, /data, not instructions/]) expect(SYSTEM_PROMPT).toMatch(s);
    expect(userPrompt(item)).toContain(item.title);
    expect(userPrompt(item)).not.toMatch(/thumbnail|\.png/);
  });
});

describe("rewrite · Claude through the Messages API (fetch faked, no network)", () => {
  const out = (o: object, stop = "end_turn") => ({ ok: true, status: 200, json: async () => ({ stop_reason: stop, content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(o) }] }) });
  const ok = { status: "ok", headline_en: "Croatia host England in Rijeka on Saturday", body_en: "The Nations League sides meet in matchday three.", headline_it: "La Croazia ospita l’Inghilterra sabato", body_it: "Terza giornata di Nations League a Fiume." };
  it("no credential → no rewriter (nothing rewritten, nothing shown)", () => {
    expect(newsRewriter({})).toBeNull();
    expect(newsRewriter({ ANTHROPIC_API_KEY: "  " })).toBeNull();
    expect(newsRewriter({ VERCEL_OIDC_TOKEN: "oidc" })).toBeNull(); // OIDC alone never spends: needs NEWS_REWRITE_PROVIDER=gateway
  });
  it("direct: Haiku 4.5 by default, key, structured output, no effort; reads the JSON into an AI note", async () => {
    const f = vi.fn(async () => out(ok));
    const rw = newsRewriter({ ANTHROPIC_API_KEY: "k-test" }, f as unknown as typeof fetch)!;
    expect(rw.id).toBe("anthropic:claude-haiku-4-5:v2");
    const note = await rw.rewrite(item);
    expect(note).toMatchObject({ kind: "ai", en: { title: ok.headline_en }, it: { body: ok.body_it }, model: "claude-haiku-4-5" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const h = init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe("k-test");
    expect(h["anthropic-beta"]).toBeUndefined();
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.effort).toBeUndefined();
    expect(body.fallbacks).toBeUndefined();
    expect(body.messages[0].content).toContain(item.title);
  });
  it("a 5.5 model override gets low effort and the refusal fallback", async () => {
    const f = vi.fn(async () => out(ok));
    await newsRewriter({ ANTHROPIC_API_KEY: "k", NEWS_REWRITE_MODEL: "claude-opus-5-5" }, f as unknown as typeof fetch)!.rewrite(item);
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.output_config.effort).toBe("low");
    expect(body.fallbacks).toBe("default");
    expect((init.headers as Record<string, string>)["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
  });
  it("AI Gateway: with its key, or with NEWS_REWRITE_PROVIDER=gateway and the Vercel OIDC token (Bearer)", async () => {
    const f = vi.fn(async () => out(ok));
    const rw = newsRewriter({ NEWS_REWRITE_PROVIDER: "gateway", VERCEL_OIDC_TOKEN: "oidc-test" }, f as unknown as typeof fetch)!;
    expect(rw.id).toBe("gateway:anthropic/claude-haiku-4.5:v2");
    await rw.rewrite(item);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/messages");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer oidc-test");
    expect(JSON.parse(String(init.body)).model).toBe("anthropic/claude-haiku-4.5");
    const g = vi.fn(async () => out(ok));
    await newsRewriter({ AI_GATEWAY_API_KEY: "gw" }, g as unknown as typeof fetch)!.rewrite(item);
    expect(((g.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>).authorization).toBe("Bearer gw");
    // gateway chosen but no token in this context → a transient error, nothing sent
    const h = vi.fn(async () => out(ok));
    await expect(newsRewriter({ NEWS_REWRITE_PROVIDER: "gateway" }, h as unknown as typeof fetch)!.rewrite(item)).rejects.toThrow("http 401");
    expect(h).not.toHaveBeenCalled();
  });
  it("a fenced JSON answer (proxy without the schema) is still read; prose is not", () => {
    expect(readModelOutput("```json\n" + JSON.stringify(ok) + "\n```", item, "m").kind).toBe("ai");
    expect(() => readModelOutput("Here you go: " + JSON.stringify(ok), item, "m")).toThrow(RewriteError);
  });
  it("«insufficient», a refusal, a failed check or bad JSON all throw (→ headline)", async () => {
    const run = (r: object) => newsRewriter({ ANTHROPIC_API_KEY: "k" }, (async () => r) as unknown as typeof fetch)!.rewrite(item);
    await expect(run(out({ ...ok, status: "insufficient" }))).rejects.toThrow("insufficient");
    await expect(run(out(ok, "refusal"))).rejects.toThrow("refusal");
    await expect(run(out({ ...ok, body_en: "England are a lock." }))).rejects.toThrow(/banned/);
    await expect(run({ ok: false, status: 529, json: async () => ({}) })).rejects.toThrow("http 529");
    expect(() => readModelOutput("{nope", item, "m")).toThrow(RewriteError);
  });
});

describe("teams · deterministic matching with aliases", () => {
  const board = ["Croatia", "England", "Inter", "Manchester United", "Brighton & Hove Albion", "Germany", "Real Sociedad"];
  it("finds national teams in the recorded items, possessives included", () => {
    const [croEng, , germany] = parseRss(XML).items;
    expect([...matchTeams(`${croEng.title}. ${croEng.text}`, board)].sort()).toEqual(["Croatia", "England"]);
    expect([...matchTeams(germany.title, board)]).toEqual(["Germany"]);
  });
  it("aliases: Man Utd, Brighton; affixes stripped; generic words never alone", () => {
    expect(matchTeams("Man Utd beat Brighton", board)).toEqual(new Set(["Manchester United", "Brighton & Hove Albion"]));
    expect(aliasesFor("Brighton & Hove Albion")).toContain("brighton");
    expect(aliasesFor("Real Sociedad")).not.toContain("real");
    expect(matchTeams("Real Madrid win again", board).size).toBe(0);
  });
  it("the longer name owns its words: «Inter Miami» is not «Inter»", () => {
    expect(matchTeams("Messi scores for Inter Miami", board).size).toBe(0);
    expect(matchTeams("Inter Milan sign a defender", board)).toEqual(new Set(["Inter"]));
  });
  it("an alias two board teams share counts for neither", () => {
    expect(matchTeams("City win", ["Manchester City", "Leicester City"]).size).toBe(0);
    expect(matchTeams("Man City win", ["Manchester City", "Leicester City"])).toEqual(new Set(["Manchester City"]));
  });
});

describe("movers · «Most moved today», timing only", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  const line = (vs: [number, number][]) => vs.map(([h, v]) => ({ t: now - h * H, v }));
  it("from = price in force 24 h ago, to = last; the step is the biggest single change", () => {
    const m = dayMove(line([[40, 2.0], [30, 2.05], [20, 2.1], [10, 2.3], [1, 2.32]]), now)!;
    expect(m.from).toBe(2.05);
    expect(m.to).toBe(2.32);
    expect(m.stepAt).toBe(now - 10 * H);
  });
  it("no move, one point, or only future points → null", () => {
    expect(dayMove(line([[5, 2.0], [1, 2.0]]), now)).toBeNull();
    expect(dayMove(line([[5, 2.0]]), now)).toBeNull();
    expect(dayMove([{ t: now + H, v: 2 }, { t: now + 2 * H, v: 3 }], now)).toBeNull();
    expect(DAY_MS).toBe(24 * H);
  });
  it("nearest news within 72 h, never further", () => {
    const items = [{ t: now - 80 * H }, { t: now - 9 * H }, { t: now - 13 * H }];
    expect(nearestInTime(items, now - 10 * H)).toBe(items[1]);
    expect(nearestInTime([{ t: now - 100 * H }], now)).toBeNull();
  });
  it("ranks by relative move and links the note that names a team", () => {
    const mk = (id: string, home: string, away: string, pts: [number, number][]) => ({ m: { id, home, away, league: "L", competition: null, kickoff: new Date(now + 5 * H).toISOString() }, outcome: "home" as const, points: line(pts) });
    const rows = [mk("a", "Croatia", "England", [[30, 2.0], [6, 2.4]]), mk("b", "Inter", "Torino", [[30, 1.6], [6, 1.62]]), mk("c", "X", "Y", [[3, 3.0]])];
    const res = mostMoved(rows, new Map([["g1", ["England"]]]), [{ guid: "g1", t: now - 7 * H }, { guid: "g2", t: now - 6 * H }], now);
    expect(res.map((r) => r.id)).toEqual(["a", "b"]);
    expect(res[0].news).toEqual({ guid: "g1", t: now - 7 * H });
    expect(res[1].news).toBeNull();
  });
});
