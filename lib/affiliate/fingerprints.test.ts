import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const dbExecute = vi.fn();
vi.mock("@/lib/db", () => ({ dbExecute, dbQueryStrict: vi.fn(), dbQuery: vi.fn() }));
const after = vi.fn();
vi.mock("next/server", () => ({ after }));

const { recordIpFingerprintSafe, scheduleIpFingerprint } = await import("./fingerprints");
const SECRET = "s".repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AFFILIATE_MODE", "shadow");
  vi.stubEnv("AFFILIATE_HASH_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("recordIpFingerprintSafe", () => {
  it("scrive l'HMAC di IP+giorno (oggi e ieri), mai l'IP in chiaro; pulizia PRIMA dell'insert", async () => {
    const at = new Date("2026-10-22T00:30:00Z");
    expect(await recordIpFingerprintSafe("  Ref@X.io ", "1.2.3.4", at)).toBe(true);
    expect(dbExecute.mock.calls[0]).toEqual([expect.stringMatching(/DELETE FROM affiliate_payer_fingerprints/), [90]]);
    const [sql, params] = dbExecute.mock.calls[1];
    expect(sql).toMatch(/ON CONFLICT \(identifier, kind, value_hash\) DO NOTHING/);
    const h = (v: string) => createHmac("sha256", SECRET).update(v).digest("hex");
    expect(params).toEqual(["ref@x.io", h("1.2.3.4|2026-10-22"), h("1.2.3.4|2026-10-21"), at.toISOString()]);
    expect(JSON.stringify(params)).not.toContain("1.2.3.4");
  });

  it("senza segreto, con IP ignoto o con il programma spento: nessuna scrittura", async () => {
    vi.stubEnv("AFFILIATE_HASH_SECRET", "");
    expect(await recordIpFingerprintSafe("a@x.io", "1.2.3.4")).toBe(false);
    vi.stubEnv("AFFILIATE_HASH_SECRET", SECRET);
    expect(await recordIpFingerprintSafe("a@x.io", "unknown")).toBe(false);
    vi.stubEnv("AFFILIATE_MODE", "off");
    expect(await recordIpFingerprintSafe("a@x.io", "1.2.3.4")).toBe(false);
    scheduleIpFingerprint("a@x.io", "1.2.3.4");
    expect(after).not.toHaveBeenCalled();
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("DB giù → false, non lancia", async () => {
    dbExecute.mockRejectedValue(new Error("down"));
    expect(await recordIpFingerprintSafe("a@x.io", "1.2.3.4")).toBe(false);
  });

  it("schedule: gira dentro after(), non blocca la risposta", () => {
    scheduleIpFingerprint("a@x.io", "1.2.3.4");
    expect(after).toHaveBeenCalledTimes(1);
    expect(dbExecute).not.toHaveBeenCalled();
  });
});
