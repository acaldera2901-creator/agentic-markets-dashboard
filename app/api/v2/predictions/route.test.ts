import { describe, it, expect, vi, beforeEach } from "vitest";

// La route serve il feed principale (usePicks → FeedScreen): football + tennis.
// Mock delle dipendenze pesanti; il focus è il GATE di completezza (chi passa).
const dbQuery = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery }));
vi.mock("@/lib/auth", () => ({ resolveAccessState: vi.fn(async () => ({ state: "anonymous" })) }));
vi.mock("@/lib/access-projection", () => ({
  projectPrediction: (row: Record<string, unknown>) => ({ ...row, locked: false }),
}));
vi.mock("@/lib/affiliate", () => ({ withAffiliate: (p: unknown) => p }));
vi.mock("@/lib/goalscorer-fetch", () => ({ fetchGoalscorerByMatch: vi.fn(async () => new Map()) }));
vi.mock("@/lib/soft-lookup", () => ({ buildSoftLookup: vi.fn(async () => () => null) }));

const start = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); // domani (dentro finestra)

// 1) tennis: 2-vie, niente p_home ma pick + confidence_score → DEVE passare (fix).
const TENNIS = {
  id: "t1", sport: "tennis", market: "ML", pick: "Player A", confidence_score: 67,
  home_team: "Player A", away_team: "Player B", notes: null, starts_at: start, edge_percent: null,
};
// 2) football 1X2 completo: p_home nei notes → coalescato → passa (comportamento invariato).
const FOOTBALL = {
  id: "f1", sport: "football", market: "1X2", pick: "1", confidence_score: 50,
  home_team: "Home", away_team: "Away",
  notes: JSON.stringify({ p_home: 0.5, p_draw: 0.3, p_away: 0.2 }), starts_at: start, edge_percent: 4,
};
// 3) stub incompleto: niente p_home, niente pick/confidence → resta NASCOSTO (invariato).
const STUB = {
  id: "s1", sport: "football", market: "1X2", pick: null, confidence_score: null,
  home_team: "X", away_team: "Y", notes: null, starts_at: start, edge_percent: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbQuery.mockImplementation((sql: string) => {
    if (/tennis_predictions/.test(sql)) {
      return Promise.resolve([{ latest_prediction: null, latest_signal: null, predictions: "0", signals: "0" }]);
    }
    if (/unified_predictions/i.test(sql)) return Promise.resolve([TENNIS, FOOTBALL, STUB]);
    return Promise.resolve([]);
  });
});

async function servedIds() {
  const { GET } = await import("./route");
  const res = await GET(new Request("https://x/api/v2/predictions"));
  const json = (await res.json()) as { predictions: Array<{ id: string }>; meta: { count: number } };
  return json.predictions.map((p) => p.id);
}

describe("board v2 — gate di completezza (football + tennis)", () => {
  it("serve il tennis (pick + confidence_score, p_home null)", async () => {
    const ids = await servedIds();
    expect(ids).toContain("t1");
  });

  it("continua a servire il football 1X2 completo (p_home dai notes)", async () => {
    const ids = await servedIds();
    expect(ids).toContain("f1");
  });

  it("nasconde lo stub incompleto (niente p_home né pick/confidence)", async () => {
    const ids = await servedIds();
    expect(ids).not.toContain("s1");
    expect(ids).toHaveLength(2);
  });
});
