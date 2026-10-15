import { describe, it, expect } from "vitest";
import { canonicalEmail, selfReferralCheck, type Fingerprint } from "./self-referral";

const fp = (kind: Fingerprint["kind"], valueHash: string, seenAt = "2026-09-30T10:00:00Z"): Fingerprint => ({
  kind,
  valueHash,
  seenAt,
});

describe("canonicalEmail (#AFFILIATE-V2-0930)", () => {
  it("minuscole e trim", () => {
    expect(canonicalEmail("  Mario.Rossi@Libero.IT ")).toBe("mario.rossi@libero.it");
  });

  it("via il +tag su qualunque provider", () => {
    expect(canonicalEmail("mario+promo@libero.it")).toBe("mario@libero.it");
  });

  it("gmail: via i punti e il +tag; googlemail = gmail", () => {
    expect(canonicalEmail("a.x@gmail.com")).toBe("ax@gmail.com");
    expect(canonicalEmail("ax+x@gmail.com")).toBe("ax@gmail.com");
    expect(canonicalEmail("A.X+y@googlemail.com")).toBe("ax@gmail.com");
  });

  it("i punti restano per i provider non-gmail (persone diverse)", () => {
    expect(canonicalEmail("a.x@outlook.com")).not.toBe(canonicalEmail("ax@outlook.com"));
  });

  it("non-email → null", () => {
    expect(canonicalEmail("tg_12345")).toBeNull();
    expect(canonicalEmail("@gmail.com")).toBeNull();
    expect(canonicalEmail("x@")).toBeNull();
    expect(canonicalEmail("+tag@gmail.com")).toBeNull();
    expect(canonicalEmail(null)).toBeNull();
  });
});

describe("selfReferralCheck", () => {
  it("stesso identifier (a meno di maiuscole/spazi) → self_referral", () => {
    const v = selfReferralCheck({ identifier: "Mario@X.com" }, { identifier: " mario@x.com" });
    expect(v).toEqual({ status: "self_referral", reason: "same_identifier" });
  });

  it("alias gmail (a.x@ vs ax+tag@) → self_referral", () => {
    const v = selfReferralCheck({ identifier: "a.x@gmail.com" }, { identifier: "ax+tag@gmail.com" });
    expect(v).toEqual({ status: "self_referral", reason: "same_canonical_email" });
  });

  it("email esplicita diversa dall'identifier (es. utente Telegram)", () => {
    const v = selfReferralCheck(
      { identifier: "tg_1", email: "Mario+1@libero.it" },
      { identifier: "tg_2", email: "mario@libero.it" }
    );
    expect(v.status).toBe("self_referral");
  });

  it("stesso payer_id PayPal → self_referral", () => {
    const v = selfReferralCheck(
      { identifier: "a@x.com", fingerprints: [fp("paypal_payer_id", "h1")] },
      { identifier: "b@y.com", fingerprints: [fp("paypal_payer_id", "h1")] }
    );
    expect(v).toEqual({ status: "self_referral", reason: "shared_paypal_payer_id" });
  });

  it("stesso device → self_referral", () => {
    const v = selfReferralCheck(
      { identifier: "a@x.com", fingerprints: [fp("device_hash", "d1")] },
      { identifier: "b@y.com", fingerprints: [fp("device_hash", "d1")] }
    );
    expect(v).toEqual({ status: "self_referral", reason: "shared_device_hash" });
  });

  it("stesso valore ma kind diverso non conta", () => {
    const v = selfReferralCheck(
      { identifier: "a@x.com", fingerprints: [fp("device_hash", "same")] },
      { identifier: "b@y.com", fingerprints: [fp("stripe_card_fp", "same")] }
    );
    expect(v.status).toBe("valid");
  });

  it("stesso IP entro 24h → fraud_review (non self_referral: coinquilini)", () => {
    const v = selfReferralCheck(
      { identifier: "a@x.com", fingerprints: [fp("ip_hash", "ip1", "2026-09-30T10:00:00Z")] },
      { identifier: "b@y.com", fingerprints: [fp("ip_hash", "ip1", "2026-10-01T09:00:00Z")] }
    );
    expect(v).toEqual({ status: "fraud_review", reason: "shared_ip_24h" });
  });

  it("stesso IP a più di 24h → valid", () => {
    const v = selfReferralCheck(
      { identifier: "a@x.com", fingerprints: [fp("ip_hash", "ip1", "2026-09-01T10:00:00Z")] },
      { identifier: "b@y.com", fingerprints: [fp("ip_hash", "ip1", "2026-09-30T10:00:00Z")] }
    );
    expect(v.status).toBe("valid");
  });

  it("un segnale forte vince sull'IP", () => {
    const v = selfReferralCheck(
      { identifier: "a@x.com", fingerprints: [fp("ip_hash", "ip1"), fp("device_hash", "d1")] },
      { identifier: "b@y.com", fingerprints: [fp("ip_hash", "ip1"), fp("device_hash", "d1")] }
    );
    expect(v.status).toBe("self_referral");
  });

  it("data illeggibile sull'IP non manda in revisione", () => {
    const v = selfReferralCheck(
      { identifier: "a@x.com", fingerprints: [fp("ip_hash", "ip1", "garbage")] },
      { identifier: "b@y.com", fingerprints: [fp("ip_hash", "ip1")] }
    );
    expect(v.status).toBe("valid");
  });

  it("persone diverse senza segnali → valid", () => {
    expect(selfReferralCheck({ identifier: "a@x.com" }, { identifier: "b@y.com" })).toEqual({
      status: "valid",
      reason: null,
    });
  });
});
