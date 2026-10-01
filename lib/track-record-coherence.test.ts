// #COERENZA-1001 (e) — DUE SUPERFICI, UN NUMERO.
//
// /api/v2/history (l'headline del track record) e /api/v2/yesterday-read («la
// lettura di ieri» in Home) devono contare la STESSA popolazione. Qui non si
// confrontano stringhe né si controlla che importino la stessa funzione: si
// danno le stesse righe a entrambe le route e si confrontano le RISPOSTE. Se
// domani una delle due riscrive a mano il proprio cancello e diverge (NULL che
// passa, gemella non deduplicata, floor dimenticato), questo test cade.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { dbQuery } = vi.hoisted(() => ({ dbQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery }));
vi.mock("@/lib/auth", () => ({ resolveAccessState: async () => ({ state: "anonymous" }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T09:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); });

type R = Record<string, unknown>;
function row(over: R): R {
  return {
    sport: "football", competition: "Serie A", league: "SA", market: "1X2", pick: "HOME",
    home_team: "Inter", away_team: "Milan", starts_at: "2026-09-27T18:45:00Z",
    settled_at: "2026-09-27T20:45:00Z", published_at: "2026-09-26T08:00:00Z",
    result: "won", verification_state: "verified", notes: null, confidence_score: 70,
    fair_odds: 1.43, odds: 1.6, edge_percent: 2, explanation: "x",
    is_paper: false, is_verified: false, is_demo: false, is_historical: true,
    ...over,
  };
}

// Ogni scenario è UNA partita (con le sue eventuali gemelle).
const SCENARI: Record<string, R[]> = {
  "verificata, vinta": [row({ id: "ok" })],
  "verification_state NULL": [row({ id: "null", verification_state: null })],
  "gemelle con pick opposte: conta la pubblicata per prima": [
    row({ id: "first", pick: "HOME", result: "lost", confidence_score: 60 }),
    row({ id: "later", pick: "AWAY", result: "won", confidence_score: 85, published_at: "2026-09-27T10:00:00Z" }),
  ],
  "gemella vecchia senza esito, nuova verificata": [
    row({ id: "old-unres", result: "unresolved", verification_state: null }),
    row({ id: "new-ok", published_at: "2026-09-27T10:00:00Z" }),
  ],
  "nazionale post-cutover sotto il floor (persistita below_floor:false)": [
    row({ id: "unl", competition: "UEFA Nations League", league: "UNL", home_team: "Italia", away_team: "Francia",
      confidence_score: 37, notes: JSON.stringify({ surface: { below_floor: false, floor: 62 } }) }),
  ],
  "club sotto floor persistito": [row({ id: "bf", notes: JSON.stringify({ surface: { below_floor: true } }) })],
  "World Cup sotto floor persistito: conta": [
    row({ id: "wc", competition: "World Cup", league: "WC", confidence_score: 40,
      notes: JSON.stringify({ surface: { below_floor: true } }) }),
  ],
  "non verificata": [row({ id: "unv", verification_state: "unverified" })],
};

async function both(rows: R[]) {
  dbQuery.mockResolvedValue(rows);
  const history = await (await import("@/app/api/v2/history/route")).GET(new Request("http://x/api/v2/history"));
  const yesterday = await (await import("@/app/api/v2/yesterday-read/route")).GET();
  return { h: await history.json(), y: await yesterday.json() };
}

describe("history e yesterday-read contano la stessa popolazione", () => {
  for (const [nome, rows] of Object.entries(SCENARI)) {
    it(nome, async () => {
      const { h, y } = await both(rows);
      const reads = y.reads.filter((r: { sport: string }) => r.sport === "football");
      // stessa decisione: la partita conta per entrambe o per nessuna
      expect(reads.length).toBe(h.stats.total);
      if (reads.length === 1) {
        // e conta con la STESSA riga e lo stesso esito
        expect(h.history.map((x: { id: string }) => x.id)).toContain(reads[0].id);
        expect(h.stats[reads[0].result]).toBe(1);
      }
    });
  }
});

// #COERENZA-1001 — la Torre (tools/control_center/checks/history_replay.ts)
// ricalcola il numero pubblico sulle stesse righe: deve dire ESATTAMENTE quello
// che dice la route, headline e copertura comprese.
describe("il replay della Torre ripete la route", () => {
  for (const [nome, rows] of Object.entries(SCENARI)) {
    it(nome, async () => {
      const { replay } = await import("@/tools/control_center/checks/history_replay");
      const { h } = await both(rows);
      const r = replay(rows as Parameters<typeof replay>[0]);
      expect(r.headline).toEqual({ n: h.stats.n, won: h.stats.won, lost: h.stats.lost });
      expect(r.honest.coverage).toBe(h.stats.coverage);
      expect(r.honest.finished_shown).toBe(h.stats.surfaced_total);
      expect(r.dedup_dropped).toBe(h.stats.dedup_dropped);
    });
  }
  it("tutti gli scenari insieme", async () => {
    const all = Object.values(SCENARI).flat();
    const { replay } = await import("@/tools/control_center/checks/history_replay");
    const { h } = await both(all);
    const r = replay(all as Parameters<typeof replay>[0]);
    expect(r.headline).toEqual({ n: h.stats.n, won: h.stats.won, lost: h.stats.lost });
    expect(r.honest.coverage).toBe(h.stats.coverage);
  });
});
