// #LEDGER-SIGILLATA-1007 — (c) il track record pubblico conta le SIGILLATE dal
// LEDGER_SEALED_FROM in poi. Flag spento: una sola query, quella di main, e
// nessun campo nuovo nella risposta.
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { historyRead, ledgerRead } = vi.hoisted(() => ({ historyRead: vi.fn(), ledgerRead: vi.fn() }));
vi.mock("next/cache", async () => ({
  unstable_cache: (await import("@/tests/helpers/next-data-cache")).mockUnstableCache,
}));
vi.mock("@/lib/db", () => ({
  dbQueryStrict: (sql: string, params?: unknown[]) => sql.includes("FROM pick_ledger")
    ? ledgerRead(sql, params) : historyRead(sql, params),
}));
vi.mock("@/lib/auth", () => ({ resolveAccessState: async () => ({ state: "anonymous" }) }));

beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); });

const FROM = "2026-10-20T00:00:00Z";

// 30 partite del periodo: la servita AWAY perde 2-1, la sigillata HOME vince.
// + 30 partite PRIMA del periodo, identiche: devono restare perse.
function row(i: number, startsAt: string) {
  return {
    id: `r${startsAt}${i}`, sport: "football", competition: "Serie A", market: "1X2",
    home_team: `H${i}`, away_team: `A${i}`, starts_at: startsAt, settled_at: startsAt,
    published_at: "2026-10-01T08:00:00Z", pick: "AWAY", result: "lost",
    verification_state: "verified", notes: JSON.stringify({ final_score: "2-1" }),
    is_paper: false, is_verified: false, is_demo: false, confidence_score: 60,
    source_table: "match_predictions", source_id: `m${startsAt}${i}`,
  };
}
const dopo = Array.from({ length: 30 }, (_, i) => row(i, "2026-10-25T15:00:00Z"));
const prima = Array.from({ length: 30 }, (_, i) => row(i, "2026-10-10T15:00:00Z"));
const sigilli = dopo.map((r) => ({
  source_id: r.source_id, pick: "HOME", confidence: 0.6, commence_time: r.starts_at,
  settle_result: "lost", settle_outcome: "HOME",
}));

it("flag spento: una query, senza colonne del registro, e nessun sealed_grading", async () => {
  historyRead.mockResolvedValueOnce([...dopo, ...prima]);
  const { GET } = await import("./route");
  const { stats } = await (await GET(new Request("http://x/api/v2/history"))).json();
  expect(historyRead).toHaveBeenCalledTimes(1);
  expect(ledgerRead).not.toHaveBeenCalled();
  expect(historyRead.mock.calls[0][0]).not.toMatch(/source_id|pick_ledger/);
  expect(stats.won).toBe(0);
  expect(stats.lost).toBe(60);
  expect(stats).not.toHaveProperty("sealed_grading");
});

it("flag acceso: dal periodo conta la sigillata; prima nulla cambia", async () => {
  vi.stubEnv("LEDGER_SEALED_GRADING", "1");
  vi.stubEnv("LEDGER_SEALED_FROM", FROM);
  historyRead.mockResolvedValueOnce([...dopo, ...prima]);
  ledgerRead.mockResolvedValueOnce(sigilli);
  const { GET } = await import("./route");
  const { stats } = await (await GET(new Request("http://x/api/v2/history"))).json();
  expect(historyRead.mock.calls[0][0]).toContain("source_table, source_id");
  expect(ledgerRead.mock.calls[0][0]).toContain("FROM pick_ledger");
  expect(stats.won).toBe(30);
  expect(stats.lost).toBe(30);
  expect(stats.sealed_grading).toMatchObject({
    sealed_rows: 30, pick_differs: 30, result_changed: 30, served_without_seal: 0,
  });
});

it("flag acceso, registro illeggibile: il periodo esce dal numero e lo dichiara", async () => {
  vi.stubEnv("LEDGER_SEALED_GRADING", "1");
  vi.stubEnv("LEDGER_SEALED_FROM", FROM);
  const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
  historyRead.mockResolvedValueOnce([...dopo, ...prima]);
  ledgerRead.mockRejectedValueOnce(new Error("down"));
  const { GET } = await import("./route");
  const { stats } = await (await GET(new Request("http://x/api/v2/history"))).json();
  expect(stats.won + stats.lost).toBe(30);
  expect(stats.sealed_grading).toMatchObject({ unavailable: true, served_without_seal: 30 });
  err.mockRestore();
});

it("starts the independent ledger read before the history read completes", async () => {
 vi.stubEnv("LEDGER_SEALED_GRADING", "1");vi.stubEnv("LEDGER_SEALED_FROM", FROM);
 let finish!: (rows:typeof dopo)=>void;
 historyRead.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
 ledgerRead.mockResolvedValueOnce(sigilli);
 const {GET}=await import('./route');const response=GET(new Request('http://x/api/v2/history'));
 await new Promise(resolve=>setTimeout(resolve,0));
 const calls=ledgerRead.mock.calls.length;
 finish(dopo);await response;
 expect(calls).toBe(1);
});
