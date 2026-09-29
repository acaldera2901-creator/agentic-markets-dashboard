// Offline only: npx tsx scripts/audit-tennis-probability.ts path/to/export.json
// Input: array of TennisAuditSnapshot, or { snapshots: [...] }. No DB/network.
import { readFileSync } from "node:fs";
import { auditTennisProbability } from "../lib/tennis-probability-audit";

try {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) throw new Error("Usage: tsx scripts/audit-tennis-probability.ts <local-export.json>");
  const data = JSON.parse(readFileSync(path, "utf8"));
  const snapshots = Array.isArray(data) ? data : data?.snapshots;
  if (!Array.isArray(snapshots)) throw new Error("Expected an array or { snapshots: [...] }");
  process.stdout.write(JSON.stringify(auditTennisProbability(snapshots), null, 2) + "\n");
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 1;
}
