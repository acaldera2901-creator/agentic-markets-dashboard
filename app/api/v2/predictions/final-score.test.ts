import { describe, it, expect } from "vitest";
import { parseFinalScore } from "./final-score";

describe("parseFinalScore", () => {
  it("estrae final_score da notes JSON", () => {
    expect(parseFinalScore('{"final_score":"2-1"}')).toBe("2-1");
    expect(parseFinalScore('{"final_score":"6-4 6-3","x":1}')).toBe("6-4 6-3");
  });
  it("null se assente/malformato/vuoto", () => {
    expect(parseFinalScore(null)).toBeNull();
    expect(parseFinalScore("")).toBeNull();
    expect(parseFinalScore("{}")).toBeNull();
    expect(parseFinalScore("not json")).toBeNull();
    expect(parseFinalScore('{"final_score":123}')).toBeNull();
  });
});
