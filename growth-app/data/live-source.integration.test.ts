// Runs only on a machine with DB access:
//   GROWTH_LIVE_ENV_FILE=~/Desktop/agentic-markets/.env npm test
// Proves the LIVE source reads, and that it CANNOT write.
import { describe, expect, it } from "vitest";
import { readEnvKey } from "../scripts/env";
import { connect, liveSource } from "./live-source";

const envFile = process.env.GROWTH_LIVE_ENV_FILE;
const url = envFile ? readEnvKey("DATABASE_URL", ["--env-file", envFile]) : undefined;

describe.skipIf(!url)("live source (integration, read-only)", () => {
  it("loads every query of a window without failures", async () => {
    const { data, meta } = await liveSource(url!).load("7d");
    expect(meta.kind).toBe("live");
    const failed = Object.entries(data).filter(([, v]) => typeof v === "object" && v !== null && "ok" in v && !v.ok);
    expect(failed.map(([k]) => k)).toEqual([]);
    // Filone A extras: every series read and the chain read succeeded.
    expect(data.trends?.errors).toEqual({});
    expect(data.chain?.ok).toBe(true);
  }, 60_000);

  it("a write inside its transaction is rejected by the server (25006)", async () => {
    const sql = connect(url!);
    try {
      // Harmless even if it ran: a temp table dies with the session. It must not run.
      await expect(sql.begin("read only", (tx) => tx.unsafe("CREATE TEMP TABLE growth_ro_probe (x int)"))).rejects.toMatchObject({
        code: "25006",
      });
    } finally {
      await sql.end();
    }
  }, 30_000);
});
