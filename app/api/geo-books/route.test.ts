import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/geo-books/route";
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";

// #PARTNERS-VELOBET-CASEA: l'endpoint ora restituisce anche il `country`, che i
// client usano per i partner con un link per paese. Il contratto `blocked` NON
// deve cambiare (ci si appoggia il gate gambling di tutto il sito).
const call = async (headers: Record<string, string>) => {
  const res = GET(new NextRequest("https://www.betredge.com/api/geo-books", { headers }));
  return (await res.json()) as { blocked: boolean; country: string };
};

describe("GET /api/geo-books", () => {
  it("restituisce il country dall'header Vercel, normalizzato ISO-2 uppercase", async () => {
    expect(await call({ "x-vercel-ip-country": "no" })).toEqual({ blocked: false, country: "NO" });
    expect(await call({ "x-vercel-ip-country": " CH " })).toEqual({ blocked: false, country: "CH" });
  });

  it("accetta anche l'header Cloudflare", async () => {
    expect(await call({ "cf-ipcountry": "FI" })).toEqual({ blocked: false, country: "FI" });
  });

  it("con blocklist vuota non blocca le giurisdizioni storiche", async () => {
    expect(await call({ "x-vercel-ip-country": "IT" })).toEqual({ blocked: false, country: "IT" });
    expect(await call({ "x-vercel-ip-country": "DE" })).toEqual({ blocked: false, country: "DE" });
  });

  it("riattiva il blocco quando un paese viene reinserito nella fonte centrale", async () => {
    GEO_BLOCKED_COUNTRIES.add("IT");
    try {
      expect(await call({ "x-vercel-ip-country": "IT" })).toEqual({ blocked: true, country: "IT" });
    } finally {
      GEO_BLOCKED_COUNTRIES.delete("IT");
    }
  });

  it("senza header: country vuoto e non bloccato (fail-open pre-esistente, #GOLIVE-HIGH-D)", async () => {
    // Il fail-open su geo IGNOTA è debito già tracciato lato /partners; qui si
    // fissa il comportamento attuale così che un cambio sia una scelta, non una
    // regressione silenziosa. Il country "" è invece fail-CLOSED per i partner
    // geo-ristretti (vedi lib/affiliate.test.ts).
    expect(await call({})).toEqual({ blocked: false, country: "" });
  });
});
