import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// #PICK-STALE-0822 — every field that can arrive LATE must be in the
// ON CONFLICT ... DO UPDATE SET list of each sync adapter.
//
// This family of bugs has now shipped three times, always the same way: a
// fixture is inserted the moment it is scheduled, which is before odds and
// before a selection exist, so the first INSERT writes NULL. Later syncs
// refresh whatever happens to be listed and silently keep the stale NULL for
// everything that is not. Found on tennis `bookmaker` (04/08: 23 rows labelled
// "no market" while carrying a real price), on tennis `pick`, and on football
// `pick` (22/08: 10 of 53 future above-floor rows carried a pick, while
// match_predictions held a correct favourite for 39 of them — e.g. Rangers v
// St Mirren, HOME @1.30, confidence 67, served as pick NULL).
//
// A missing column is invisible in review — it is an absence, not a wrong line
// — so it is asserted mechanically on the SQL text.
//
// NB co-located under lib/ on purpose: vitest.config.ts `include` is
// {app,lib,components,features}/**/*.test.ts, so a file in tests/ would never run.

const LATE_ARRIVING = [
  "pick",
  "bookmaker",
  "odds",
  "edge_percent",
  "confidence_score",
  "signal_type",
  "is_paper",
];

// Columns that identify the row or record a graded outcome: a re-sync must
// never rewrite them.
const FROZEN = ["source_table", "source_id", "settled_at", "sport"];

// Returns the set of column names assigned in the DO UPDATE SET list.
// Deliberately regex-free: it strips SQL line comments, then reads the
// left-hand side of each assignment.
function assignedColumns(file: string): Set<string> {
  const src = readFileSync(join(process.cwd(), "lib", file), "utf8");
  const start = src.indexOf("DO UPDATE SET");
  expect(start, `${file}: no ON CONFLICT ... DO UPDATE SET found`).toBeGreaterThan(-1);
  const end = src.indexOf("`", start);
  expect(end, `${file}: unterminated SQL template literal`).toBeGreaterThan(start);

  const cols = new Set<string>();
  const NEWLINE = String.fromCharCode(10);
  for (const rawLine of src.slice(start, end).split(NEWLINE)) {
    const code = rawLine.split("--")[0];
    const eq = code.indexOf("=");
    if (eq < 0) continue;
    const lhs = code.slice(0, eq).trim();
    // A bare identifier only — skips "DO UPDATE SET" itself and any
    // expression-valued left side.
    if (lhs.length > 0 && !lhs.includes(" ") && !lhs.includes("(")) cols.add(lhs);
  }
  return cols;
}

describe("#PICK-STALE-0822 — late-arriving columns are refreshed on conflict", () => {
  for (const file of ["unified-adapter.ts", "tennis-adapter.ts"]) {
    describe(file, () => {
      const cols = assignedColumns(file);

      it("parses a non-trivial assignment list", () => {
        expect(cols.size).toBeGreaterThan(5);
      });

      for (const col of LATE_ARRIVING) {
        it(`refreshes ${col}`, () => {
          expect(
            cols.has(col),
            `${col} is missing from the DO UPDATE SET list in lib/${file}: a row ` +
              `first written without it keeps the stale value forever. ` +
              `Assigned: ${[...cols].sort().join(", ")}`
          ).toBe(true);
        });
      }

      it("does not reassign identity or settlement columns", () => {
        for (const frozen of FROZEN) {
          expect(
            cols.has(frozen),
            `${frozen} must not be reassigned on conflict in lib/${file}`
          ).toBe(false);
        }
      });
    });
  }
});
