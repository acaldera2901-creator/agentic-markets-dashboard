// #COERENZA-1001 (a) — la copertura dichiarata ha come denominatore TUTTE le
// pick mostrate e finite: anche quelle senza esito (unresolved, NULL) e quelle
// non verificate. Prima `unresolved` restava fuori dalla query e la pagina
// diceva «98,4% verificate» con ~2.300 partite mostrate e mai chiuse.
import { it, expect, vi, beforeEach } from "vitest";
import { TRACK_RECORD_BASE_CONDITIONS } from "@/lib/track-record";

const { dbQuery } = vi.hoisted(() => ({ dbQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery }));
vi.mock("@/lib/auth", () => ({ resolveAccessState: async () => ({ state: "anonymous" }) }));

beforeEach(() => { vi.clearAllMocks(); });

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
