// The data-access interface. The UI depends on this, never on a concrete source.
// To plug the dashboard into another backend (e.g. the CRM), implement
// GrowthSource there — the KPI logic and the UI stay untouched.

import type { ChainRow } from "@/core/channels";
import type { GrowthWindow } from "@/core/kpi";
import type { GrowthData, RawResults, Result, Row, SourceMeta } from "@/core/model";
import type { DailySeries, RawSeries } from "@/core/series";

/**
 * Filone A: daily series and the source chain. Optional so that a source (or
 * an older snapshot) without them still renders — the sections then say the
 * data is missing instead of showing zeros.
 * TODO(integrator): fold into GrowthData in core/model.ts.
 */
export interface GrowthExtras {
  trends?: DailySeries;
  chain?: Result<ChainRow[]>;
}

export interface GrowthSource {
  load(w: GrowthWindow): Promise<{ data: GrowthData & GrowthExtras; meta: SourceMeta }>;
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
  /** Daily rows per Europe/Rome day, same transaction (optional: older snapshots lack it). */
  series?: RawSeries;
  /** Source chain rows per window, labels already coarsened (optional). */
  chain?: Record<GrowthWindow, Result<Row[]>>;
}
