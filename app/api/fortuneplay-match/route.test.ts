// app/api/fortuneplay-match/route.test.ts
// #A2-B2: la SOURCE deve azzerare i mercati FortunePlay per i viewer di una geo
// bloccata (usati dalla modal MatchDetailSheet), non solo nasconderli lato client.
//
// #GEO-OPEN-0819 — policy cambiata: geo APERTA per default (decisione Jo, parere
// legale scritto) e la rotta legge ora la costante CONDIVISA invece di una copia
// locale con solo "IT". Questo file prova il MECCANISMO con una geo configurata come
// bloccata, non piu' l'affermazione "l'Italia e' bloccata", che non e' piu' vera.
// L'env va settata PRIMA dell'import: la costante nasce al caricamento del modulo.
process.env.GEO_BLOCKED_COUNTRIES = "IT";

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

describe("GET /api/fortuneplay-match — meccanismo di geo-redaction", () => {
  it("senza geo bloccate anche un viewer IT riceve i mercati (default #GEO-OPEN-0819)", async () => {
    const prev = process.env.GEO_BLOCKED_COUNTRIES;
    delete process.env.GEO_BLOCKED_COUNTRIES;
    vi.resetModules();
    const { GET: GETopen } = await import("./route");
    const body = await (await GETopen(req("1", "IT"))).json();
    expect(body.markets.length).toBeGreaterThan(0);
    process.env.GEO_BLOCKED_COUNTRIES = prev;
    vi.resetModules();
  });

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
