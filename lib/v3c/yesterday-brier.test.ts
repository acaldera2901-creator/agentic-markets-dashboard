// lib/v3c/yesterday-brier.test.ts (#REDESIGN-V3C fidelity) — «Ieri» come nel prototipo:
// Brier della stima accanto a quello del mercato, sulle STESSE righe appaiate.
import { describe, expect, it } from "vitest";
import { buildYesterday, type SealedDayRow } from "./yesterday";

const row = (o: Partial<SealedDayRow>): SealedDayRow => ({
  sport: "football", home: "A", away: "B", competition: "Serie A", pick: "HOME", confidence: 0.5,
  p_home: 0.5, p_draw: 0.3, p_away: 0.2, commence_time: "2026-10-05T15:00:00Z", captured_at: "2026-10-04T09:00:00Z",
  is_paper: false, result: "won", outcome: "HOME", final_score: "1-0", market_p_home: 0.45, market_p_draw: 0.3, market_p_away: 0.25, ...o,
});

describe("yesterday · Brier appaiato", () => {
  it("stima e mercato sulle stesse righe; una riga senza mercato al sigillo resta fuori da entrambi", () => {
    const y = buildYesterday([row({}), row({ result: "lost", outcome: "AWAY" }), row({ market_p_home: null, market_p_draw: null, market_p_away: null })], "2026-10-05");
    // riga 1: (0.5−1)²+0.3²+0.2² = 0.38 ; mercato (0.45−1)²+0.3²+0.25² = 0.455
    // riga 2: 0.5²+0.3²+(0.2−1)² = 0.98 ; mercato 0.45²+0.3²+(0.25−1)² = 0.855
    expect(y.brier).toEqual({ n: 2, estimate: 0.68, market: 0.655 });
  });

  it("nessuna riga appaiata: brier null (la striscia non lo mostra)", () => {
    expect(buildYesterday([row({ sport: "tennis", outcome: null })], "2026-10-05").brier).toBeNull();
  });
});
