// #NEWSPORTS-FIX-REVIEW-1007 — una quota DERIVATA (mediana pari: nessun book la
// offre) non deve uscire da /api/newsports come quota di un bookmaker.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery: mocks.db }));
vi.mock("@/lib/auth", () => ({ resolveAccessState: mocks.auth }));
import { GET } from "./route";

const row = (notes: Record<string, unknown>) => ({
  id: "r1", sport: "baseball", league: "MLB", competition: "MLB Regular Season 2026",
  home_team: "Los Angeles Dodgers", away_team: "San Diego Padres",
  starts_at: "2099-10-07T23:00:00Z", pick: "HOME", confidence_score: 72,
  enrichment: { tier: "premium" }, updated_at: "2099-10-07T18:00:00Z",
  notes: JSON.stringify({ p_home: 0.72, p_away: 0.28, odds_home: 1.33, odds_away: 3.4,
    mkt_source: "median", n_books: 4, ...notes }),
});

beforeEach(() => {
  vi.stubEnv("NEWSPORT_SERVE_ENABLED", "true");
  mocks.auth.mockResolvedValue({ state: "premium" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

async function firstMatch() {
  const res = await GET(new Request("http://localhost/api/newsports"));
  return (await res.json()).matches[0];
}

describe("/api/newsports odds_derived", () => {
  it("derived odds are not served as a bookmaker price; probability is untouched", async () => {
    mocks.db.mockResolvedValue([row({ odds_derived: true })]);
    const m = await firstMatch();
    expect(m.odds_derived).toBe(true);
    expect(m.odds_a).toBeNull();
    expect(m.odds_b).toBeNull();
    expect(m.p_a).toBe(0.72);
    expect(m.p_b).toBe(0.28);
  });

  it("real book odds are served and flagged as not derived", async () => {
    mocks.db.mockResolvedValue([row({ odds_derived: false })]);
    const m = await firstMatch();
    expect(m.odds_derived).toBe(false);
    expect(m.odds_a).toBe(1.33);
    expect(m.odds_b).toBe(3.4);
  });

  it("rows written before the flag existed keep their (real) odds", async () => {
    mocks.db.mockResolvedValue([row({})]);
    const m = await firstMatch();
    expect(m.odds_derived).toBe(false);
    expect(m.odds_a).toBe(1.33);
  });

  it("dark default is unchanged", async () => {
    vi.stubEnv("NEWSPORT_SERVE_ENABLED", "");
    const body = await (await GET(new Request("http://localhost/api/newsports"))).json();
    expect(body).toEqual({ enabled: false, matches: [], computed_at: null });
    expect(mocks.db).not.toHaveBeenCalled();
  });
});
