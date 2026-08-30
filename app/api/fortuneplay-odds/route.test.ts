// app/api/fortuneplay-odds/route.test.ts
// La route condivide la blocklist centrale con gli altri ingressi sportsbook.
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/betconstruct-feed", () => ({
  fetchAllBooks: vi.fn(async () => [
    {
      book: { key: "fortuneplay", name: "FortunePlay", base: "https://www.fortuneplay.com", apiPrefix: "/_sb_api/api/v2" },
      map: new Map([
        [
          "2026-07-15:brazil|italy",
          {
            teamPairKey: "2026-07-15:brazil|italy",
            homeKey: "italy",
            awayKey: "brazil",
            sport: "soccer",
            slug: "italy-brazil",
            id: 99,
            urnId: "bc:match:1",
            oddsHome: 2.1,
            oddsDraw: 3.2,
            oddsAway: 3.6,
            totalLine: 2.5,
            totalOver: 1.9,
            totalUnder: 1.95,
          },
        ],
      ]),
    },
  ]),
}));

const { GET } = await import("./route");

function req(country?: string) {
  const headers: Record<string, string> = {};
  if (country) headers["x-vercel-ip-country"] = country;
  return new NextRequest("http://localhost/api/fortuneplay-odds", { headers });
}

describe("GET /api/fortuneplay-odds — blocklist centrale vuota", () => {
  it("rende quote e URL completi anche a un viewer IT", async () => {
    const res = await GET(req("IT"));
    const body = await res.json();
    const entry = body.odds["2026-07-15:brazil|italy"];
    expect(body.geoBlocked).toBe(false);
    expect(entry.id).toBe(99);
    expect(entry.oddsHome).toBe(2.1);
    expect(entry.oddsDraw).toBe(3.2);
    expect(entry.oddsAway).toBe(3.6);
    expect(entry.matchUrl).not.toBe("");
    expect(entry.books.length).toBeGreaterThan(0);
  });

  it("viewer non-IT: risposta piena, non toccata", async () => {
    const res = await GET(req("GB"));
    const body = await res.json();
    const e = body.odds["2026-07-15:brazil|italy"];
    expect(e.oddsHome).toBe(2.1);
    expect(e.matchUrl).not.toBe("");
  });

  it("Cache-Control varia per country header (no bypass via CDN condivisa)", async () => {
    const res = await GET(req("IT"));
    expect(res.headers.get("Vary") || "").toContain("x-vercel-ip-country");
  });
});
