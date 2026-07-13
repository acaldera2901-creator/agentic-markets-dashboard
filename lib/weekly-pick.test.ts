import { describe, it, expect, afterEach } from "vitest";
import {
  appendWeeklyLegs,
  currentWeekStart,
  buildHouseMultipla,
  weeklyPickIncludedInPlan,
  weeklyPickAmount,
  resolveWeeklyPickOutcomes,
  weeklyBrief,
  WEEKLY_PICK_MAX_LEGS,
  WEEKLY_PICK_PRICE_USD,
  type WeeklyPickLeg,
} from "./weekly-pick";
import { evaluateCallback } from "./paygate";

describe("currentWeekStart", () => {
  it("returns the Monday (UTC) for a mid-week date", () => {
    // 2026-07-08 è mercoledì → lunedì della settimana = 2026-07-06
    expect(currentWeekStart(new Date("2026-07-08T15:00:00Z"))).toBe("2026-07-06");
  });
  it("returns the same day when it is already Monday", () => {
    expect(currentWeekStart(new Date("2026-07-06T00:00:00Z"))).toBe("2026-07-06");
  });
  it("maps Sunday to the Monday that started its week", () => {
    // 2026-07-12 è domenica → lunedì = 2026-07-06
    expect(currentWeekStart(new Date("2026-07-12T23:59:00Z"))).toBe("2026-07-06");
  });
});

describe("buildHouseMultipla", () => {
  const legs: WeeklyPickLeg[] = [
    { id: "a", label: "A vs B", market: "A", sport: "football", prob: 0.7 },
    { id: "b", label: "C vs D", market: "C", sport: "tennis", prob: 0.6 },
    { id: "c", label: "E vs F", market: "E", sport: "football", prob: 0.55 },
  ];

  it("picks the highest-prob legs and multiplies the probabilities", () => {
    const r = buildHouseMultipla(legs, 2)!;
    expect(r.selections.map((s) => s.id)).toEqual(["a", "b"]);
    expect(r.combinedProb).toBeCloseTo(0.42, 5); // 0.7 * 0.6
  });

  it("caps at maxLegs but takes all when fewer are available", () => {
    expect(buildHouseMultipla(legs, WEEKLY_PICK_MAX_LEGS)!.selections.length).toBe(3);
    expect(buildHouseMultipla(legs, 2)!.selections.length).toBe(2);
  });

  it("returns null with fewer than 2 valid legs", () => {
    expect(buildHouseMultipla([legs[0]])).toBeNull();
    expect(
      buildHouseMultipla([
        { ...legs[0], prob: 0 },
        { ...legs[1], prob: 1.4 },
      ])
    ).toBeNull();
  });

  it("is deterministic on ties (stable by id)", () => {
    const tied: WeeklyPickLeg[] = [
      { id: "z", label: "Z", market: "Z", sport: "s", prob: 0.5 },
      { id: "a", label: "A", market: "A", sport: "s", prob: 0.5 },
    ];
    expect(buildHouseMultipla(tied, 1)!.selections.map((s) => s.id)).toEqual(["a", "z"]);
  });
});

describe("buildHouseMultipla — distribuzione settimanale (#WEEKLY-PICK-4)", () => {
  const day = (d: string, hh = "12") => `2026-07-${d}T${hh}:00:00Z`;
  const mk = (id: string, prob: number, startsAt: string | null): WeeklyPickLeg => ({
    id, label: `${id} vs X`, market: id, sport: "tennis", prob, startsAt,
  });

  it("max 1 leg per giorno: per ogni giorno vince la prob più alta", () => {
    const out = buildHouseMultipla(
      [
        mk("mon-lo", 0.9, day("13")), // stesso giorno di mon-hi... prob più bassa? no: 0.9
        mk("mon-hi", 0.95, day("13", "18")),
        mk("wed", 0.6, day("15")),
        mk("fri", 0.55, day("17")),
      ],
      3
    )!;
    const ids = out.selections.map((s) => s.id);
    expect(ids).toEqual(["mon-hi", "wed", "fri"]); // 1 per giorno, cronologiche
    expect(ids).not.toContain("mon-lo"); // secondo dello stesso giorno escluso
  });

  it("riempe dal pool residuo quando i giorni distinti non bastano", () => {
    const out = buildHouseMultipla(
      [mk("a", 0.9, day("13")), mk("b", 0.8, day("13")), mk("c", 0.7, day("13"))],
      3
    )!;
    expect(out.selections.length).toBe(3); // 1 day-winner + 2 riserve
  });

  it("legacy: senza startsAt il comportamento resta top-prob", () => {
    const out = buildHouseMultipla(
      [mk("a", 0.5, null), mk("b", 0.9, null), mk("c", 0.7, null)],
      2
    )!;
    expect(out.selections.map((s) => s.id).sort()).toEqual(["b", "c"]);
  });

  it("selections in ordine cronologico (senza data in coda)", () => {
    const out = buildHouseMultipla(
      [mk("late", 0.9, day("18")), mk("early", 0.6, day("14")), mk("nodate", 0.99, null)],
      3
    )!;
    expect(out.selections.map((s) => s.id)).toEqual(["early", "late", "nodate"]);
  });
});

