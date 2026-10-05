import type { GrowthSource } from "./source";
import { snapshotSource } from "./snapshot-source";

// Default and only path in the preview: the frozen snapshot.
// LIVE needs BOTH GROWTH_DATA_SOURCE=live and GROWTH_DATABASE_URL (a read-only
// role, see the PROPOSAL in README.md). Neither exists in the preview env.
let cached: GrowthSource | null = null; // one connection pool per server process

export async function getSource(): Promise<GrowthSource> {
  if (cached) return cached;
  if (process.env.GROWTH_DATA_SOURCE === "live") {
    const url = process.env.GROWTH_DATABASE_URL;
    if (!url) throw new Error("GROWTH_DATA_SOURCE=live ma GROWTH_DATABASE_URL non è impostata");
    const { liveSource } = await import("./live-source");
    cached = liveSource(url);
  } else {
    cached = snapshotSource();
  }
  return cached;
}
