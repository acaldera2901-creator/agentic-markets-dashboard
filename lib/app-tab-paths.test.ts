import { describe, expect, it } from "vitest";
import { TAB_PATHS, PATH_TO_TAB, normalizeTab } from "./app-tab-paths";

describe("app-tab-paths (#URL-PATHS-0810)", () => {
  it("ogni tab ha un path e il roundtrip path→tab è esatto", () => {
    for (const [tab, path] of Object.entries(TAB_PATHS)) {
      expect(path.startsWith("/")).toBe(true);
      expect(PATH_TO_TAB[path]).toBe(tab);
    }
    expect(Object.keys(PATH_TO_TAB)).toHaveLength(Object.keys(TAB_PATHS).length);
  });

  it("normalizza le tab valide e gli alias legacy", () => {
    expect(normalizeTab("bets")).toBe("bets");
    expect(normalizeTab("history")).toBe("history");
    // legacy: la tab account non esiste più, atterra su Plans
    expect(normalizeTab("account")).toBe("plans");
    // legacy: la landing linkava ?tab=builder che non è mai stata una tab
    expect(normalizeTab("builder")).toBe("match-builder");
  });

  it("retires leaderboard deep links to predictions", () => {
    expect(normalizeTab("leaderboard")).toBe("bets");
    expect(PATH_TO_TAB["/leaderboard"]).toBeUndefined();
    expect(Object.values(TAB_PATHS)).not.toContain("/leaderboard");
  });

  it("rifiuta valori sconosciuti o vuoti (il chiamante cade su bets)", () => {
    expect(normalizeTab(null)).toBeNull();
    expect(normalizeTab("")).toBeNull();
    expect(normalizeTab("partners")).toBeNull();
    expect(normalizeTab("__proto__")).toBeNull();
  });
});