describe("appendWeeklyLegs — crescita progressiva (#WEEKLY-PICK-4)", () => {
  const day = (d: string, hh = "12") => `2026-07-${d}T${hh}:00:00Z`;
  const mk = (id: string, prob: number, startsAt: string | null): WeeklyPickLeg => ({
    id, label: `${id} vs X`, market: id, sport: "tennis", prob, startsAt,
  });

  it("appende solo giorni NUOVI, congela le esistenti, ordina cronologicamente", () => {
    const existing = [mk("mon", 0.7, day("13"))];
    const out = appendWeeklyLegs(existing, [
      mk("mon2", 0.99, day("13")),
      mk("tue", 0.6, day("14")),
      mk("wed", 0.65, day("15")),
    ], 5)!;
    expect(out.selections.map((s) => s.id)).toEqual(["mon", "tue", "wed"]);
  });

  it("non supera maxLegs e non duplica id", () => {
    const existing = [mk("a", 0.7, day("13")), mk("b", 0.6, day("14"))];
    const out = appendWeeklyLegs(existing, [
      mk("a", 0.9, day("16")),
      mk("c", 0.8, day("15")),
      mk("d", 0.75, day("16")),
      mk("e", 0.7, day("17")),
    ], 3)!;
    expect(out.selections.length).toBe(3);
    expect(out.selections.map((s) => s.id)).toContain("c");
  });

  it("ritorna null se nulla da aggiungere o schedina piena", () => {
    const existing = [mk("a", 0.7, day("13")), mk("b", 0.6, day("14"))];
    expect(appendWeeklyLegs(existing, [mk("x", 0.9, day("13"))], 5)).toBeNull();
    expect(appendWeeklyLegs(existing, [mk("y", 0.9, day("15"))], 2)).toBeNull();
  });
});

describe("weeklyPickIncludedInPlan", () => {
  it("is included for Pro/admin, sold to the rest", () => {
    expect(weeklyPickIncludedInPlan("premium")).toBe(true);
    expect(weeklyPickIncludedInPlan("admin_full")).toBe(true);
    expect(weeklyPickIncludedInPlan("base")).toBe(false);
    expect(weeklyPickIncludedInPlan("free")).toBe(false);
  });
});

describe("weeklyPickAmount", () => {
  // launchPromoActive legge process.env (LAUNCH_PROMO_ENABLED + _DEADLINE).
  const saved = { ...process.env };
  afterEach(() => {
    process.env.LAUNCH_PROMO_ENABLED = saved.LAUNCH_PROMO_ENABLED;
    process.env.LAUNCH_PROMO_DEADLINE = saved.LAUNCH_PROMO_DEADLINE;
  });

  it("is the full price ($12.99) when the launch promo is off", () => {
    delete process.env.LAUNCH_PROMO_ENABLED;
    const r = weeklyPickAmount();
    expect(r.amount).toBe(WEEKLY_PICK_PRICE_USD);
    expect(r.amount).toBe(12.99);
    expect(r.discounted).toBe(false);
  });

  it("applies -50% via the SAME mechanism as plans when launch is active", () => {
    process.env.LAUNCH_PROMO_ENABLED = "true";
    process.env.LAUNCH_PROMO_DEADLINE = "2999-01-01T00:00:00Z";
    const r = weeklyPickAmount(new Date("2026-07-07T00:00:00Z"));
    // 12.99 * 0.5 = 6.495 → Math.round (come discountedAmountFor) → 6.50.
    // NB: la spec citava 6.49; il meccanismo esatto (round half-up) dà 6.50,
    // coerente coi piani (14.99→7.50). Delta 1 cent flaggato al gate.
    expect(r.discounted).toBe(true);
    expect(r.amount).toBe(6.5);
    expect(r.fullAmount).toBe(12.99);
  });

  it("stays full price when launch is enabled but the deadline has passed", () => {
    process.env.LAUNCH_PROMO_ENABLED = "true";
    process.env.LAUNCH_PROMO_DEADLINE = "2020-01-01T00:00:00Z";
    const r = weeklyPickAmount(new Date("2026-07-07T00:00:00Z"));
    expect(r.discounted).toBe(false);
    expect(r.amount).toBe(12.99);
  });
});

// Trust boundary: il grant della weekly pick NON deve avvenire senza pagamento
// confermato, né su un ordine già processato/replay. La decisione è la stessa
// funzione pura del rail piani (evaluateCallback), qui esercitata sugli importi
// della weekly pick ($12.99 pieno).
describe("weekly-pick grant gating (evaluateCallback)", () => {
  const AMOUNT = WEEKLY_PICK_PRICE_USD; // 12.99

  it("grants when the order is pending and the paid value clears the floor", () => {
    const d = evaluateCallback({ order: { status: "pending", amount_usd: AMOUNT }, valueCoin: 12.0 });
    expect(d.grant).toBe(true);
  });

  it("does NOT grant when the payment is unconfirmed (value_coin missing)", () => {
    const d = evaluateCallback({ order: { status: "pending", amount_usd: AMOUNT }, valueCoin: null });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("missing value_coin");
  });

  it("does NOT grant on a replayed/already-processed order (status != pending)", () => {
    const d = evaluateCallback({ order: { status: "paid", amount_usd: AMOUNT }, valueCoin: 12.0 });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("order not pending");
  });

  it("does NOT grant when the paid value is below the sanity floor", () => {
    const d = evaluateCallback({ order: { status: "pending", amount_usd: AMOUNT }, valueCoin: 1.0 });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("amount below threshold");
  });

  it("does NOT grant when the order is unknown (token not found)", () => {
    const d = evaluateCallback({ order: null, valueCoin: 12.0 });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("order not found");
  });
});

