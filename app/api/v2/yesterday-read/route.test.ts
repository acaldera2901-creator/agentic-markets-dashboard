// #HOOK-A-LITE-0928 — la route serve il pick e il perché SENZA sessione: è
// l'eccezione dichiarata alla policy «anonimo non sblocca», limitata a una
// riga settlata per sport. Il test la fissa come contratto esplicito, così un
// cambio di idea passa da qui e non da un effetto collaterale.
import { it, expect, vi, beforeEach, afterEach } from "vitest";

const dbQuery = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T09:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); });

function row(over: Record<string, unknown> = {}) {
  return {
    id: "f1", sport: "football", competition: "Serie A", league: "SA",
    home_team: "Inter", away_team: "Milan", market: "1X2", pick: "HOME",
    confidence_score: 58, fair_odds: 1.72, odds: 2.05, edge_percent: 2.1,
    explanation: "Inter lead the league in xG at home.", result: "lost",
    starts_at: "2026-09-27T18:45:00Z", settled_at: "2026-09-27T20:40:00Z",
    notes: JSON.stringify({ final_score: "1-2" }), verification_state: "verified",
    ...over,
  };
}

it("serve pick, probabilità, perché ed esito senza alcuna sessione (nessun cookie)", async () => {
  dbQuery.mockResolvedValueOnce([row()]);
  const { GET } = await import("./route");
  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.day).toBe("2026-09-27");
  expect(body.reads).toHaveLength(1);
  const r = body.reads[0];
  expect(r.pick).toBe("HOME");
  expect(r.explanation).toMatch(/xG/);
  expect(r.model_pct).toBe(58);
  expect(r.result).toBe("lost");
  expect(r.final_score).toBe("1-2");
  expect(r.locked).toBeUndefined();
  // Cacheable per tutti: la risposta non dipende dalla sessione.
  expect(res.headers.get("cache-control")).toMatch(/public/);
  expect(res.headers.get("vary") ?? "").not.toMatch(/cookie/i);
});

it("la finestra SQL è [oggi−7, oggi) e passa dai cancelli del track record", async () => {
  dbQuery.mockResolvedValueOnce([]);
  const { GET } = await import("./route");
  const body = await (await GET()).json();
  expect(body.reads).toEqual([]);
  const [sql, params] = dbQuery.mock.calls[0];
  expect(params).toEqual(["2026-09-21T00:00:00Z", "2026-09-28T00:00:00Z", 600]);
  expect(sql).toMatch(/verification_state = 'verified'/);
  expect(sql).toMatch(/published_at IS NOT NULL/);
  expect(sql).toMatch(/is_demo = FALSE/);
  expect(sql).toMatch(/result IN \('won', 'lost', 'void'\)/);
});
