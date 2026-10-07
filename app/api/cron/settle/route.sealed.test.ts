// #LEDGER-SIGILLATA-1007 — (b) lo step C chiude il registro sulla pick SIGILLATA
// per le partite del periodo. Flag spento: l'esito nel registro e' quello
// servito, e il registro non viene nemmeno letto (come main).
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  unified: [] as Array<Record<string, unknown>>,
  ledger: [] as Array<Record<string, unknown>>,
  ledgerError: null as null | { message: string },
  upserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  ledgerReads: 0,
}));

function fakeSb() {
  const from = (table: string) => {
    const st = { op: "select", sel: "" };
    const b: Record<string, unknown> = new Proxy({}, {
      get(_t, prop) {
        if (prop === "select") return (s: string) => { st.sel = s; return b; };
        if (prop === "update") return () => { st.op = "update"; return b; };
        if (prop === "upsert") return (p: Record<string, unknown>) => { st.op = "upsert"; h.upserts.push({ table, payload: p }); return b; };
        if (prop === "then") {
          return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
            let data: unknown = [];
            let error: unknown = null;
            if (st.op === "select" && table === "unified_predictions" && st.sel.includes("pick, market")) data = h.unified;
            if (st.op === "select" && table === "pick_ledger") { h.ledgerReads += 1; data = h.ledger; error = h.ledgerError; }
            if (st.op !== "select") data = null;
            return Promise.resolve({ data, error }).then(res, rej);
          };
        }
        return () => b;
      },
    });
    return b;
  };
  return { from };
}

vi.mock("@/lib/db", () => ({ dbQuery: async () => [], getSupabaseAdminClient: () => fakeSb() }));
vi.mock("@/lib/football-data", () => ({
  fetchAllTodayMatches: async () => [{ id: "m1", status: "FINISHED", homeGoals: 2, awayGoals: 1 }],
}));
vi.mock("@/lib/summer-leagues", () => ({ SUMMER_LEAGUES: {}, fetchSummerResults: async () => [] }));
vi.mock("@/lib/espn-results", () => ({
  ESPN_SLUG_BY_FD_LEAGUE: {}, abbinaFinale: () => null, abbinaFinaleCerto: () => null,
  espnSlugForLeague: () => null, fetchEspnFinalsByDate: async () => [], pianoRecuperoEspn: () => [],
  yyyymmddUtc: () => "20261101",
}));
vi.mock("@/lib/espn", () => ({ ESPN_RECOVERY_DAYS: 7 }));
vi.mock("@/lib/prediction-log", () => ({ settlePredictionLog: async () => undefined, settlePredictionLogWinner: async () => undefined }));
vi.mock("@/lib/admin-auth", () => ({ verifyBearer: () => true }));
vi.mock("@/lib/ops-alert", () => ({ opsAlert: async () => undefined }));

beforeEach(() => {
  h.upserts = []; h.ledgerReads = 0; h.ledgerError = null;
  // servita: AWAY (perde 2-1). Sigillata prima del calcio d'inizio: HOME.
  h.unified = [{ id: "u1", external_event_id: "m1", pick: "AWAY", market: "1X2", notes: null }];
  h.ledger = [{ source_id: "m1", pick: "HOME", commence_time: "2026-11-01T15:00:00Z" }];
});
afterEach(() => { vi.unstubAllEnvs(); });

async function run() {
  const { GET } = await import("./route");
  const res = await GET(new Request("http://x/api/cron/settle", { headers: { authorization: "Bearer x" } }) as never);
  return res.json();
}
const ledgerRow = () => h.upserts.find((u) => u.table === "pick_settlement")?.payload;

it("flag spento = main: registro chiuso con l'esito SERVITO, nessuna lettura del registro", async () => {
  await run();
  expect(h.ledgerReads).toBe(0);
  expect(ledgerRow()).toMatchObject({ source_id: "m1", result: "lost", outcome: "HOME", final_score: "2-1" });
});

it("flag acceso, partita del periodo: registro chiuso sulla SIGILLATA", async () => {
  vi.stubEnv("LEDGER_SEALED_GRADING", "1");
  vi.stubEnv("LEDGER_SEALED_FROM", "2026-10-20T00:00:00Z");
  await run();
  expect(h.ledgerReads).toBe(1);
  expect(ledgerRow()).toMatchObject({ source_id: "m1", result: "won", outcome: "HOME" });
  // la riga servita resta gradata sulla sua pick
  expect(h.upserts.filter((u) => u.table === "pick_settlement")).toHaveLength(1);
});

it("flag acceso, servita sparita (pick NULL → void): la sigillata ha il suo esito", async () => {
  vi.stubEnv("LEDGER_SEALED_GRADING", "1");
  vi.stubEnv("LEDGER_SEALED_FROM", "2026-10-20T00:00:00Z");
  h.unified = [{ id: "u1", external_event_id: "m1", pick: null, market: "1X2", notes: null }];
  await run();
  expect(ledgerRow()).toMatchObject({ result: "won" });
});

it("flag acceso, partita PRIMA della data: esito servito", async () => {
  vi.stubEnv("LEDGER_SEALED_GRADING", "1");
  vi.stubEnv("LEDGER_SEALED_FROM", "2026-12-01T00:00:00Z");
  await run();
  expect(ledgerRow()).toMatchObject({ result: "lost" });
});

it("flag acceso, registro illeggibile: non chiude NIENTE (si riprova al giro dopo)", async () => {
  vi.stubEnv("LEDGER_SEALED_GRADING", "1");
  vi.stubEnv("LEDGER_SEALED_FROM", "2026-10-20T00:00:00Z");
  h.ledgerError = { message: "down" };
  const report = await run();
  expect(ledgerRow()).toBeUndefined();
  expect(report.unified_football_settled).toBe(0);
  expect(report.errors.join(" ")).toMatch(/unified_football/);
});
