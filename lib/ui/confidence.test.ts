import { describe, it, expect } from "vitest";
import { confidencePercent, confidenceBucket, confidenceLabel } from "./confidence";

describe("confidencePercent", () => {
  it("null → 0", () => expect(confidencePercent(null)).toBe(0));
  it("scala 0–100 arrotondata e clampata", () => {
    expect(confidencePercent(78.4)).toBe(78);
    expect(confidencePercent(150)).toBe(100);
    expect(confidencePercent(-5)).toBe(0);
  });
  it("frazione 0–1 → percentuale", () => {
    expect(confidencePercent(0.61)).toBe(61);
    expect(confidencePercent(1)).toBe(100);
  });
  it("valore > 1 trattato come scala 0–100, non frazione", () => {
    expect(confidencePercent(1.5)).toBe(2);
  });
});

describe("confidenceBucket", () => {
  it("≥70 alta, ≥50 media, <50 bassa", () => {
    expect(confidenceBucket(78)).toBe("alta");
    expect(confidenceBucket(61)).toBe("media");
    expect(confidenceBucket(40)).toBe("bassa");
    expect(confidenceBucket(null)).toBe("bassa");
  });
  it("boundary esatti: 70, 50, 49", () => {
    expect(confidenceBucket(70)).toBe("alta");
    expect(confidenceBucket(50)).toBe("media");
    expect(confidenceBucket(49)).toBe("bassa");
  });
});

describe("confidenceLabel", () => {
  it("mappa bucket → etichetta italiana", () => {
    expect(confidenceLabel("alta")).toBe("Alta");
    expect(confidenceLabel("media")).toBe("Media");
    expect(confidenceLabel("bassa")).toBe("Bassa");
  });
});
