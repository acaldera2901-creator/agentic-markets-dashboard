// #QUOTA-NEXTDAY-0929 — la quota (Free 3, Base 7 per sport) si conta sulla
// prossima giornata con partite quando oggi non ne bastano. Caso reale del
// 29/09/2026: sosta nazionali, zero partite di calcio oggi, 59+ sul board — il
// Base vedeva 0 prediction invece di 7.
import { describe, it, expect } from "vitest";
import {
  showcaseRanking,
  showcaseDailyRanking,
  showcaseAllowance,
  isUnlocked,
  type ShowcaseCandidate,
} from "./access-projection";

const OGGI = "2026-09-29";
const c = (id: string, conf: number, startsAt: string, surfaced = true): ShowcaseCandidate =>
  ({ id, surfaced, conf, edge: 0.01, startsAt });

const unlockedIds = (rows: ShowcaseCandidate[], rank: Map<string, number>, plan: "free" | "base") =>
  rows.filter((r) => isUnlocked(plan, rank.get(r.id)!)).map((r) => r.id);

describe("giorni normali: nessuna differenza da showcaseRanking", () => {
  // Oggi 8 partite: la quota Base (7) e Free (3) è piena su oggi.
  const board: ShowcaseCandidate[] = [
    ...Array.from({ length: 8 }, (_, i) => c(`oggi-${i}`, 0.5 + i / 100, `2026-09-29T${10 + i}:00:00Z`, i % 2 === 0)),
    c("domani-forte", 0.99, "2026-09-30T18:00:00Z"),
    c("dopodomani", 0.9, "2026-10-01T18:00:00Z"),
  ];

  for (const plan of ["free", "base", "premium", "anonymous"] as const) {
    it(`rank identico per ${plan}`, () => {
      const before = showcaseRanking(board, { scopeDay: OGGI });
      const { rank, fill } = showcaseDailyRanking(board, OGGI, showcaseAllowance(plan));
      expect(fill).toBeNull();
      expect([...rank.entries()]).toEqual([...before.entries()]);
    });
  }

  it("quota esattamente piena (3 oggi, Free): nessun prestito", () => {
    const rows = [c("a", 0.6, "2026-09-29T18:00:00Z"), c("b", 0.5, "2026-09-29T19:00:00Z"),
      c("c", 0.4, "2026-09-29T20:00:00Z"), c("domani", 0.99, "2026-09-30T18:00:00Z")];
    const { rank, fill } = showcaseDailyRanking(rows, OGGI, 3);
    expect(fill).toBeNull();
    expect(rank.get("domani")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("sosta: la quota si completa con le giornate successive", () => {
  // Zero partite oggi; board con 3 giornate future.
  const board: ShowcaseCandidate[] = [
    c("sab-1", 0.55, "2026-10-03T13:00:00Z", false),
    c("sab-2", 0.70, "2026-10-03T16:00:00Z"),
    c("sab-3", 0.62, "2026-10-03T18:45:00Z"),
    c("dom-1", 0.95, "2026-10-04T15:00:00Z"),
    c("dom-2", 0.60, "2026-10-04T18:00:00Z"),
    c("dom-3", 0.58, "2026-10-04T20:45:00Z"),
    c("lun-1", 0.99, "2026-10-05T18:00:00Z"),
    c("lun-2", 0.51, "2026-10-05T20:00:00Z"),
    c("ieri", 0.99, "2026-09-28T20:00:00Z"),
  ];

  it("Base vede 7 righe: prima tutta la giornata più vicina, poi la successiva", () => {
    const { rank, fill } = showcaseDailyRanking(board, OGGI, showcaseAllowance("base"));
    expect(unlockedIds(board, rank, "base").sort()).toEqual(
      ["sab-1", "sab-2", "sab-3", "dom-1", "dom-2", "dom-3", "lun-1"].sort()
    );
    // Dentro il giorno, l'ordine di sempre (pick prima, poi confidenza).
    expect(rank.get("sab-2")).toBe(0);
    expect(rank.get("sab-3")).toBe(1);
    expect(rank.get("sab-1")).toBe(2);
    expect(rank.get("dom-1")).toBe(3);
    // La giornata più vicina vince sulla confidenza: lun-1 (0.99) arriva per ultima.
    expect(rank.get("lun-1")).toBe(6);
    expect(rank.get("lun-2")).toBe(Number.POSITIVE_INFINITY);
    expect(fill).toEqual({ today: 0, borrowed: expect.any(Set), resumesOn: "2026-10-03", resumesAt: expect.any(String) });
    expect(fill!.borrowed.size).toBe(7);
  });

  it("Free vede 3 righe, tutte della prima giornata", () => {
    const { rank } = showcaseDailyRanking(board, OGGI, showcaseAllowance("free"));
    expect(unlockedIds(board, rank, "free").sort()).toEqual(["sab-1", "sab-2", "sab-3"]);
  });

  it("le righe di giorni passati non entrano mai", () => {
    const { rank } = showcaseDailyRanking(board, OGGI, 100);
    expect(rank.get("ieri")).toBe(Number.POSITIVE_INFINITY);
  });

  it("Pro e anonimo: nessun prestito (il Pro apre già tutto, l'anonimo niente)", () => {
    expect(showcaseDailyRanking(board, OGGI, showcaseAllowance("premium")).fill).toBeNull();
    const anon = showcaseDailyRanking(board, OGGI, showcaseAllowance("anonymous"));
    expect(anon.fill).toBeNull();
    expect(board.some((r) => isUnlocked("anonymous", anon.rank.get(r.id)!))).toBe(false);
  });
});

describe("giornata corta: oggi meno partite della quota", () => {
  it("le partite di oggi restano davanti, il resto viene dal giorno dopo", () => {
    const rows = [
      c("oggi-1", 0.40, "2026-09-29T18:00:00Z", false),
      c("oggi-2", 0.50, "2026-09-29T20:00:00Z", false),
      c("domani-1", 0.90, "2026-09-30T18:00:00Z"),
      c("domani-2", 0.80, "2026-09-30T20:00:00Z"),
    ];
    const { rank, fill } = showcaseDailyRanking(rows, OGGI, 3);
    expect(rank.get("oggi-2")).toBe(0);
    expect(rank.get("oggi-1")).toBe(1);
    expect(rank.get("domani-1")).toBe(2);
    expect(rank.get("domani-2")).toBe(Number.POSITIVE_INFINITY);
    expect(fill).toMatchObject({ today: 2, resumesOn: "2026-09-30" });
    expect([...fill!.borrowed]).toEqual(["domani-1"]);
  });
});

describe("board con meno righe della quota", () => {
  it("mostra quello che c'è, senza rompersi", () => {
    const rows = [c("sab", 0.6, "2026-10-03T18:00:00Z"), c("dom", 0.7, "2026-10-04T18:00:00Z")];
    const { rank, fill } = showcaseDailyRanking(rows, OGGI, 7);
    expect(unlockedIds(rows, rank, "base")).toEqual(["sab", "dom"]);
    expect(fill!.borrowed.size).toBe(2);
  });

  it("board vuoto o senza righe future: nessun prestito, nessun banner", () => {
    expect(showcaseDailyRanking([], OGGI, 7)).toEqual({ rank: new Map(), fill: null });
    const onlyPast = [c("ieri", 0.6, "2026-09-28T18:00:00Z")];
    expect(showcaseDailyRanking(onlyPast, OGGI, 7).fill).toBeNull();
  });

  it("date illeggibili non vengono prese in prestito", () => {
    const rows: ShowcaseCandidate[] = [
      { id: "senza-data", surfaced: true, conf: 0.99, edge: 0.1 },
      { id: "rotta", surfaced: true, conf: 0.99, edge: 0.1, startsAt: "boh" },
      c("sab", 0.5, "2026-10-03T18:00:00Z"),
    ];
    const { rank } = showcaseDailyRanking(rows, OGGI, 7);
    expect(rank.get("senza-data")).toBe(Number.POSITIVE_INFINITY);
    expect(rank.get("rotta")).toBe(Number.POSITIVE_INFINITY);
    expect(rank.get("sab")).toBe(0);
  });

  it("non muta l'input", () => {
    const rows = [c("b", 0.5, "2026-10-04T18:00:00Z"), c("a", 0.6, "2026-10-03T18:00:00Z")];
    showcaseDailyRanking(rows, OGGI, 7);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

// #QUOTA-TZ-FIX-0929 — Andrea, 29/09, prod: banner «resumes Wednesday 30
// September», prima card «Thu 1 Oct, 01:30». La partita (NY Red Bulls–St. Louis)
// è alle 23:30Z del 30/09: il giorno UTC è il 30, a Roma è già il 1° ottobre.
// Il server deve consegnare l'ISTANTE, non solo il giorno UTC.
describe("resumesAt: il calcio d'inizio più vicino fra le righe prese in prestito", () => {
  it("è l'istante più vicino, non quello della riga col rank più alto", () => {
    const rows = [
      c("rbny", 0.40, "2026-09-30T23:30:00Z"),
      c("gio-1", 0.90, "2026-10-01T18:00:00Z"),
      c("ven-1", 0.80, "2026-10-02T19:00:00Z"),
    ];
    const { fill } = showcaseDailyRanking(rows, OGGI, 7);
    expect(fill).toMatchObject({ today: 0, resumesOn: "2026-09-30", resumesAt: "2026-09-30T23:30:00.000Z" });
  });
  it("dentro la stessa giornata vince l'orario, non la confidenza", () => {
    const rows = [c("tardi", 0.99, "2026-09-30T21:00:00Z"), c("presto", 0.10, "2026-09-30T15:00:00Z")];
    expect(showcaseDailyRanking(rows, OGGI, 1).fill!.resumesAt).toBe("2026-09-30T21:00:00.000Z");
    expect(showcaseDailyRanking(rows, OGGI, 2).fill!.resumesAt).toBe("2026-09-30T15:00:00.000Z");
  });
});
