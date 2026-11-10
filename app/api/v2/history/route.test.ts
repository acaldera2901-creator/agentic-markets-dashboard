// #COERENZA-1001 (a) — la copertura dichiarata ha come denominatore TUTTE le
// pick mostrate e finite: anche quelle senza esito (unresolved, NULL) e quelle
// non verificate. Prima `unresolved` restava fuori dalla query e la pagina
// diceva «98,4% verificate» con ~2.300 partite mostrate e mai chiuse.
import { it, expect, vi, beforeEach } from "vitest";
import { TRACK_RECORD_BASE_CONDITIONS } from "@/lib/track-record";

const { dbQuery, access } = vi.hoisted(() => ({ dbQuery: vi.fn(), access: vi.fn() }));
vi.mock("next/cache", async () => ({
  unstable_cache: (await import("@/tests/helpers/next-data-cache")).mockUnstableCache,
}));
vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict: dbQuery }));
vi.mock("@/lib/auth", () => ({ resolveAccessState: access }));

beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); access.mockResolvedValue({state:"anonymous"}); });

function row(over: Record<string, unknown>) {
  return {
    sport: "football", competition: "Serie A", market: "1X2", pick: "HOME",
    home_team: "Inter", away_team: "Milan", starts_at: "2026-09-20T18:45:00Z",
    settled_at: "2026-09-20T21:00:00Z", published_at: "2026-09-19T08:00:00Z",
    result: "won", verification_state: "verified", notes: null, is_paper: false,
    is_verified: false, is_demo: false, confidence_score: 60,
    ...over,
  };
}

const FIXTURE = [
  row({ id: "won" }),
  row({ id: "won-twin", published_at: "2026-09-19T12:00:00Z" }),
  row({ id: "lost", home_team: "Roma", away_team: "Lazio", result: "lost" }),
  row({ id: "unresolved", home_team: "Napoli", away_team: "Genoa", result: "unresolved", verification_state: null }),
  row({ id: "null", home_team: "Torino", away_team: "Bologna", result: null, verification_state: null }),
  row({ id: "unverified", home_team: "Atalanta", away_team: "Como", verification_state: "unverified" }),
];

it("copertura = verificate / tutte le mostrate e finite, con ogni esclusione dichiarata", async () => {
  dbQuery.mockResolvedValueOnce(FIXTURE);
  const { GET } = await import("./route");
  const { stats } = await (await GET(new Request("http://x/api/v2/history"))).json();
  expect(stats.total).toBe(2);
  expect(stats.surfaced_total).toBe(5);
  expect(stats.coverage).toBe(0.4);
  expect(stats.unresolved_excluded).toBe(2);
  expect(stats.unverified_excluded).toBe(1);
  expect(stats.dedup_dropped).toBe(1);
  expect(stats.dedup_dropped_decided).toBe(1);
  expect(stats.post_cutover_excluded.n).toBe(0);
  // La somma torna: nessuna riga sparisce senza essere dichiarata.
  expect(stats.total + stats.post_cutover_excluded.n + stats.unverified_excluded + stats.unresolved_excluded)
    .toBe(stats.surfaced_total);
});

it("la query non esclude più le righe senza esito: le conta il denominatore", async () => {
  dbQuery.mockResolvedValueOnce([]);
  const { GET } = await import("./route");
  await GET(new Request("http://x/api/v2/history"));
  const [sql] = dbQuery.mock.calls[0];
  for (const c of TRACK_RECORD_BASE_CONDITIONS) expect(sql).toContain(c);
  expect(sql).not.toMatch(/unresolved/);
});

it("reuses raw history across requests without reusing access-projected responses", async () => {
 dbQuery.mockResolvedValue(FIXTURE);
 const {GET}=await import("./route");
 access.mockResolvedValueOnce({state:"premium"});
 const paid=await GET(new Request("http://x/api/v2/history?aggregate=segments"));
 expect((await paid.json()).history[0].locked).toBe(false);
 const anonymous=await GET(new Request("http://x/api/v2/history?limit=300"));
 const body=await anonymous.json();
 expect(body.history[0].locked).toBe(true);
 expect(body.history[0]).not.toHaveProperty("pick");
 expect(dbQuery).toHaveBeenCalledTimes(1);
 expect(access).toHaveBeenCalledTimes(2);
 expect(anonymous.headers.get("Cache-Control")).toBe("private, no-store");
});

it("declares a capped population instead of silently presenting it as complete", async () => {
  dbQuery.mockResolvedValueOnce([...Array.from({length: 15000}, (_, i) => row({id: `row-${i}`})), row({id: "sentinel", home_team: "Outside cap"})]);
  const {GET} = await import("./route");
  const {stats} = await (await GET(new Request("http://x/api/v2/history"))).json();
  expect(stats.truncated).toBe(true);
  expect(stats.population_limit).toBe(15000);
  expect(stats.total).toBe(1);
  expect(dbQuery.mock.calls[0][0]).toContain("LIMIT 15001");
});
