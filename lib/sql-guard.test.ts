// lib/sql-guard.test.ts — #GOLIVE-QW-C CI guard against SQL injection.
//
// The whole DB layer (lib/db.ts) funnels every query through the exec_sql RPC
// (SECURITY DEFINER, owner postgres). Values are escaped CLIENT-SIDE by
// `interpolate()` at the $N placeholders. A template literal with a ${...}
// interpolation inside the FIRST argument of dbQuery()/dbExecute() bypasses that
// escaping entirely — a future query built that way = SQL injection executed with
// OWNER privileges (full DB read/write, RLS bypassed). This test fails the build
// if any such interpolation appears outside the reviewed allowlist below.
//
// Scope: dbQuery(`…`) and dbExecute(`…`) exactly (per audit spec). dbQueryStrict
// shares the same risk but is out of scope for this guard; it currently has no
// template-interpolated call site (verified 2026-07-13).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// repo root = parent of lib/ (this file lives in lib/).
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["app", "lib", "components"];

// Matches `dbQuery(` or `dbExecute(` — with an optional generic type arg
// (dbQuery<Row>(…)) and optional whitespace — followed by a template literal
// whose FIRST ${…} occurs before the closing backtick. Captures that expression.
// No `.` is used (only negated char classes, which already span newlines), so the
// multiline SQL case is handled without the `s`/dotAll flag. `g`: all call sites.
const DB_INTERP_RE =
  /db(?:Query|Execute)\s*(?:<[^>]*>)?\s*\(\s*`[^`]*?\$\{([^}]*)\}/g;

// ── Allowlist: reviewed, safe interpolations ────────────────────────────────
// Keyed "<relative-path>::<trimmed interpolated expression>". Every entry below
// interpolates a SQL *fragment made of $N placeholders* (real values still flow
// through the escaped params array) — NOT user data. Line-independent so it
// survives edits above the call site. Re-audit before adding an entry.
const ALLOWLIST = new Set<string>([
  // Dynamic WHERE built from static fragments; user values go to `values` at $N.
  'app/api/v2/history/route.ts::conditions.join(" AND ")',
  'app/api/v2/predictions/route.ts::conditions.join(" AND ")',
  // `$1, $2, …` placeholder lists for a variadic IN (…) — values in params array.
  "app/api/weekly-pick/route.ts::idPlaceholders",
  "app/api/weekly-pick/history/route.ts::idPlaceholders",
  "lib/goalscorer-fetch.ts::teamPh",
  "lib/goalscorer-fetch.ts::matchPh",
  // expirySqlExpr returns a constant SQL expr; the ISO timestamp it embeds is
  // quote-stripped (defensive) and comes from Stripe, not the user. Upgrade path:
  // pass the expiry as a bound $N param instead of interpolating (lib/plan-grant.ts).
  "lib/plan-grant.ts::expirySqlExpr(expiresAtIso)",
]);

function walk(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts") && !p.endsWith(".test.tsx")) acc.push(p);
  }
}

type Violation = { key: string; file: string; line: number; expr: string };

function scan(): Violation[] {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(join(REPO_ROOT, d), files);

  const violations: Violation[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = relative(REPO_ROOT, file);
    DB_INTERP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DB_INTERP_RE.exec(src)) !== null) {
      const expr = m[1].trim();
      const key = `${rel}::${expr}`;
      if (ALLOWLIST.has(key)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      violations.push({ key, file: rel, line, expr });
    }
  }
  return violations;
}

describe("SQL-guard: no template interpolation in dbQuery()/dbExecute() first arg", () => {
  it("finds no non-allowlisted ${…} inside a dbQuery/dbExecute SQL template", () => {
    const violations = scan();
    const report = violations
      .map((v) => `  ${v.file}:${v.line} → \${${v.expr}}  (key: "${v.key}")`)
      .join("\n");
    expect(
      violations,
      violations.length
        ? `\nPotential SQLi: template interpolation inside a dbQuery/dbExecute SQL string.\n` +
            `Bind values as $N params instead (lib/db.ts escapes those). If this is a\n` +
            `reviewed SQL fragment (placeholder list / static clause), add its key to\n` +
            `the ALLOWLIST in lib/sql-guard.test.ts.\n${report}\n`
        : undefined,
    ).toHaveLength(0);
  });
});
