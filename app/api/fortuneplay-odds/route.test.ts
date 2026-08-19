// app/api/fortuneplay-odds/route.test.ts
// #A2-B2: la SOURCE deve redigere URL/quote FortunePlay per i viewer di una geo
// bloccata, non solo il rendering — così ogni consumer (WcBoard, MatchDetailSheet,
// football board) è coperto senza doverlo replicare a mano.
//
// #GEO-OPEN-0819 — la policy è cambiata: geo APERTA per default (decisione Jo, parere
// legale scritto), e la rotta ora legge la costante CONDIVISA invece di una copia
// locale con dentro solo "IT". Quindi questo file non prova più "l'Italia è bloccata"
// (non è più vero): prova che il MECCANISMO di redazione funziona quando una geo È
// configurata come bloccata, e in coda verifica il nuovo default aperto.
// L'env va settata PRIMA dell'import: la costante è calcolata al caricamento del modulo.
process.env.GEO_BLOCKED_COUNTRIES = "IT";

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

describe("GET /api/fortuneplay-odds — meccanismo di geo-redaction", () => {
  it("con nessuna geo bloccata anche un viewer IT vede tutto (default #GEO-OPEN-0819)", async () => {
    // Il default aperto va provato, non dedotto dal fatto che l'env non c'è: qui si
    // ricarica il modulo SENZA la env e si verifica che l'Italia non venga redatta.
    const prev = process.env.GEO_BLOCKED_COUNTRIES;
    delete process.env.GEO_BLOCKED_COUNTRIES;
    vi.resetModules();
    const { GET: GETopen } = await import("./route");
    const body = await (await GETopen(req("IT"))).json();
    const e = body.odds["2026-07-15:brazil|italy"];
    expect(e.oddsHome).toBe(2.1);
    expect(e.matchUrl).not.toBe("");
    process.env.GEO_BLOCKED_COUNTRIES = prev;
    vi.resetModules();
  });

  it("IT viewer: odds/URL/books rediotti, forma invariata", async () => {
    const res = await GET(req("IT"));
    const body = await res.json();
    const e = body.odds["2026-07-15:brazil|italy"];
    expect(e).toBeTruthy();
    // identità match preservata
    expect(e.id).toBe(99);
    expect(e.homeKey).toBe("italy");
    expect(e.awayKey).toBe("brazil");
    // niente quote / link / prefilled
    expect(e.oddsHome).toBeNull();
    expect(e.oddsDraw).toBeNull();
    expect(e.oddsAway).toBeNull();
    expect(e.totalLine).toBeNull();
    expect(e.totalOver).toBeNull();
    expect(e.totalUnder).toBeNull();
    expect(e.matchUrl).toBe("");
    expect(e.prefilled).toBe(false);
    expect(e.books).toEqual([]);
    expect(e.bestBook).toEqual({ home: null, draw: null, away: null });
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
