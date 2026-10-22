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
  it("scrive l'HMAC, mai l'IP in chiaro, con identifier normalizzato e seen_at rinfrescato", async () => {
    expect(await recordIpFingerprintSafe("  Ref@X.io ", "1.2.3.4")).toBe(true);
    const [sql, params] = dbExecute.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(identifier, kind, value_hash\) DO UPDATE SET seen_at = NOW\(\)/);
    expect(params).toEqual(["ref@x.io", createHmac("sha256", SECRET).update("1.2.3.4").digest("hex")]);
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
    dbExecute.mockRejectedValueOnce(new Error("down"));
    expect(await recordIpFingerprintSafe("a@x.io", "1.2.3.4")).toBe(false);
  });

  it("schedule: gira dentro after(), non blocca la risposta", () => {
    scheduleIpFingerprint("a@x.io", "1.2.3.4");
    expect(after).toHaveBeenCalledTimes(1);
    expect(dbExecute).not.toHaveBeenCalled();
  });
});
