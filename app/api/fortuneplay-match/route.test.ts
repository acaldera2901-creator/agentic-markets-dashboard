// app/api/fortuneplay-match/route.test.ts
// La route condivide la blocklist centrale con gli altri ingressi sportsbook.
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";

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

describe("GET /api/fortuneplay-match — blocklist centrale vuota", () => {
  it("rende i mercati completi anche a un viewer IT", async () => {
    fetchFortuneplayMatchMarkets.mockClear();
    const res = await GET(req("99", "IT"));
    const body = await res.json();
    expect(body.markets).toHaveLength(1);
    expect(body.markets[0].outcomes[0].odds).toBe(1.8);
    expect(fetchFortuneplayMatchMarkets).toHaveBeenCalledOnce();
  });

  it("mantiene invariata la risposta per un viewer non-IT", async () => {
    const res = await GET(req("99", "GB"));
    const body = await res.json();
    expect(body.markets).toHaveLength(1);
    expect(body.markets[0].outcomes[0].odds).toBe(1.8);
  });

  it("riattiva la redazione quando IT viene reinserita nella blocklist centrale", async () => {
    GEO_BLOCKED_COUNTRIES.add("IT");
    fetchFortuneplayMatchMarkets.mockClear();
    try {
      const res = await GET(req("99", "IT"));
      expect(await res.json()).toEqual({ markets: [] });
      expect(fetchFortuneplayMatchMarkets).not.toHaveBeenCalled();
    } finally {
      GEO_BLOCKED_COUNTRIES.delete("IT");
    }
  });
});
