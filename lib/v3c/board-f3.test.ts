// F3 · board nel prodotto: tennis nel contratto, «Ieri», modello di vista, copy.
// Dati fittizi, nessun DB.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyFilters,
  countdown,
  dayKey,
  emptyCascade,
  footballRows,
  leadOutcome,
  liveState,
  tennisRows,
  DEFAULT_FILTERS,
} from "./board-view";
import type { V3BoardMatch, V3BoardTennisMatch, V3BoardTennisSide } from "./contracts";
import { V3C_COPY, copyFor, copyKeys } from "./copy";
import { buildYesterday, yesterdayUtc, type SealedDayRow } from "./yesterday";

const NOW = new Date("2026-10-10T12:00:00Z");

function fb(id: string, kickoff: string, edges: [number | null, number | null, number | null], opts: Partial<V3BoardMatch> = {}): V3BoardMatch {
  const o = (outcome: "home" | "draw" | "away", e: number | null, p: number) => ({
    outcome,
    market_price: e == null ? null : 2,
    market_p: e == null ? null : p,
    model_p: p,
    estimate_p: p + (e ?? 0) / 100,
    edge_pp: e,
    book_prices: [],
    best_price: null,
  });
  return {
    id,
    sport: "football",
    league: "ITA",
    competition: "Serie A",
    kickoff,
    home: "Genoa",
    away: "Fiorentina",
    market: "1X2",
    margin_removed: edges[0] == null ? null : 0.05,
    blend: edges[0] == null ? null : { model: 0.3, market: 0.7 },
    estimate_as_of: "2026-10-10T10:00:00Z",
    sealed_at: "2026-10-09T09:02:00Z",
    focus: "home",
    outcomes: [o("home", edges[0], 0.44), o("draw", edges[1], 0.29), o("away", edges[2], 0.27)],
    ...opts,
  };
}

describe("Ieri: vinte e perse dal registro sigillato", () => {
  const base: Omit<SealedDayRow, "result" | "pick" | "confidence"> = {
    sport: "football",
    home: "Genoa",
    away: "Fiorentina",
    competition: "Serie A",
    p_home: 0.48,
    p_draw: 0.28,
    p_away: 0.24,
    commence_time: "2026-10-09T15:00:00Z",
    captured_at: "2026-10-09T09:02:00Z",
    is_paper: false,
    outcome: "HOME",
    final_score: "2-1",
  };
  it("conta interi e somma le probabilità sigillate; nessun tasso, nessun ROI", () => {
    const y = buildYesterday(
      [
        { ...base, pick: "HOME", confidence: null, result: "won" },
        { ...base, pick: "AWAY", confidence: 0.3, result: "lost" },
        { ...base, pick: null, confidence: null, result: "void" },
        { ...base, pick: "HOME", confidence: null, result: "bogus" },
      ],
      "2026-10-09",
      NOW,
    );
    expect(y.football).toMatchObject({ settled: 3, won: 1, lost: 1, other: 1, limited_sample: true });
    expect(y.football.expected_wins).toBeCloseTo(0.78, 4);
    const json = JSON.stringify(y).toLowerCase();
    for (const banned of ["hit_rate", "hitrate", "roi", "clv", "yield"]) expect(json).not.toContain(`"${banned}`);
  });
  it("il giorno UTC prima di adesso", () => {
    expect(yesterdayUtc(new Date("2026-10-10T00:30:00Z"))).toEqual({ day: "2026-10-09", from: "2026-10-09T00:00:00.000Z", to: "2026-10-10T00:00:00.000Z" });
  });
});

