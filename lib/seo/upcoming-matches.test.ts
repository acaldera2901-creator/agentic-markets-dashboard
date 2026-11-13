import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const dbQuery = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery }));

const { fetchUpcomingMatches, toMatches, balance } = await import("./upcoming-matches");
const { matchesJsonLd } = await import("@/components/seo/json-ld");
const { UpcomingMatches } = await import("@/components/seo/UpcomingMatches");

const row = (o: Record<string, unknown> = {}) => ({ id: "1", sport: "football", competition: "Serie A", league: null, home_team: "Venezia FC", away_team: "Udinese Calcio", player_one: null, player_two: null, starts_at: "2026-11-06T19:45:00Z", ...o }) as never;

describe("toMatches", () => {
  it("one entry per match (several markets collapse), tennis uses the players, bad rows are dropped", () => {
    const m = toMatches([
      row(), row({ id: "2" }), // same match, other market
      row({ id: "3", sport: "tennis", competition: "ATP Paris", home_team: null, away_team: null, player_one: "J. Sinner", player_two: "C. Alcaraz" }),
      row({ id: "4", home_team: "", away_team: "X" }),            // missing name
      row({ id: "5", starts_at: "not a date" }),                  // bad date
    ]);
    expect(m.map((x) => `${x.home} vs ${x.away}`)).toEqual(["Venezia FC vs Udinese Calcio", "J. Sinner vs C. Alcaraz"]);
    expect(m[1].sport).toBe("tennis");
  });
  it("tennis players only in home_team/away_team (live data shape) are kept", () => {
    const m = toMatches([row({ sport: "tennis", home_team: "J. Sinner", away_team: "C. Alcaraz", player_one: null, player_two: null })]);
    expect(m.map((x) => `${x.home} vs ${x.away}`)).toEqual(["J. Sinner vs C. Alcaraz"]);
  });
  it("empty-string home_team/away_team falls back to player_one/two", () => {
    const m = toMatches([row({ sport: "tennis", home_team: "", away_team: " ", player_one: "J. Sinner", player_two: "C. Alcaraz" })]);
    expect(m.map((x) => `${x.home} vs ${x.away}`)).toEqual(["J. Sinner vs C. Alcaraz"]);
  });
  it("balance: a tennis-only head of the list cannot crowd out football", () => {
    const tennis = Array.from({ length: 30 }, (_, i) => row({ id: `t${i}`, sport: "tennis", home_team: `P${i}`, away_team: `Q${i}`, starts_at: `2026-11-12T10:${String(i).padStart(2, "0")}:00Z` }));
    const foot = Array.from({ length: 5 }, (_, i) => row({ id: `f${i}`, home_team: `H${i}`, away_team: `A${i}`, starts_at: `2026-11-14T1${i}:00:00Z` }));
    const out = balance(toMatches([...tennis, ...foot], Infinity), 24);
    expect(out).toHaveLength(24);
    expect(out.filter((x) => x.sport === "football")).toHaveLength(5);
  });
  it("respects the limit", () => expect(toMatches(Array.from({ length: 10 }, (_, i) => row({ id: String(i), home_team: `H${i}` })), 3)).toHaveLength(3));
});

describe("fetchUpcomingMatches — public window only, fail-soft", () => {
  it("asks only for public columns with the anonymous window filters (no model %, odds, pick, edge)", async () => {
    dbQuery.mockResolvedValueOnce([row()]);
    const m = await fetchUpcomingMatches(24);
    expect(m).toHaveLength(1);
    const [sql] = dbQuery.mock.calls[0] as [string];
    expect(sql).toMatch(/is_demo = FALSE/); expect(sql).toMatch(/is_historical = FALSE/); expect(sql).toMatch(/published_at IS NOT NULL/);
    expect(sql).not.toMatch(/odds|edge|pick|confidence|model|probab|stake/i);
  });
  it("a DB error returns [] (the page still renders)", async () => {
    dbQuery.mockRejectedValueOnce(new Error("db down"));
    expect(await fetchUpcomingMatches()).toEqual([]);
  });
});

describe("JSON-LD + visible list (same facts)", () => {
  const ms = toMatches([row(), row({ id: "3", sport: "tennis", competition: "ATP Paris", home_team: null, away_team: null, player_one: "J. Sinner", player_two: "C. Alcaraz", starts_at: "2026-11-07T13:00:00Z" })]);
  it("describes the fixture directory without claiming eligibility for Event rich results", () => {
    const j = matchesJsonLd(ms) as { numberOfItems: number; itemListElement: Record<string, unknown>[] };
    expect(j.numberOfItems).toBe(ms.length);
    expect(j.itemListElement[0]).toMatchObject({ "@type": "ListItem", position: 1, name: "Venezia FC vs Udinese Calcio", description: expect.stringContaining("2026-11-06T19:45:00.000Z") });
    expect(j.itemListElement[1]).toMatchObject({ name: "J. Sinner vs C. Alcaraz", description: expect.stringContaining("ATP Paris") });
    expect(JSON.stringify(j)).not.toMatch(/SportsEvent|"location"|"offers"|"competitor"/);
  });
  it("keeps feed text from breaking out of the JSON-LD script", () => {
    const hostile = [{ ...ms[0], home: '</script><script>alert(1)</script>' }];
    const html = renderToStaticMarkup(createElement(UpcomingMatches, { matches: hostile }));
    expect(html).not.toContain('</script><script>alert(1)');
    const payload = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    expect(JSON.parse(payload!).itemListElement[0].name).toContain(hostile[0].home);
  });
  it("the server HTML contains every match (no JS needed) and the JSON-LD; nothing forbidden or gated", () => {
    const html = renderToStaticMarkup(createElement(UpcomingMatches, { matches: ms }));
    expect(html).toContain("Venezia FC vs Udinese Calcio"); expect(html).toContain("J. Sinner vs C. Alcaraz");
    expect(html).toContain("application/ld+json"); expect(html).toMatch(/Fri,? 6 Nov,? 19:45 UTC/);
    expect(html).not.toMatch(/\bROI\b|win[- ]?rate|guarantee|best odds|migliori quote|beat the market/i);
  });
  it("no matches → renders nothing (no empty heading, no empty JSON-LD)", () => expect(renderToStaticMarkup(createElement(UpcomingMatches, { matches: [] }))).toBe(""));
});


describe("complete public fixture inventory", () => {
  it("does not silently truncate valid matches at 24 or impose sport quotas", async () => {
    const rows = Array.from({ length: 340 }, (_, i) => row({ id: String(i), home_team: `Home ${i}`, away_team: `Away ${i}`, sport: i < 250 ? "football" : "tennis" }));
    dbQuery.mockResolvedValueOnce(rows);
    const matches = await fetchUpcomingMatches();
    expect(matches).toHaveLength(340);
    expect(matches.filter(m => m.sport === "football")).toHaveLength(250);
    expect(matches.filter(m => m.sport === "tennis")).toHaveLength(90);
    expect(toMatches(rows)).toHaveLength(340);
  });
});
