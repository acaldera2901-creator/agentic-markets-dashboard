import { describe, expect, it } from "vitest";
import { snapshotReadiness, runtimeReadiness } from "./data-readiness";
const now = Date.parse("2026-09-21T18:00:00Z");
describe("data readiness is distinct from heartbeat liveness", () => {
  it("marks a fetch stale immediately after fourteen days", () => {
    const fetched_at = new Date(now - 14 * 86400000 - 1000).toISOString();
    expect(snapshotReadiness({ leagues: { A: { fetched_at } } }, now).leagues.A.state).toBe("stale");
  });
  it("does not let today's global timestamp hide an old or failed league", () => {
    const r = snapshotReadiness({ generated_at: "2026-09-21", leagues: { A: { fetched_at: "2026-08-12", refresh_status: "failed", last_match_at: "2026-08-10" }, B: { fetched_at: "2026-09-21", refresh_status: "ok", last_match_at: "2026-05-10" } } }, now);
    expect(r.status).toBe("warning");
    expect(r.leagues.A.state).toBe("failed");
    expect(r.leagues.A.age_days).toBe(40);
    expect(r.leagues.B.state).toBe("fresh"); // off-season match age is not fetch age
  });
  it("labels legacy snapshot provenance explicitly and rejects unknown/future fetch dates", () => {
    const r = snapshotReadiness({ generated_at: "2026-08-12", leagues: { A: {}, B: { fetched_at: null }, C: { fetched_at: "2099-01-01" } } }, now);
    expect(r.leagues.A.state).toBe("stale");
    expect(r.leagues.A.provenance).toBe("legacy-global");
    expect(r.leagues.B.state).toBe("unknown");
    expect(r.leagues.C.state).toBe("unknown");
  });
  it("warns about no AH data even when the process reports a SHA", () => {
    expect(runtimeReadiness({ fleetSha: "abcdef12", consistent: true, expectedSha: "abcdef12", latestAhAt: null }, now)).toMatchObject({ status: "warning", ah_history: { state: "empty" }, release: "expected" });
  });
  it("does not equate different web/fleet commits with an unapproved runtime release", () => {
    expect(runtimeReadiness({ fleetSha: "abcdef12", consistent: true, expectedSha: null, latestAhAt: "2026-09-21T17:59:00Z" }, now)).toMatchObject({ release: "unconfigured", status: "warning" });
  });
  it("flags wrong or mixed worker releases and data read failures", () => {
    expect(runtimeReadiness({ fleetSha: "abcdef12", consistent: true, expectedSha: "1234567", latestAhAt: "2026-09-21T17:59:00Z" }, now).status).toBe("degraded");
    expect(runtimeReadiness({ fleetSha: null, consistent: false, expectedSha: null, latestAhAt: null, queryFailed: true }, now)).toMatchObject({ status: "degraded", ah_history: { state: "unavailable" } });
  });
});
