// The data-access interface. The UI depends on this, never on a concrete source.
// To plug the dashboard into another backend (e.g. the CRM), implement
// GrowthSource there — the KPI logic and the UI stay untouched.

import type { GrowthWindow } from "@/core/kpi";
import type { GrowthData, RawResults, SourceMeta } from "@/core/model";

export interface GrowthSource {
  load(w: GrowthWindow): Promise<{ data: GrowthData; meta: SourceMeta }>;
}

/** On-disk snapshot: raw aggregate rows per window, normalized at read time. */
export interface SnapshotFile {
  schema: 1;
  /** When the snapshot script finished (ISO). */
  generatedAt: string;
  /** The database's now() during the reads (ISO): windows are relative to this. */
  dbNow: string;
  origin: string;
  windows: Record<GrowthWindow, RawResults>;
}
