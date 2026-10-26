import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { crestUrl } from "./crest-assets";
import map from "./crest-map.json";

describe("crest assets", () => {
  it("resolves typography variations without conflating teams", () => {
    expect(crestUrl("  Tomás   Martín Etcheverry ", "TENNIS")).toBe(crestUrl("Tomas Martin Etcheverry", "tennis"));
    expect(crestUrl("Olympique Lyonnais", "football")).toBe(crestUrl("Lyon", "football"));
    expect(crestUrl("Lyon Women", "football")).toBeNull();
    expect(crestUrl("Nuno Borges", "football")).toBeNull();
  });
  it("only references bundled assets", () => {
    for (const url of Object.values(map)) expect(existsSync(resolve(process.cwd(), "public" + url)), url).toBe(true);
  });
});
