import { afterEach, beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  unified: [] as Array<Record<string, unknown>>,
  ledger: [] as Array<Record<string, unknown>>,
  ledgerError: null as null | { message: string },
  upserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  ledgerReads: 0,
  tennis: [] as Array<Record<string, unknown>>,
  winners: [] as Array<Record<string, unknown>>,
  tennisError: null as null | Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  lookupBatches: [] as string[][],
  winnerLookupFailureAt: null as number | null,
  shadowSettlement: vi.fn().mockResolvedValue(undefined),
}));

function fakeSb() {
  const from = (table: string) => {
    const st = { op: "select", sel: "", ids: [] as string[] };
    const b: Record<string, unknown> = new Proxy({}, {
      get(_t, prop) {
        if (prop === "in") return (_column:string,ids:string[]) => { st.ids=ids; if(table==='tennis_predictions') h.lookupBatches.push(ids); return b; };
        if (prop === "select") return (s: string) => { st.sel = s; return b; };
        if (prop === "update") return (p: Record<string, unknown>) => { st.op = "update"; h.updates.push(p); return b; };
        if (prop === "upsert") return (p: Record<string, unknown>) => { st.op = "upsert"; h.upserts.push({ table, payload: p }); return b; };
        if (prop === "then") {
          return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
            let data: unknown = [];
            let error: unknown = null;
            if (st.op === "select" && table === "unified_predictions" && st.sel.includes("pick, market")) data = h.unified;
            if (st.op === "select" && table === "pick_ledger") { h.ledgerReads += 1; data = h.ledger; error = h.ledgerError; }
            if (st.op === "select" && table === "unified_predictions" && st.sel === "id, source_id, pick, home_team, away_team") { data = h.tennis; error=h.tennisError; }
            if (st.op === "select" && table === "tennis_predictions") {
              data=h.winners.filter(w=>st.ids.includes(String(w.match_id)));
              const batchNumber=h.lookupBatches.indexOf(st.ids)+1;
              if (batchNumber===h.winnerLookupFailureAt) {
                data=null;
                error={code:'57014',message:'winner lookup cancelled',details:'middle batch failed',hint:'retry lookup'};
              }
            }
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
  fetchAllTodayMatches: async () => [],
}));
vi.mock("@/lib/summer-leagues", () => ({ SUMMER_LEAGUES: {}, fetchSummerResults: async () => [] }));
vi.mock("@/lib/espn-results", () => ({
  ESPN_SLUG_BY_FD_LEAGUE: {}, abbinaFinale: () => null, abbinaFinaleCerto: () => null,
  espnSlugForLeague: () => null, fetchEspnFinalsByDate: async () => [], pianoRecuperoEspn: () => [],
  yyyymmddUtc: () => "20261101",
}));
vi.mock("@/lib/espn", () => ({ ESPN_RECOVERY_DAYS: 7 }));
vi.mock("@/lib/prediction-log", () => ({ settlePredictionLog: async () => undefined, settlePredictionLogWinner: h.shadowSettlement }));
vi.mock("@/lib/admin-auth", () => ({ verifyBearer: () => true }));
vi.mock("@/lib/ops-alert", () => ({ opsAlert: async () => undefined }));

beforeEach(() => {
  h.updates=[];h.lookupBatches=[];h.tennisError=null;
  h.winnerLookupFailureAt=null;h.shadowSettlement.mockClear();
  h.tennis=[{id:'t1',source_id:'match1',pick:'A',home_team:'A',away_team:'B'}];
  h.winners=[{match_id:'match1',winner:'B'}];
});
afterEach(() => vi.unstubAllEnvs());
async function run() {
  const { GET }=await import('./route');
  return (await GET(new Request('http://x/api/cron/settle') as never)).json();
}
it('leaves an unknown winner unresolved rather than publishing a verified loss',async()=>{
  h.winners=[{match_id:'match1',winner:'C'}];
  const report=await run();
  expect(h.updates).toEqual([]);
  expect(report.unified_tennis_settled).toBe(0);
  expect(report.errors.join(' ')).toContain('winner_mismatch');
});
it('still settles a known opponent win and a no-pick void',async()=>{
  await run();expect(h.updates[0]).toMatchObject({result:'lost',verification_state:'verified'});
  h.updates=[];h.tennis[0].pick=null;
  await run();expect(h.updates[0]).toMatchObject({result:'void'});
});
it('preserves Supabase code, message, details and hint in diagnostics',async()=>{
  h.tennisError={code:'42703',message:'column missing',details:'missing field',hint:'refresh schema'};
  const report=await run();
  for(const value of Object.values(h.tennisError)) expect(report.errors.join(' ')).toContain(value);
  expect(report.errors.join(' ')).not.toContain('[object Object]');
});

it('reads 500 long source IDs in batches of at most 50 and settles every match',async()=>{
  h.tennis=Array.from({length:500},(_,i)=>({id:`u${i}`,source_id:`provider:${'x'.repeat(70)}:${i}`,pick:'A',home_team:'A',away_team:'B'}));
  h.winners=h.tennis.map(r=>({match_id:r.source_id,winner:'B'}));
  const report=await run();
  expect(h.lookupBatches).toHaveLength(10);
  expect(h.lookupBatches.every(ids=>ids.length<=50)).toBe(true);
  expect(new Set(h.lookupBatches.flat()).size).toBe(500);
  expect(report.unified_tennis_settled).toBe(500);
});

it('aborts all tennis and shadow settlements when a middle winner batch fails',async()=>{
  h.tennis=Array.from({length:500},(_,i)=>({id:`u${i}`,source_id:`provider:${'x'.repeat(70)}:${i}`,pick:'A',home_team:'A',away_team:'B'}));
  h.winners=h.tennis.map(r=>({match_id:r.source_id,winner:'B'}));
  h.winnerLookupFailureAt=5;

  const report=await run();

  expect(h.lookupBatches).toHaveLength(5);
  expect(h.lookupBatches.every(ids=>ids.length===50)).toBe(true);
  expect(h.updates).toEqual([]);
  expect(h.shadowSettlement).not.toHaveBeenCalled();
  expect(report.unified_tennis_settled).toBe(0);
  expect(report.errors).toContainEqual(expect.stringContaining('57014'));
  expect(report.errors).toContainEqual(expect.stringContaining('winner lookup cancelled'));
  expect(report.errors.join(' ')).not.toContain('[object Object]');
});
