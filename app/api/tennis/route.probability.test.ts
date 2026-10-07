import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery: mocks.db }));
vi.mock("@/lib/auth", () => ({ resolveAccessState: mocks.auth }));
import { GET } from "./route";
import { tennisPredictionToUnifiedInsert } from "@/lib/tennis-adapter";
import { applyTennisTemperature } from "@/lib/tennis-calibration";
import * as surfacing from "@/lib/surfacing-gate";

const fixture = (source: string | null = "market", best_selection = "P1") => ({
  match_id: "tennis:test:1", player1: "Player A", player2: "Player B", tournament: "Wimbledon", surface: "grass",
  scheduled_at: "2099-09-29T12:00:00Z", p1: .8, p2: .2, odds_p1: 1.3, odds_p2: 4.2,
  edge: null, best_selection, model_version: "test", serve_form_p1: .7, serve_form_p2: .6,
  return_form_p1: .4, return_form_p2: .3, feature_quality: .8,
  feature_snapshot: source ? { private_feature: "do not expose", probability: { version: "tennis-probability-v1", source, raw_p1: .8, raw_p2: .2 } } : undefined,
});
beforeEach(() => {
  vi.stubEnv("KV_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", ""); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  mocks.auth.mockResolvedValue({ state: "premium" });
  mocks.db.mockResolvedValue([fixture()]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("real tennis GET probability parity", () => {
  it.each(["market", "model", null])("DB %s uses the adapter pair, confidence, side and odds", async source => {
    const row = fixture(source, "P2"); mocks.db.mockResolvedValue([row]);
    const response = await GET(new Request("http://localhost/api/tennis"));
    const { matches: [out] } = await response.json();
    const unified = tennisPredictionToUnifiedInsert(row);
    expect(out.p1).toBe(source === "market" ? applyTennisTemperature(.8) : .8);
    expect(out.p2).toBe(source === "market" ? applyTennisTemperature(.2) : .2);
    expect(out.confidence_score).toBe(unified.confidence_score);
    expect(out.pick).toBe(unified.pick);
    expect(out.best_selection).toBe("P2");
    expect(out.odds_p2).toBe(unified.odds);
    expect(out).not.toHaveProperty("feature_snapshot");
    expect(mocks.db.mock.calls[0][0]).toContain("tp.feature_snapshot");
  });
  it("Redis uses the same contract without consulting DB", async () => {
    const row = fixture();
    vi.stubEnv("KV_URL", "https://redis.invalid"); vi.stubEnv("KV_REST_API_TOKEN", "test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: JSON.stringify({ predictions: [row] }) }) }));
    const { matches: [out], source } = await (await GET(new Request("http://localhost/api/tennis"))).json();
    expect(source).toBe("redis");
    expect(out.p1).toBe(applyTennisTemperature(.8));
    expect(out.confidence_score).toBe(tennisPredictionToUnifiedInsert(row).confidence_score);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("retains the same valid selected price across both serving paths", async () => {
    const row = { ...fixture("model"), odds_p1: 1.23456 }; mocks.db.mockResolvedValue([row]);
    const { matches: [out] } = await (await GET(new Request("http://localhost/api/tennis"))).json();
    expect(out.odds_p1).toBe(tennisPredictionToUnifiedInsert(row).odds);
  });
  it("both gates receive the raw probability for the selected side", async () => {
    const gate = vi.spyOn(surfacing, "tennisSurfaceDecision");
    const row = fixture("market", "P2"); mocks.db.mockResolvedValue([row]);
    await GET(new Request("http://localhost/api/tennis"));
    tennisPredictionToUnifiedInsert(row);
    expect(gate).toHaveBeenCalledTimes(3);
    for (const args of gate.mock.calls) expect(args).toEqual([20, "Wimbledon", 4.2]);
  });
  it("invalid pairs cannot produce an adapter pick, prose, confidence or odds", () => {
    for (const p1 of [NaN, Infinity, 1.2]) {
      const out = tennisPredictionToUnifiedInsert({ ...fixture(), p1 });
      expect(out.pick).toBeNull(); expect(out.explanation).toBeNull();
      expect(out.confidence_score).toBeNull(); expect(out.odds).toBeNull();
    }
  });
  it("calibration does not change the raw-based free daily slots", async () => {
    mocks.auth.mockResolvedValue({ state: "free" });
    const day = new Date().toISOString().slice(0,10);
    const rows = [.9,.85,.8,.79].map((p1,i) => ({ ...fixture(i===2 ? "market" : "model"), match_id: String(i), scheduled_at: `${day}T23:59:00Z`, p1, p2: 1-p1,
      feature_snapshot: { probability: { version: "tennis-probability-v1", source: i===2 ? "market" : "model", raw_p1: p1, raw_p2: 1-p1 } } }));
    mocks.db.mockResolvedValue(rows);
    const { matches } = await (await GET(new Request("http://localhost/api/tennis"))).json();
    expect(matches.filter((r: { locked: boolean }) => !r.locked).map((r: { id: string })=>r.id)).toEqual(["0","1","2"]);
    expect(matches[2].confidence_score).toBeLessThan(79);
  });
  it("locked headline uses selected published probability and strips private provenance/direction", async () => {
    mocks.auth.mockResolvedValue({ state: "anonymous" }); mocks.db.mockResolvedValue([fixture("market", "P2")]);
    const { matches: [out] } = await (await GET(new Request("http://localhost/api/tennis"))).json();
    expect(out.locked).toBe(true);
    expect(out.model_prob).toBe(applyTennisTemperature(.2));
    expect(out.market_odds).toBe(4.2);
    for (const key of ["feature_snapshot", "probability", "raw", "raw_p1", "raw_p2", "selectedRawProbability", "selection"]) expect(out).not.toHaveProperty(key);
    for (const key of ["p1", "p2", "best_selection", "odds_p1", "odds_p2", "edge"]) expect(out[key]).toBeNull();
    expect(out.pick ?? null).toBeNull();
  });
  it("rejects invalid pairs; invalid odds do not calibrate or become selected odds", async () => {
    mocks.db.mockResolvedValue([{ ...fixture(), p1: 1.2, p2: -.2 }]);
    expect((await (await GET(new Request("http://localhost/api/tennis"))).json()).matches).toEqual([]);
    mocks.db.mockResolvedValue([{ ...fixture(), odds_p1: 1 }]);
    const { matches: [out] } = await (await GET(new Request("http://localhost/api/tennis"))).json();
    expect(out.p1).toBe(.8); expect(out.odds_p1).toBeNull();
  });
});
