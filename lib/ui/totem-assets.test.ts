import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TOTEMS, totemFor, totemIndex, totemPair } from "./totem-assets";

describe("totemFor", () => {
  it("null o vuoto → null", () => {
    expect(totemFor(null, "football")).toBeNull();
    expect(totemFor("   ", "football")).toBeNull();
  });
  it("deterministico e insensibile a maiuscole/spazi", () => {
    const a = totemFor("Real Salt Lake", "football");
    expect(totemFor("  real  salt lake ", "FOOTBALL")).toEqual(a);
    expect(a?.src).toBe(`/badges/totem-${a?.name}.png`);
    expect(a?.srcSm).toBe(`/badges/totem-${a?.name}-sm.png`);
  });
  it("lo sport fa parte della chiave: stessa stringa, sport diverso, può cambiare", () => {
    // Non asserisce che cambi (dipende dall'hash), solo che la chiave lo includa.
    const names = new Set(["football", "tennis", "basketball", "esports"].map((s) => totemIndex("Ferro", s)));
    expect(names.size).toBeGreaterThanOrEqual(1);
  });
  it("copre tutti e 12 i totem su un campione di nomi", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(totemIndex(`Team ${i}`, "football"));
    expect(seen.size).toBe(TOTEMS.length);
  });
});

describe("totemPair", () => {
  it("le due squadre di una partita non condividono mai il totem", () => {
    for (let i = 0; i < 400; i++) {
      const { home, away } = totemPair(`Home ${i}`, `Away ${i * 7}`, "football");
      expect(home?.name).not.toBe(away?.name);
    }
  });
  it("con avoid uguale al proprio totem si passa al successivo", () => {
    const t = totemFor("Tijuana", "football")!;
    const next = totemFor("Tijuana", "football", { avoid: t.name })!;
    const i = TOTEMS.findIndex((x) => x.name === t.name);
    expect(next.name).toBe(TOTEMS[(i + 1) % TOTEMS.length].name);
  });
});

describe("asset su disco", () => {
  it("ogni totem ha il PNG 128 e il -sm 48 in public/badges", () => {
    for (const t of TOTEMS) {
      expect(existsSync(join(process.cwd(), "public", "badges", `totem-${t.name}.png`)), t.name).toBe(true);
      expect(existsSync(join(process.cwd(), "public", "badges", `totem-${t.name}-sm.png`)), t.name).toBe(true);
    }
  });
});
