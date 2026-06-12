import assert from "node:assert/strict";
import { test } from "node:test";
import { bySegment, weeklyHit, filterConcluded } from "../lib/track-record-history";

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
