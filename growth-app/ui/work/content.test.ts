import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadMemos, loadWorkContent, validateExperiments, validateGaps } from "./content";

describe("versioned work content", () => {
  const content = loadWorkContent();

  it("lists the 12 known tracking gaps, each with an owner and at least one unlocked KPI", () => {
    expect(content.gaps).toHaveLength(12);
    for (const g of content.gaps) {
      expect(g.owner.trim(), g.id).not.toBe("");
      expect(g.unlocks.length, g.id).toBeGreaterThan(0);
    }
  });

  it("marks every experiment as an example to validate, not as a decided plan", () => {
    expect(content.experiments.length).toBeGreaterThanOrEqual(3);
    for (const e of content.experiments) expect(e.note).toBe("esempio da validare con Steve");
  });

  it("does not claim any access as verified", () => {
    for (const s of content.sources) expect(s.status).toBe("accesso da verificare");
  });

  it("ships no fake memo: only the template exists", () => {
    expect(content.memos).toEqual([]);
    expect(content.memoTemplate).toMatch(/Cosa funziona/);
    expect(content.memoTemplate).toMatch(/Cosa non funziona/);
    expect(content.memoTemplate).toMatch(/Cosa testiamo/);
  });
});

describe("validation fails loudly on a bad edit", () => {
  const gap = { id: "G1", title: "t", problem: "p", priority: "P0", unlocks: ["WAA"], owner: "Calde", status: "aperto" };

  it("rejects a gap without owner or unlocked KPIs", () => {
    expect(() => validateGaps([{ ...gap, owner: " " }])).toThrow(/owner/);
    expect(() => validateGaps([{ ...gap, unlocks: [] }])).toThrow(/unlocks/);
  });

  it("rejects unknown priority/status and duplicate ids", () => {
    expect(() => validateGaps([{ ...gap, priority: "alta" }])).toThrow(/priority/);
    expect(() => validateGaps([{ ...gap, status: "fatto" }])).toThrow(/status/);
    expect(() => validateGaps([gap, gap])).toThrow(/duplicato/);
  });

  it("rejects an experiment without a decision threshold", () => {
    const e = { id: "E1", hypothesis: "h", kpiTarget: "k", dataSource: "d", duration: "2w", decisionThreshold: "", status: "proposto" };
    expect(() => validateExperiments([e])).toThrow(/decisionThreshold/);
  });
});

describe("memos", () => {
  it("lists dated memos newest first and skips the template", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "memo-"));
    for (const f of ["_template.md", "2026-W40.md", "2026-W41.md", "note.txt"]) writeFileSync(path.join(dir, f), f);
    expect(loadMemos(dir).map((m) => m.file)).toEqual(["2026-W41.md", "2026-W40.md"]);
  });
});
