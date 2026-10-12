import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROXY_TILES } from "@/core/kpi";
import { loadMemos, loadWorkContent, validateExperiments, validateGaps, validateSources } from "./content";

describe("versioned work content", () => {
  const content = loadWorkContent();

  it("lists the 14 known tracking gaps, each with an owner and at least one unlocked KPI", () => {
    expect(content.gaps).toHaveLength(14);
    for (const g of content.gaps) {
      expect(g.owner.trim(), g.id).not.toBe("");
      expect(g.unlocks.length, g.id).toBeGreaterThan(0);
    }
  });

  it("marks every experiment as an example to validate, not as a decided plan", () => {
    expect(content.experiments.length).toBeGreaterThanOrEqual(3);
    for (const e of content.experiments) expect(e.note).toBe("example to validate with Steve");
  });

  it("every PROXY tile says what makes it real, and the gaps say the same", () => {
    const byId = new Map(content.gaps.map((g) => [g.id, g]));
    for (const t of PROXY_TILES) {
      for (const id of t.gaps) {
        expect(byId.get(id), `${t.label} → ${id}`).toBeDefined();
        expect(byId.get(id)!.tiles, `${id} does not list «${t.label}»`).toContain(t.label);
        expect(byId.get(id)!.dependsOn, id).toBeTruthy();
      }
    }
    const labels = new Set(PROXY_TILES.map((t) => t.label));
    for (const g of content.gaps) for (const tile of g.tiles ?? []) expect(labels.has(tile), `${g.id} cites a non-PROXY tile: ${tile}`).toBe(true);
  });

  it("covers every source with an operational block, nothing claimed as granted", () => {
    const ids = content.sources.map((s) => s.id);
    for (const id of ["supabase", "vercel", "search-console", "stripe", "paypal", "paygate", "shopify", "aff-ggbet", "aff-wildz", "aff-fortuneplay", "aff-betscore", "resend", "meta", "tiktok", "youtube", "x", "reddit"]) {
      expect(ids, id).toContain(id);
    }
    for (const s of content.sources) {
      expect(s.status, s.id).toBe("to grant");
      expect(s.steps.length, s.id).toBeGreaterThan(0);
      expect(s.verify, s.id).toMatch(/\d|same number/);
    }
  });

  it("keeps the two hard lines: Reddit credentials stay with the agent, Supabase only via growth_ro", () => {
    const reddit = content.sources.find((s) => s.id === "reddit")!;
    expect(reddit.role).toMatch(/are not shared/);
    const supabase = content.sources.find((s) => s.id === "supabase")!;
    expect(supabase.role).toMatch(/growth_ro/);
    expect(supabase.role).toMatch(/Never the SQL editor/);
  });

  it("ships no fake memo: only the template exists", () => {
    expect(content.memos).toEqual([]);
    expect(content.memoTemplate).toMatch(/What works/);
    expect(content.memoTemplate).toMatch(/What does not work/);
    expect(content.memoTemplate).toMatch(/What we test/);
  });
});

describe("validation fails loudly on a bad edit", () => {
  const gap = { id: "G1", title: "t", problem: "p", priority: "P0", unlocks: ["WAA"], owner: "Calde", status: "open" };

  it("rejects a gap without owner or unlocked KPIs", () => {
    expect(() => validateGaps([{ ...gap, owner: " " }])).toThrow(/owner/);
    expect(() => validateGaps([{ ...gap, unlocks: [] }])).toThrow(/unlocks/);
  });

  it("rejects unknown priority/status and duplicate ids", () => {
    expect(() => validateGaps([{ ...gap, priority: "high" }])).toThrow(/priority/);
    expect(() => validateGaps([{ ...gap, status: "done" }])).toThrow(/status/);
    // the pre-v8 Italian status is rejected too, with the English list in the message
    expect(() => validateGaps([{ ...gap, status: "aperto" }])).toThrow(/open, in progress, mitigated, closed/);
    expect(() => validateGaps([gap, gap])).toThrow(/duplicate/);
  });

  it("rejects a source without steps, with an unknown status, or duplicated", () => {
    const src = { id: "s", tool: "t", reads: "r", role: "Viewer", steps: ["a"], owner: "Andrea", verify: "1 = 1", status: "to grant" };
    expect(() => validateSources([{ ...src, steps: [] }])).toThrow(/steps/);
    expect(() => validateSources([{ ...src, status: "access to be checked" }])).toThrow(/status/);
    expect(() => validateSources([{ ...src, role: "" }])).toThrow(/role/);
    expect(() => validateSources([src, src])).toThrow(/duplicate/);
  });

  it("rejects a gap with an empty tiles list", () => {
    expect(() => validateGaps([{ ...gap, tiles: [] }])).toThrow(/tiles/);
  });

  it("rejects an experiment without a decision threshold", () => {
    const e = { id: "E1", hypothesis: "h", kpiTarget: "k", dataSource: "d", duration: "2w", decisionThreshold: "", status: "proposed" };
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
