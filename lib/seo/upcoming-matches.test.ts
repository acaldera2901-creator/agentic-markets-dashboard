import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const dbQuery = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery }));

const { fetchUpcomingMatches, toMatches } = await import("./upcoming-matches");
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
  it("ItemList of SportsEvent with name, startDate, competitors", () => {
    const j = matchesJsonLd(ms) as { "@type": string; itemListElement: { position: number; item: Record<string, unknown> }[] };
    expect(j["@type"]).toBe("ItemList");
    expect(j.itemListElement[0].item).toMatchObject({ "@type": "SportsEvent", name: "Venezia FC vs Udinese Calcio", startDate: "2026-11-06T19:45:00.000Z", sport: "Soccer" });
    expect(j.itemListElement[1].item).toMatchObject({ sport: "Tennis", competitor: [{ "@type": "Person", name: "J. Sinner" }, { "@type": "Person", name: "C. Alcaraz" }] });
  });
  it("the server HTML contains every match (no JS needed) and the JSON-LD; nothing forbidden or gated", () => {
    const html = renderToStaticMarkup(createElement(UpcomingMatches, { matches: ms }));
    expect(html).toContain("Venezia FC vs Udinese Calcio"); expect(html).toContain("J. Sinner vs C. Alcaraz");
    expect(html).toContain("application/ld+json"); expect(html).toMatch(/Fri,? 6 Nov,? 19:45 UTC/);
    expect(html).not.toMatch(/\bROI\b|win[- ]?rate|guarantee|best odds|migliori quote|beat the market/i);
  });
  it("no matches → renders nothing (no empty heading, no empty JSON-LD)", () => expect(renderToStaticMarkup(createElement(UpcomingMatches, { matches: [] }))).toBe(""));
});