describe("resolveWeeklyPickOutcomes", () => {
  const legs: WeeklyPickLeg[] = [
    { id: "wp_p1", label: "A vs B", market: "A", sport: "football", prob: 0.7 },
    { id: "wp_p2", label: "C vs D", market: "C", sport: "tennis", prob: 0.6 },
    { id: "wp_p3", label: "E vs F", market: "E", sport: "football", prob: 0.55 },
  ];

  it("tutte upcoming quando non ci sono righe → outcome live, remaining = n", () => {
    const r = resolveWeeklyPickOutcomes(legs, []);
    expect(r.outcome).toBe("live");
    expect(r.remaining).toBe(3);
    expect(r.legs.every((l) => l.status === "upcoming")).toBe(true);
  });

  it("≥1 leg persa → outcome lost", () => {
    const rows = [{ id: "p1", status: "settled", result: "lost", starts_at: "2026-07-06T12:00:00Z" }];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.outcome).toBe("lost");
    expect(r.legs.find((l) => l.id === "wp_p1")!.status).toBe("lost");
  });

  it("mix won + upcoming → live, remaining conta solo le upcoming", () => {
    const rows = [{ id: "p1", status: "settled", result: "won", starts_at: "2026-07-06T12:00:00Z" }];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.outcome).toBe("live");
    expect(r.remaining).toBe(2);
  });

  it("tutte risolte a won → outcome won, remaining 0", () => {
    const rows = [
      { id: "p1", status: "settled", result: "won", starts_at: null },
      { id: "p2", status: "settled", result: "won", starts_at: null },
      { id: "p3", status: "settled", result: "won", starts_at: null },
    ];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.outcome).toBe("won");
    expect(r.remaining).toBe(0);
  });

  it("void non conta come persa: won + void, nessuna upcoming → won", () => {
    const rows = [
      { id: "p1", status: "settled", result: "won", starts_at: null },
      { id: "p2", status: "void", result: "void", starts_at: null },
      { id: "p3", status: "settled", result: "won", starts_at: null },
    ];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.outcome).toBe("won");
  });

  it("leg senza riga corrispondente resta upcoming (mai lost) e passa il kickoff quando presente", () => {
    const rows = [{ id: "p1", status: "upcoming", result: null, starts_at: "2026-07-06T12:00:00Z" }];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.legs.find((l) => l.id === "wp_p1")!.status).toBe("upcoming");
    expect(r.legs.find((l) => l.id === "wp_p1")!.kickoff).toBe("2026-07-06T12:00:00Z");
    expect(r.legs.find((l) => l.id === "wp_p2")!.status).toBe("upcoming");
    expect(r.outcome).toBe("live");
  });
});

describe("weeklyBrief", () => {
  it("strongest = prob max, medie e conteggi corretti", () => {
    const legs = [
      { label: "A vs B", sport: "football", market: "A", prob: 0.74 },
      { label: "C vs D", sport: "tennis", market: "C", prob: 0.61 },
      { label: "E vs F", sport: "football", market: "E", prob: 0.55 },
    ];
    const b = weeklyBrief(legs, 0.248, [70, 62, 58]);
    expect(b.legs).toBe(3);
    expect(b.competitions).toBe(2);
    expect(b.combinedProb).toBeCloseTo(0.248);
    expect(b.avgConfidence).toBe(63); // round((70+62+58)/3)
    expect(b.strongest).toEqual({ label: "A vs B", market: "A", prob: 0.74 });
  });

  it("teaser lockato / parziale è null-safe", () => {
    const legs = [
      { label: "A vs B", sport: "football", market: null, prob: null },
      { label: "C vs D", sport: "tennis", market: null, prob: null },
    ];
    const b = weeklyBrief(legs, null, []);
    expect(b.legs).toBe(2);
    expect(b.competitions).toBe(2);
    expect(b.combinedProb).toBeNull();
    expect(b.avgConfidence).toBeNull();
    expect(b.strongest).toBeNull();
  });

  it("tie-break stabile per label a pari prob", () => {
    const legs = [
      { label: "Zeta vs X", sport: "football", market: "Zeta", prob: 0.6 },
      { label: "Alfa vs Y", sport: "football", market: "Alfa", prob: 0.6 },
    ];
    const b = weeklyBrief(legs, null, []);
    expect(b.strongest?.label).toBe("Alfa vs Y");
  });
});
