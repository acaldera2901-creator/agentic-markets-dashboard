import { expect, it, vi } from "vitest";
vi.mock("./tennis-calibration", async importOriginal => ({
  ...await importOriginal<typeof import("./tennis-calibration")>(), TENNIS_ANCHORED_TAU: 1,
}));
import { resolveTennisProbability } from "./tennis-probability";
it("temperature rollback is exact identity, including its recorded version", () => {
  const r = resolveTennisProbability({ p1: .7, p2: .3001, odds_p1: 1.3, odds_p2: 4.2,
    feature_snapshot: { probability: { version: "tennis-probability-v1", source: "market", raw_p1: .7, raw_p2: .3001 } } });
  expect(r.published).toEqual({ p1: .7, p2: .3001 });
  expect(r.source).toBe("market");
  expect(r.calibrationVersion).toBe("identity-v1");
});
