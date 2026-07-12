// app/api/fortuneplay-match/route.test.ts
// #A2-B2 (Decreto Dignità, D.L. 87/2018 art.9): la SOURCE deve azzerare i mercati
// FortunePlay per i viewer IT (usati dalla modal MatchDetailSheet), non solo
// nasconderli lato client.
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const fetchFortuneplayMatchMarkets = vi.fn(async () => [
  { name: "Both Teams To Score", line: null, outcomes: [{ label: "Yes", odds: 1.8 }, { label: "No", odds: 2.1 }] },
]);
vi.mock("@/lib/fortuneplay-match", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fortuneplay-match")>();
  return { ...actual, fetchFortuneplayMatchMarkets };
});

const { GET } = await import("./route");

function req(id: string, country?: string) {
  const headers: Record<string, string> = {};
  if (country) headers["x-vercel-ip-country"] = country;
  return new NextRequest(`http://localhost/api/fortuneplay-match?id=${id}`, { headers });
}

describe("GET /api/fortuneplay-match — geo-redaction (IT)", () => {
  it("IT viewer: markets vuoti, upstream non interrogato", async () => {
    fetchFortuneplayMatchMarkets.mockClear();
    const res = await GET(req("99", "IT"));
    const body = await res.json();
    expect(body).toEqual({ markets: [] });
    expect(fetchFortuneplayMatchMarkets).not.toHaveBeenCalled();
  });

  it("viewer non-IT: mercati pieni", async () => {
    const res = await GET(req("99", "GB"));
    const body = await res.json();
    expect(body.markets.length).toBe(1);
    expect(body.markets[0].outcomes[0].odds).toBe(1.8);
  });
});
