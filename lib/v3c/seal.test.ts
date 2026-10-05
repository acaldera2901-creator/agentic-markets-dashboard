import { describe, expect, it } from "vitest";
import { sealTimeUtc, shortHash } from "./seal";

describe("v3c sigillo", () => {
  it("primi quattro, puntini, ultimi due", () => {
    expect(shortHash("a91f3c7e0b2d44c3")).toBe("a91f…c3");
    expect(shortHash("A91F3C7E0B2D44C3")).toBe("a91f…c3");
  });
  it("un hash corto resta intero", () => {
    expect(shortHash("a91fc3")).toBe("a91fc3");
  });
  it("non esadecimale o vuoto → stringa vuota, non una finta prova", () => {
    expect(shortHash("not-a-hash")).toBe("");
    expect(shortHash("")).toBe("");
    expect(shortHash(null)).toBe("");
  });
  it("ora del sigillo in UTC, due cifre", () => {
    expect(sealTimeUtc("2026-10-10T09:02:11Z")).toBe("09:02 UTC");
    expect(sealTimeUtc("2026-10-10T11:02:00+02:00")).toBe("09:02 UTC");
    expect(sealTimeUtc("nope")).toBe("");
  });
});
