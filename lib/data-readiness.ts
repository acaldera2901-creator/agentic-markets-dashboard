import { shaMatches } from "./fleet-version";

type Status = "ok" | "warning" | "degraded";
type LeagueMetadata = { matches?: readonly unknown[]; fetched_at?: string | null; refresh_status?: string; last_match_at?: string | null };
type Snapshot = { generated_at?: string | null; leagues: Record<string, LeagueMetadata> };

function ageSeconds(timestamp: string | null | undefined, now: number): number | null {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && parsed <= now ? Math.floor((now - parsed) / 1000) : null;
}

export function snapshotReadiness(snapshot: Snapshot, now = Date.now()) {
  const leagues = Object.fromEntries(Object.entries(snapshot.leagues).map(([code, row]) => {
    const legacy = !Object.hasOwn(row, "fetched_at");
    const fetchedAt = legacy ? snapshot.generated_at : row.fetched_at;
    const age = ageSeconds(fetchedAt, now);
    const ageDays = age === null ? null : Math.floor(age / 86400);
    const state = row.refresh_status === "failed" ? "failed" : age === null ? "unknown" : age > 14 * 86400 ? "stale" : "fresh";
    return [code, { state, age_days: ageDays, fetched_at: fetchedAt ?? null, last_match_at: row.last_match_at ?? null, provenance: legacy ? "legacy-global" : "per-league" }];
  }));
  return { status: Object.keys(leagues).length > 0 && Object.values(leagues).every(row => row.state === "fresh") ? "ok" as const : "warning" as const, leagues };
}

export function runtimeReadiness(input: {
  fleetSha: string | null;
  consistent: boolean | null;
  expectedSha: string | null;
  latestAhAt: string | null;
  queryFailed?: boolean;
}, now = Date.now()) {
  const age = ageSeconds(input.latestAhAt, now);
  const ahState = input.queryFailed ? "unavailable" : !input.latestAhAt ? "empty" : age === null ? "unknown" : age > 6 * 3600 ? "stale" : "fresh";
  const expected = input.expectedSha?.trim() || null;
  const release = input.consistent === false ? "mixed" : !input.fleetSha ? "unknown" : !expected ? "unconfigured" :
    /^[0-9a-f]{7,40}$/i.test(expected) && shaMatches(input.fleetSha, expected) ? "expected" : "unexpected";
  const status: Status = release === "mixed" || release === "unexpected" ? "degraded" : release !== "expected" || ahState !== "fresh" ? "warning" : "ok";
  return { status, release, expected_sha: expected, ah_history: { state: ahState, latest_at: input.latestAhAt, age_seconds: age, stale_after_seconds: 6 * 3600 } };
}
