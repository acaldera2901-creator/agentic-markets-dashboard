import { WINDOWS } from "@/core/kpi";
import { normalize } from "@/core/model";
import snapshotJson from "./snapshot.json";
import type { GrowthSource, SnapshotFile } from "./source";

export function assertSnapshot(f: unknown): SnapshotFile {
  const s = f as Partial<SnapshotFile> | null;
  if (!s || s.schema !== 1) throw new Error("snapshot: schema sconosciuto");
  if (!s.dbNow || Number.isNaN(Date.parse(s.dbNow))) throw new Error("snapshot: dbNow mancante");
  for (const { key } of WINDOWS) {
    if (!s.windows?.[key]) throw new Error(`snapshot: finestra ${key} mancante`);
  }
  return s as SnapshotFile;
}

/** Frozen numbers read from a JSON produced by scripts/snapshot.ts. */
export function snapshotSource(file: unknown = snapshotJson): GrowthSource {
  const snap = assertSnapshot(file);
  return {
    async load(w) {
      return {
        data: normalize(w, snap.windows[w]),
        meta: { kind: "snapshot", asOf: snap.dbNow, origin: snap.origin },
      };
    },
  };
}