describe("modello di vista della board", () => {
  it("l'esito guida è il gap assoluto più ampio; senza mercato è il focus", () => {
    expect(leadOutcome(fb("a", "2026-10-10T15:00:00Z", [1, -3.2, 2])).outcome).toBe("draw");
    expect(leadOutcome(fb("b", "2026-10-10T15:00:00Z", [null, null, null], { focus: "away" })).outcome).toBe("away");
  });

  it("live = iniziata da meno di 150 minuti", () => {
    expect(liveState("2026-10-10T11:00:00Z", NOW)).toEqual({ live: true, minutes: 60 });
    expect(liveState("2026-10-10T09:00:00Z", NOW).live).toBe(false);
    expect(liveState("2026-10-10T13:00:00Z", NOW).live).toBe(false);
  });

  it("filtri: sport, giorno, campionato", () => {
    const rows = [...footballRows([fb("a", "2026-10-10T15:00:00Z", [1, 0, -1]), fb("b", "2026-10-11T15:00:00Z", [1, 0, -1], { competition: "LaLiga" })]), ...tennisRows([{ ...({} as V3BoardTennisMatch), id: "t", sport: "tennis", tournament: null, kickoff: "2026-10-10T16:00:00Z", player1: "A", player2: "B", focus: "p1", sides: [{ side: "p1", book_prices: [], best_price: null } as unknown as V3BoardTennisSide, { side: "p2", book_prices: [], best_price: null } as unknown as V3BoardTennisSide] } as V3BoardTennisMatch])];
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sport: "tennis" })).toHaveLength(1);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, day: "2026-10-11" }).map((r) => r.m.id)).toEqual(["b"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, league: "Serie A" }).map((r) => r.m.id)).toEqual(["a"]);
  });

  it("la cascata: nessuna live → gap più ampio di oggi → la prossima con il conto alla rovescia", () => {
    const rows = footballRows([fb("a", "2026-10-10T15:00:00Z", [1, 0, -1]), fb("b", "2026-10-10T18:00:00Z", [4.5, 0, -2]), fb("c", "2026-10-11T15:00:00Z", [9, 0, 0])]);
    const c = emptyCascade(rows, NOW);
    expect(c.noLive).toBe(true);
    expect(c.biggestGap?.m.id).toBe("b"); // c ha il gap più ampio ma è domani
    expect(c.next?.row.m.id).toBe("a");
    expect(countdown(c.next!.inMs, V3C_COPY.en.empty)).toBe("3 h 0 min");
    expect(countdown(2 * 86_400_000 + 3_600_000, V3C_COPY.it.empty)).toBe("2 g 1 h");
  });

  it("il giorno si legge nel fuso del visitatore", () => {
    expect(dayKey("2026-10-10T22:30:00Z")).toBe("2026-10-10");
    expect(dayKey("2026-10-10T22:30:00Z", "Europe/Rome")).toBe("2026-10-11");
  });
});

describe("copy v3c: EN fonte, IT completa, lessico del deck", () => {
  it("IT ha esattamente le chiavi di EN, e le funzioni restano funzioni", () => {
    const en = copyKeys(V3C_COPY.en as unknown as Record<string, unknown>);
    const it = copyKeys(V3C_COPY.it as unknown as Record<string, unknown>);
    expect(it).toEqual(en);
    const get = (o: unknown, k: string) => k.split(".").reduce((x: unknown, p) => (x as Record<string, unknown>)?.[p], o);
    for (const k of en) expect(typeof get(V3C_COPY.it, k)).toBe(typeof get(V3C_COPY.en, k));
  });

  it("le altre lingue ricadono sull'inglese", () => {
    expect(copyFor("es")).toBe(V3C_COPY.en);
    expect(copyFor("it")).toBe(V3C_COPY.it);
    expect(copyFor(null)).toBe(V3C_COPY.en);
  });

  it("nessun claim vietato nella copy (tip, ROI, CLV, hit rate, garantito, value bet)", () => {
    const flat = (o: unknown): string[] =>
      typeof o === "string" ? [o] : typeof o === "function" ? [String((o as (...a: unknown[]) => unknown)("X", "Y", "Z", "W", "V"))] : o && typeof o === "object" ? Object.values(o).flatMap(flat) : [];
    const text = [...flat(V3C_COPY.en), ...flat(V3C_COPY.it)].join(" \n ").toLowerCase();
    for (const banned of [" tip", "tips", " roi", "clv", "hit rate", "hit-rate", "guarantee", "garantit", "value bet", "sure bet", "lock"]) expect(text).not.toContain(banned);
    // il blend è sempre dichiarato accanto alla stima
    expect(V3C_COPY.en.board.estimateSub).toBe("70/30 blend");
    expect(V3C_COPY.en.toolbar.legendEstimate).toContain("70% market + 30% model");
  });

  it("docs/v3c-i18n-keys.md elenca tutte le chiavi da tradurre in F10", () => {
    const doc = readFileSync(join(process.cwd(), "docs/v3c-i18n-keys.md"), "utf8");
    for (const k of copyKeys()) expect(doc).toContain(`\`${k}\``);
  });
});
