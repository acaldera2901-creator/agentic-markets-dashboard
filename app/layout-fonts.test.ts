// #PERF-1106: Manrope and JetBrains Mono are VARIABLE fonts: a `weight: [...]` array makes next/font download one woff2 per weight
// (9 files, ~300 KB on the first visit); without it, one variable file per family. Barlow Condensed and Anton are static: they keep their weights.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "layout.tsx"), "utf8");
const block = (name: string) => src.match(new RegExp(`const ${name} = \\w+\\(\\{[^}]*\\}\\);`))?.[0] ?? "";

describe("root layout fonts", () => {
  it("variable families declare no weight array (one file each)", () => {
    expect(block("manrope")).toMatch(/Manrope/); expect(block("manrope")).not.toMatch(/weight/);
    expect(block("jetbrainsMono")).toMatch(/JetBrains_Mono/); expect(block("jetbrainsMono")).not.toMatch(/weight/);
  });
  it("static families keep the weights the design uses", () => {
    expect(block("barlowCondensed")).toMatch(/weight: \["700", "800"\]/);
    expect(block("anton")).toMatch(/weight: \["400"\]/);
  });
});
