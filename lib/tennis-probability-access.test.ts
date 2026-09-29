import { expect, it } from "vitest";
import { projectPrediction } from "./access-projection";
it("tennis private probability audit metadata never escapes through unified notes", () => {
  const notes = JSON.stringify({ unrelated: "keep", probability: { version: "tennis-probability-v1", raw_p1: .8 } });
  for (const state of ["free", "base", "premium", "admin_full"] as const) {
    const out = projectPrediction({ sport: "tennis", notes }, state, 0);
    expect(JSON.parse(out.notes as string)).toEqual({ unrelated: "keep" });
  }
  expect(projectPrediction({ sport: "tennis", notes }, "anonymous", 0).notes).toBeUndefined();
  expect(projectPrediction({ sport: "tennis", notes: "legacy note" }, "premium", 0).notes).toBe("legacy note");
  expect(projectPrediction({ sport: "football", notes }, "premium", 0).notes).toBe(notes);
});
