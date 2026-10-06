// polish: il payload compatto della board torna IDENTICO (andata e ritorno).
import { describe, expect, it } from "vitest";
import type { V3BoardResponse, V3BookPrice } from "./contracts";
import { isPacked, packBoard, unpackBoard } from "./board-pack";

const bp = (bookmaker: string, name: string, price: number, url: string, source: V3BookPrice["source"] = "live_feed"): V3BookPrice => ({ bookmaker, name, price, captured_at: "2026-10-06T08:00:00.000Z", source, url });

const board = {
  contract: "v3.board.2",
  generated_at: "2026-10-06T08:00:00.000Z",
  window_days: 10,
  matches: [
    {
      id: "oddsapi:a", sport: "football", league: "Serie A", competition: "Serie A", kickoff: "2026-10-06T11:00:00.000Z", home: "Inter", away: "Torino",
      outcomes: [
        { outcome: "home", market_price: 1.62, market_p: 0.59, model_p: null, estimate_p: 0.6, edge_pp: 0.2, book_prices: [bp("fortuneplay", "FortunePlay", 1.67, "https://fp.test/m/1"), bp("ybets", "YBets", 1.6, "https://yb.test/l", "price_history")], best_price: null },
        { outcome: "draw", market_price: 4.1, market_p: 0.23, model_p: null, estimate_p: 0.23, edge_pp: -0.1, book_prices: [], best_price: null },
      ],
    },
  ],
  tennis: [{ id: "tennis:x", sport: "tennis", sides: [{ side: "p1", player: "A", book_prices: [bp("fortuneplay", "FortunePlay", 1.45, "https://fp.test/m/2")], best_price: null }] }],
  coverage: {},
  notes: [],
} as unknown as V3BoardResponse;

describe("packBoard / unpackBoard", () => {
  it("round-trips to the same board", () => {
    const p = packBoard(board);
    expect(isPacked(p)).toBe(true);
    expect(unpackBoard(p)).toEqual(board);
  });
  it("stores each book and each URL once", () => {
    const p = packBoard(board);
    expect(p.books).toEqual([["fortuneplay", "FortunePlay"], ["ybets", "YBets"]]);
    expect(p.urls).toHaveLength(3);
    expect(JSON.stringify(p).length).toBeLessThan(JSON.stringify(board).length);
  });
  it("a board without tennis stays without tennis", () => {
    const { tennis: _t, ...noTennis } = board;
    void _t;
    expect(unpackBoard(packBoard(noTennis as V3BoardResponse))).toEqual(noTennis);
  });
});
