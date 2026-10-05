// Generates data/snapshot.json from the production DB — read-only, aggregates only.
//
//   npm run snapshot -- --env-file ~/Desktop/agentic-markets/.env
//
// All queries of all windows run in ONE repeatable-read READ ONLY transaction
// (data/live-source.ts → readAllWindows): every number refers to the same
// instant, recorded as dbNow. The file holds only aggregate rows (counts,
// sums, ages); free-text labels are coarsened (core/privacy.ts). Any failed
// query aborts: nothing is written.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { connect, readAllWindows } from "../data/live-source";
import type { SnapshotFile } from "../data/source";
import { readEnvKey } from "./env";

async function main() {
  const url = readEnvKey("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL non trovata (env o --env-file)");
  const sql = connect(url);
  try {
    const t0 = Date.now();
    const { dbNow, windows } = await readAllWindows(sql);
    const file: SnapshotFile = {
      schema: 1,
      generatedAt: new Date().toISOString(),
      dbNow,
      origin: "database di produzione BetRedge, letto in sola lettura (solo aggregati)",
      windows,
    };
    const out = join(__dirname, "..", "data", "snapshot.json");
    writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
    console.log(`snapshot scritto: ${out}`);
    console.log(`dbNow ${dbNow} · letture in ${((Date.now() - t0) / 1000).toFixed(1)}s, una sola transazione read-only`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("SNAPSHOT NON SCRITTO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
