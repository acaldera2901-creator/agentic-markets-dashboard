import { describe, expect, it } from "vitest";
import { auditTennisProbability, type TennisAuditSnapshot } from "./tennis-probability-audit";

const snapshot = (extra: Partial<TennisAuditSnapshot> = {}): TennisAuditSnapshot => ({
  match_id: "a", snapshot_at: "2026-09-29T09:00:00Z", kickoff: "2026-09-29T12:00:00Z",
  p1: .8, p2: .2, odds_p1: 1.3, odds_p2: 4.2, best_selection: "P1",
  feature_snapshot: { probability: { version: "tennis-probability-v1", source: "model", raw_p1: .8, raw_p2: .2 } },
  published_p1: .8, published_p2: .2, result: "P1", ...extra,
});

describe("offline tennis probability replay (synthetic contracts only)", () => {
  it("selects one latest strictly pre-kickoff snapshot, excludes duplicates and post-kickoff", () => {
    const latest = snapshot({ snapshot_at: "2026-09-29T11:00:00Z", p1: .7, p2: .3, published_p1: .7, published_p2: .3, feature_snapshot: undefined });
    const r = auditTennisProbability([snapshot(), latest, { ...latest }, snapshot({ snapshot_at: "2026-09-29T12:00:00Z" }), snapshot({ snapshot_at: "2026-09-29T13:00:00Z" })]);
    expect(r.counts).toMatchObject({ input: 5, eligible: 1, excluded: 4, answered: 1, unknown: 1 });
    expect(r.exclusions).toMatchObject({ not_pre_kickoff: 2, superseded_or_duplicate: 2 });
    expect(r.by_source.unknown.before!.brier).toBeCloseTo(.09);
  });
  it("rejects invalid timestamps, impossible pairs, and conflicting latest ties", () => {
    const r = auditTennisProbability([
      snapshot({ match_id: "bad-date", snapshot_at: "not-a-date" }),
      snapshot({ match_id: "no-zone", snapshot_at: "2026-09-29T09:00:00" }),
      snapshot({ match_id: "bad-pair", p1: 2 }),
      snapshot(), snapshot({ p1: .6, p2: .4 }),
    ]);
    expect(r.counts).toMatchObject({ eligible: 0, excluded: 5 });
    expect(r.exclusions).toMatchObject({ invalid_timestamp: 2, invalid_probability: 1, ambiguous_tie: 2 });
  });
  it("missing/invalid baselines cannot fabricate changed counts or before/after metrics", () => {
    const r = auditTennisProbability([
      snapshot({ published_p1: undefined, published_p2: undefined }),
      snapshot({ match_id: "b", published_p1: 2 }),
    ]);
    expect(r.counts).toMatchObject({ eligible: 2, answered: 2, missing_baseline: 2 });
    expect(r.changes).toEqual({ compared: 0, changed: 0, mean_delta_p1: null, mean_absolute_delta_p1: null });
    expect(r.by_source.model).toMatchObject({ eligible: 2, answered: 2, paired: 0, before: null, after: null });
  });
  it("compares identical settled rows by source; calculates binary Brier/logloss and bins", () => {
    const r = auditTennisProbability([
      snapshot(),
      snapshot({ match_id: "b", p1: .4, p2: .6, published_p1: .5, published_p2: .5, result: "P2", feature_snapshot: { probability: { version: "tennis-probability-v1", source: "model", raw_p1: .4, raw_p2: .6 } } }),
      snapshot({ match_id: "invalid-outcome", result: "VOID" }),
      snapshot({ match_id: "unsettled", result: undefined }),
    ]);
    expect(r.counts).toMatchObject({ eligible: 4, answered: 2, invalid_outcome: 1 });
    expect(r.changes).toMatchObject({ compared: 4, changed: 1 });
    expect(r.changes.mean_delta_p1).toBeCloseTo(-.025);
    expect(r.changes.mean_absolute_delta_p1).toBeCloseTo(.025);
    const g = r.by_source.model;
    expect(g.paired).toBe(2);
    expect(g.before!.brier).toBeCloseTo((.04 + .25) / 2);
    expect(g.after!.brier).toBeCloseTo((.04 + .16) / 2);
    expect(g.before!.log_loss).toBeCloseTo((-Math.log(.8)-Math.log(.5))/2);
    expect(g.after!.log_loss).toBeCloseTo((-Math.log(.8)-Math.log(.6))/2);
    expect(g.after!.bins[8]).toMatchObject({ count: 1, mean_probability: .8, observed_rate: 1 });
    expect(g.after!.bins[4]).toMatchObject({ count: 1, mean_probability: .4, observed_rate: 0 });
  });
  it("groups explicitly tagged markets separately and leaves unknown rows identity", () => {
    const market = snapshot({ feature_snapshot: { probability: { version: "tennis-probability-v1", source: "market", raw_p1: .8, raw_p2: .2 } } });
    const r = auditTennisProbability([market, snapshot({ match_id: "legacy", feature_snapshot: undefined })]);
    expect(r.by_source.market).toMatchObject({ eligible: 1, answered: 1, paired: 1 });
    expect(r.by_source.unknown.before).toEqual(r.by_source.unknown.after);
    expect(r.changes.changed).toBe(1);
  });
  it("rejects calendar rollovers rather than allowing Date.parse to invent a day", () => {
    const r = auditTennisProbability([snapshot({ snapshot_at: "2026-02-30T09:00:00Z" })]);
    expect(r.exclusions.invalid_timestamp).toBe(1);
  });
});
