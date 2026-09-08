import { describe, it, expect } from "vitest";
import {
  extractCodeSha,
  extractBootAt,
  shaMatches,
  summarizeFleetVersion,
} from "./fleet-version";

// #FLEET-CODE-SHA-0908 — what /api/health must be able to say about the fleet.
// The defect: on 07/09 the fleet graded for hours with pre-#361 code while
// main had the fix, and the health surface could not tell. These tests pin
// the reading side; tests/test_code_version.py pins the writing side.

const NOW = Date.parse("2026-09-08T12:00:00Z");
const fresh = new Date(NOW - 30_000).toISOString();
const dead = new Date(NOW - 3600_000).toISOString();

function row(name: string, detail: string | null, last_seen: string | null = fresh) {
  return { agent_name: name, last_seen, status_detail: detail };
}

describe("extractCodeSha", () => {
  it("reads the stamp out of a JSON detail", () => {
    expect(extractCodeSha('{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00"}')).toBe("d6b266d5");
  });

  it("still reads it when the payload was truncated at 4000 chars (not valid JSON)", () => {
    const truncated = '{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00","world_cup":{"registry":{"competi';
    expect(extractCodeSha(truncated)).toBe("d6b266d5");
  });

  it("returns null for a pre-patch detail, null, or a non-hex value", () => {
    expect(extractCodeSha('{"type":"tennis_collection","fixtures_collected":37}')).toBeNull();
    expect(extractCodeSha(null)).toBeNull();
    expect(extractCodeSha('{"code_sha":"not-a-sha!"}')).toBeNull();
  });

  it("reads boot_at the same two ways", () => {
    expect(extractBootAt('{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00"}')).toBe("2026-09-07T13:18:24+00:00");
    expect(extractBootAt('{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00","x":{"y')).toBe("2026-09-07T13:18:24+00:00");
    expect(extractBootAt("{}")).toBeNull();
  });
});

describe("shaMatches", () => {
  it("matches Vercel's 7 chars against git's 8", () => {
    expect(shaMatches("d6b266d", "d6b266d5")).toBe(true);
    expect(shaMatches("d6b266d5", "d6b266d")).toBe(true);
    expect(shaMatches("22080326", "d6b266d")).toBe(false);
    expect(shaMatches(null, "d6b266d")).toBeNull();
  });
});

describe("summarizeFleetVersion", () => {
  it("one sha across the fleet → consistent, matches the web", () => {
    const s = summarizeFleetVersion(
      [
        row("DataCollector", '{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00","type":"data_collector_cycle"}'),
        row("ModelAgent", '{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:25+00:00"}'),
        row("TraderAgent", '{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00"}'),
      ],
      "d6b266d",
      NOW,
    );
    expect(s.code_sha).toBe("d6b266d5");
    expect(s.consistent).toBe(true);
    expect(s.matches_web).toBe(true);
    expect(s.reporting).toBe(3);
    expect(s.considered).toBe(3);
    expect(s.latest_boot_at).toBe("2026-09-07T13:18:25+00:00");
  });

  it("the 07/09 case: fleet on the old sha while the web moved → matches_web false", () => {
    const s = summarizeFleetVersion(
      [row("ResultSettlementAgent", '{"code_sha":"22080326","boot_at":"2026-08-31T16:00:00+00:00"}')],
      "d6b266d",
      NOW,
    );
    expect(s.code_sha).toBe("22080326");
    expect(s.matches_web).toBe(false);
  });

  it("two shas at once (half-restarted fleet) → not consistent, no single sha", () => {
    const s = summarizeFleetVersion(
      [
        row("DataCollector", '{"code_sha":"22080326","boot_at":"2026-08-31T16:00:00+00:00"}'),
        row("ModelAgent", '{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00"}'),
      ],
      "d6b266d",
      NOW,
    );
    expect(s.consistent).toBe(false);
    expect(s.code_sha).toBeNull();
    expect(s.matches_web).toBeNull();
    expect(s.shas).toEqual({ "22080326": 1, d6b266d5: 1 });
  });

  it("an offline agent's stale row does not vote", () => {
    const s = summarizeFleetVersion(
      [
        row("DataCollector", '{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00"}'),
        row("GhostAgent", '{"code_sha":"22080326","boot_at":"2026-08-01T00:00:00+00:00"}', dead),
      ],
      "d6b266d",
      NOW,
    );
    expect(s.consistent).toBe(true);
    expect(s.code_sha).toBe("d6b266d5");
    expect(s.considered).toBe(1);
  });

  it("pre-patch fleet (no stamp anywhere) → honest unknown, not a fake value", () => {
    const s = summarizeFleetVersion(
      [row("DataCollector", '{"type":"data_collector_cycle"}'), row("TraderAgent", null)],
      "d6b266d",
      NOW,
    );
    expect(s.code_sha).toBeNull();
    expect(s.consistent).toBeNull();
    expect(s.matches_web).toBeNull();
    expect(s.reporting).toBe(0);
    expect(s.considered).toBe(2);
  });
});
