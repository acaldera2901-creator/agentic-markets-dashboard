import assert from "node:assert/strict";
import { test } from "node:test";
import { bySegment, weeklyHit, dailyHit, filterConcluded } from "../lib/track-record-history";

type Row = { sport: string; competition: string; result: string | null; starts_at: string };

const rows: Row[] = [
  { sport: "football", competition: "World Cup", result: "won", starts_at: "2026-06-09T12:00:00Z" },
  { sport: "football", competition: "World Cup", result: "lost", starts_at: "2026-06-09T15:00:00Z" },
  { sport: "tennis", competition: "ATP", result: "won", starts_at: "2026-06-08T12:00:00Z" },
  { sport: "tennis", competition: "ATP", result: null, starts_at: "2026-06-20T12:00:00Z" }, // pending → escluso
];

test("filterConcluded esclude result null (pending)", () => {
  assert.equal(filterConcluded(rows).length, 3);
});

test("bySegment calcola hit-rate e campione per segmento", () => {
  const seg = bySegment(rows);
  const wc = seg.find((s) => s.key === "football/World Cup")!;
  assert.equal(wc.decided, 2);
  assert.equal(wc.won, 1);
  assert.equal(wc.hitRate, 0.5);
});

test("weeklyHit raggruppa per settimana ISO e ignora i pending", () => {
  const weeks = weeklyHit(rows);
  const total = weeks.reduce((a, w) => a + w.decided, 0);
  assert.equal(total, 3); // 3 decise (08-09 giu stessa settimana ISO)
});

test("dailyHit raggruppa per giorno UTC, calcola hit-rate e ignora i pending", () => {
  const days = dailyHit(rows);
  // 2 giorni distinti con pick concluse: 08 giu (1) e 09 giu (2); il pending del 20 escluso.
  assert.equal(days.length, 2);
  const d9 = days.find((d) => d.date === "2026-06-09")!;
  assert.equal(d9.decided, 2);
  assert.equal(d9.won, 1);
  assert.equal(d9.hitRate, 0.5);
  // ordinati cronologicamente
  assert.deepEqual(days.map((d) => d.date), ["2026-06-08", "2026-06-09"]);
});
