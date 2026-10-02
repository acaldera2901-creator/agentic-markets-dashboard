// #SPLIT-0201 — il track record spezzato per fonte: modello vs quote del partner.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { headlineFigure } from "./track-record";
import { wilson95, formatWilson } from "./wilson";

const { dbQuery } = vi.hoisted(() => ({ dbQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery }));
vi.mock("@/lib/auth", () => ({ resolveAccessState: async () => ({ state: "anonymous" }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T09:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); });

type R = Record<string, unknown>;
let seq = 0;
function row(over: R): R {
  seq += 1;
  return {
    id: `r${seq}`, sport: "tennis", competition: "ATP Tokyo", market: "match_winner", pick: "P1",
    player_one: `A${seq}`, player_two: `B${seq}`, home_team: null, away_team: null,
    starts_at: "2026-09-20T10:00:00Z", settled_at: "2026-09-20T12:00:00Z",
    published_at: "2026-09-19T08:00:00Z", result: "won", verification_state: "verified",
    notes: null, confidence_score: 65, is_paper: false, is_verified: false, is_demo: false,
    is_historical: true, model_version: "tennis-elo-v1",
    ...over,
  };
}
const many = (k: number, over: R) => Array.from({ length: k }, () => row(over));

async function stats(rows: R[]) {
  dbQuery.mockResolvedValueOnce(rows);
  const { GET } = await import("@/app/api/v2/history/route");
  const res = await GET(new Request("http://x/api/v2/history"));
  return (await res.json()).stats;
}

describe("/api/v2/history stats.by_source", () => {
  const P = "partner-market-v1";
  const fixture = [
    ...many(30, { result: "won" }),
    ...many(10, { result: "lost", model_version: "football-v4-xg-model", sport: "football",
      competition: "Serie A", market: "1X2", pick: "HOME" }).map((r, i) => ({
      ...r, home_team: `H${i}`, away_team: `W${i}`, player_one: null, player_two: null,
    })),
    ...many(20, { result: "won", model_version: P }),
    ...many(15, { result: "lost", model_version: P }),
    row({ result: "void", model_version: P }),
    row({ result: "lost", model_version: P, verification_state: "unverified" }),
    row({ result: null, model_version: "tennis-elo-v1" }),
  ];

  it("partizione esatta: model.n + market_partner.n === n, totale invariato", async () => {
    const s = await stats(fixture);
    expect(s.n).toBe(75);
    expect(s.win_rate).toBe(`${((50 / 75) * 100).toFixed(1)}%`);
    expect(s.by_source.model.n + s.by_source.market_partner.n).toBe(s.n);
    expect(s.by_source.model.won + s.by_source.market_partner.won).toBe(s.won);
    expect(s.by_source.model).toMatchObject({ n: 40, won: 30, lost: 10, win_rate: "75.0%" });
    expect(s.by_source.market_partner).toMatchObject({ n: 35, won: 20, lost: 15, win_rate: "57.1%" });
  });

  it("win_rate_display e intervallo di Wilson per blocco; copertura per fonte", async () => {
    const s = await stats(fixture);
    expect(s.by_source.model.win_rate_display).toBe(formatWilson(wilson95(30, 40)));
    expect(s.by_source.market_partner.win_rate_display).toBe(formatWilson(wilson95(20, 35)));
    // modello: 40 verificate su 41 finite (una senza esito)
    expect(s.by_source.model.coverage).toBe(Number((40 / 41).toFixed(3)));
    // partner: 36 verificate (void compreso) su 37 finite (una non verificata)
    expect(s.by_source.market_partner.coverage).toBe(Number((36 / 37).toFixed(3)));
  });

  it("sotto il campione minimo un blocco non pubblica la percentuale", async () => {
    const s = await stats([...many(40, { result: "won" }), ...many(3, { result: "lost", model_version: P })]);
    expect(s.by_source.market_partner).toMatchObject({ n: 3, win_rate: null, win_rate_display: null });
    expect(s.by_source.model.n + s.by_source.market_partner.n).toBe(s.n);
  });
});

describe("headlineFigure — la cifra in testa alla UI", () => {
  const stats = {
    won: 50, lost: 25, n: 75, win_rate: "66.7%", interval_95: { low: 0.5, high: 0.7 },
    by_source: {
      model: { n: 40, won: 30, lost: 10, win_rate: "75.0%", interval_95: { low: 0.6, high: 0.86 } },
      market_partner: { n: 35, won: 20, lost: 15, win_rate: "57.1%" },
    },
  };

  it("con by_source: la cifra principale resta il TOTALE, la scomposizione va sotto", () => {
    expect(headlineFigure(stats)).toEqual({
      winRate: "66.7%", n: 75, won: 50, lost: 25, interval95: { low: 0.5, high: 0.7 },
      breakdown: { model: { winRate: "75.0%", n: 40 }, partner: { winRate: "57.1%", n: 35 } },
    });
  });

  it("blocco sotto soglia: la scomposizione porta n ma nessuna percentuale", () => {
    const f = headlineFigure({ ...stats, by_source: { model: stats.by_source.model, market_partner: { n: 3, win_rate: null } } });
    expect(f.breakdown?.partner).toEqual({ winRate: null, n: 3 });
  });

  it("risposta vecchia senza by_source: il totale, come oggi, nessuna scomposizione", () => {
    const { by_source: _omit, ...old } = stats;
    void _omit;
    expect(headlineFigure(old)).toEqual({
      winRate: "66.7%", n: 75, won: 50, lost: 25, interval95: { low: 0.5, high: 0.7 }, breakdown: null,
    });
  });
});
