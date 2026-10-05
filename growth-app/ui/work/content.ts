// Versioned work content for /lavoro: JSON + markdown in content/, updated by
// a commit. No database — validation here makes a malformed edit fail the
// build (and the tests) instead of rendering a half-empty table.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import gapsJson from "@/content/tracking-gaps.json";
import experimentsJson from "@/content/experiments.json";
import sourcesJson from "@/content/sources.json";

export const PRIORITIES = ["P0", "P1", "P2"] as const;
export const GAP_STATUSES = ["aperto", "in corso", "mitigato", "chiuso"] as const;
export const EXPERIMENT_STATUSES = ["proposto", "in corso", "scale", "fix", "kill"] as const;
/** An access goes da concedere → concesso (the owner did it) → verificato (the check number matched). */
export const ACCESS_STATUSES = ["da concedere", "concesso", "verificato"] as const;

export interface TrackingGap {
  id: string;
  title: string;
  problem: string;
  priority: (typeof PRIORITIES)[number];
  unlocks: string[];
  owner: string;
  status: (typeof GAP_STATUSES)[number];
  /** Dashboard tiles still PROXY that this gap makes real (labels of PROXY_TILES in core/kpi.ts). */
  tiles?: string[];
  /** What closing the gap depends on: work, decision or access. */
  dependsOn?: string;
}

export interface Experiment {
  id: string;
  hypothesis: string;
  kpiTarget: string;
  dataSource: string;
  duration: string;
  decisionThreshold: string;
  status: (typeof EXPERIMENT_STATUSES)[number];
  note?: string;
}

export interface AccessSource {
  id: string;
  tool: string;
  /** What Steve reads there and which KPI/gap it serves. */
  reads: string;
  /** The minimum read-only role to ask for — never admin, never a shared login. */
  role: string;
  /** Exact steps for whoever grants it. Unknown paths say «da verificare nell'interfaccia». */
  steps: string[];
  /** Who grants the access. */
  owner: string;
  /** How to prove it works: one number to compare. */
  verify: string;
  status: (typeof ACCESS_STATUSES)[number];
}

export interface Memo {
  file: string;
  body: string;
}

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function fail(file: string, where: string, msg: string): never {
  throw new Error(`content/${file} → ${where}: ${msg}`);
}

function requireStrings(file: string, where: string, row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) if (!nonEmpty(row[k])) fail(file, where, `campo «${k}» mancante o vuoto`);
}

function requireUniqueIds(file: string, rows: { id: string }[]) {
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) fail(file, r.id, "id duplicato");
    seen.add(r.id);
  }
}

export function validateGaps(raw: unknown): TrackingGap[] {
  const file = "tracking-gaps.json";
  if (!Array.isArray(raw) || raw.length === 0) fail(file, "radice", "serve una lista non vuota");
  raw.forEach((row: Record<string, unknown>, i) => {
    const where = nonEmpty(row.id) ? row.id : `riga ${i + 1}`;
    requireStrings(file, where, row, ["id", "title", "problem", "owner"]);
    if (!PRIORITIES.includes(row.priority as never)) fail(file, where, `priority deve essere ${PRIORITIES.join("/")}`);
    if (!GAP_STATUSES.includes(row.status as never)) fail(file, where, `status deve essere uno fra: ${GAP_STATUSES.join(", ")}`);
    if (!Array.isArray(row.unlocks) || row.unlocks.length === 0 || !row.unlocks.every(nonEmpty)) {
      fail(file, where, "unlocks deve elencare almeno un KPI sbloccato");
    }
    if (row.tiles !== undefined && (!Array.isArray(row.tiles) || row.tiles.length === 0 || !row.tiles.every(nonEmpty))) {
      fail(file, where, "tiles, se presente, deve elencare almeno una tile");
    }
    if (row.dependsOn !== undefined && !nonEmpty(row.dependsOn)) fail(file, where, "dependsOn, se presente, non può essere vuoto");
  });
  requireUniqueIds(file, raw as TrackingGap[]);
  return raw as TrackingGap[];
}

export function validateExperiments(raw: unknown): Experiment[] {
  const file = "experiments.json";
  if (!Array.isArray(raw)) fail(file, "radice", "serve una lista");
  raw.forEach((row: Record<string, unknown>, i) => {
    const where = nonEmpty(row.id) ? row.id : `riga ${i + 1}`;
    requireStrings(file, where, row, ["id", "hypothesis", "kpiTarget", "dataSource", "duration", "decisionThreshold"]);
    if (!EXPERIMENT_STATUSES.includes(row.status as never)) fail(file, where, `status deve essere uno fra: ${EXPERIMENT_STATUSES.join(", ")}`);
  });
  requireUniqueIds(file, raw as Experiment[]);
  return raw as Experiment[];
}

export function validateSources(raw: unknown): AccessSource[] {
  const file = "sources.json";
  if (!Array.isArray(raw) || raw.length === 0) fail(file, "radice", "serve una lista non vuota");
  raw.forEach((row: Record<string, unknown>, i) => {
    const where = nonEmpty(row.id) ? row.id : `riga ${i + 1}`;
    requireStrings(file, where, row, ["id", "tool", "reads", "role", "owner", "verify"]);
    if (!ACCESS_STATUSES.includes(row.status as never)) fail(file, where, `status deve essere uno fra: ${ACCESS_STATUSES.join(", ")}`);
    if (!Array.isArray(row.steps) || row.steps.length === 0 || !row.steps.every(nonEmpty)) fail(file, where, "steps deve elencare almeno un passo");
  });
  requireUniqueIds(file, raw as AccessSource[]);
  return raw as AccessSource[];
}

const MEMO_DIR = path.join(process.cwd(), "content", "memo");
const TEMPLATE = "_template.md";

/** Memos are content/memo/AAAA-Www.md, newest first. The template is not a memo. */
export function loadMemos(dir = MEMO_DIR): Memo[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== TEMPLATE && f !== "README.md")
    .sort()
    .reverse()
    .map((file) => ({ file, body: readFileSync(path.join(dir, file), "utf8") }));
}

export function loadMemoTemplate(dir = MEMO_DIR): string {
  return readFileSync(path.join(dir, TEMPLATE), "utf8");
}

export function loadWorkContent() {
  return {
    gaps: validateGaps(gapsJson),
    experiments: validateExperiments(experimentsJson),
    sources: validateSources(sourcesJson),
    memos: loadMemos(),
    memoTemplate: loadMemoTemplate(),
  };
}

export type WorkContent = ReturnType<typeof loadWorkContent>;
