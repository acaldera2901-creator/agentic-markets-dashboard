import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/geo-books/route";

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
    // Qui c'era " CH " come esempio di geo NON bloccata. Dal 18/08 la Svizzera è nel
    // hard-block (#CH01-P0-ADSPOLICY-0814), quindi come caso "trim + uppercase su geo
    // ammessa" serve un'altra geo; CH si è spostata nel test del blocco qui sotto.
    expect(await call({ "x-vercel-ip-country": " gb " })).toEqual({ blocked: false, country: "GB" });
  });

  it("accetta anche l'header Cloudflare", async () => {
    expect(await call({ "cf-ipcountry": "FI" })).toEqual({ blocked: false, country: "FI" });
  });

  it("blocca le giurisdizioni vietate e ne restituisce comunque il country", async () => {
    expect(await call({ "x-vercel-ip-country": "IT" })).toEqual({ blocked: true, country: "IT" });
    expect((await call({ "x-vercel-ip-country": "DE" })).blocked).toBe(true);
    // La Svizzera passa da qui: è questo `blocked` che chiude, fail-closed, la riga
    // loghi partner e il link /partners nel footer (SiteFooter) e l'intera pagina
    // /partners — superfici che l'allowlist env NON governa. È la ragione per cui il
    // blocco CH sta in codice e non in `SPORTSBOOK_GEO_ALLOWLIST`.
    expect(await call({ "x-vercel-ip-country": " ch " })).toEqual({ blocked: true, country: "CH" });
  });

  it("senza header: country vuoto e non bloccato (fail-open pre-esistente, #GOLIVE-HIGH-D)", async () => {
    // Il fail-open su geo IGNOTA è debito già tracciato lato /partners; qui si
    // fissa il comportamento attuale così che un cambio sia una scelta, non una
    // regressione silenziosa. Il country "" è invece fail-CLOSED per i partner
    // geo-ristretti (vedi lib/affiliate.test.ts).
    expect(await call({})).toEqual({ blocked: false, country: "" });
  });
});
