// lib/v3c/final6.test.ts (#REDESIGN-V3C final6) — the reconciliations of the fixdata2 + fixui2 merge
import { describe, expect, it } from "vitest";
import { liveBoardMatches } from "./board-source";
import type { V3BoardResponse } from "./contracts";

const FUTURE = "2099-10-10T15:00:00.000Z";
const NOW = new Date("2099-10-10T09:00:00.000Z");
const outcome = (o: string, p: number) => ({ outcome: o, market_price: 1 / p, market_p: p, estimate_p: p, edge_pp: 0, book_prices: [] });
const match = (id: string, level?: "ok" | "no_value" | "market_only" | "no_market") =>
  ({ id, home: "A", away: "B", kickoff: FUTURE, competition: "Serie A", league: "Serie A", margin_removed: 0.05, outcomes: [outcome("home", 0.4), outcome("draw", 0.3), outcome("away", 0.3)], ...(level ? { model_guard: { level } } : {}) }) as unknown as V3BoardResponse["matches"][number];

describe("final6 · the tool pages read only matches the guard lets through", () => {
  it("liveBoardMatches drops guarded matches (no_value > 15 pp, market_only > 25 pp, no_market)", () => {
    const board = { matches: [match("ok"), match("legacy"), match("nv", "no_value"), match("mo", "market_only"), match("nm", "no_market")] };
    expect(liveBoardMatches(board, NOW).map((m) => m.id)).toEqual(["ok", "legacy"]);
  });
});
