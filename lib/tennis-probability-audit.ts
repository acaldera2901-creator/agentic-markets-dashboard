import { resolveTennisProbability, validTennisPair, type TennisProbabilityInput, type TennisProbabilitySource } from "./tennis-probability";

export type TennisAuditSnapshot = TennisProbabilityInput & {
  match_id: string;
  snapshot_at: string;
  kickoff: string;
  published_p1?: number | null;
  published_p2?: number | null;
  result?: string | null;
};

type Observation = { before: number; after: number; outcome: number };
const SOURCES: TennisProbabilitySource[] = ["model", "market", "unknown"];

function timestamp(value: unknown): number | null {
  // A local clock without a zone cannot establish no-look-ahead.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day
      || Number(value.slice(11,13)) > 23 || Number(value.slice(14,16)) > 59 || Number(value.slice(17,19)) > 59) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().filter(k => obj[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

function metrics(rows: Observation[], field: "before" | "after") {
  if (!rows.length) return null;
  const bins = Array.from({ length: 10 }, (_, i) => ({ lower: i / 10, upper: (i + 1) / 10, count: 0, sum: 0, outcomes: 0 }));
  let brier = 0, logLoss = 0;
  for (const row of rows) {
    const p = row[field], y = row.outcome;
    brier += (p - y) ** 2; // Binary P1 Brier, not the sum across both sides.
    const clipped = Math.max(1e-15, Math.min(1 - 1e-15, p));
    logLoss -= y * Math.log(clipped) + (1 - y) * Math.log(1 - clipped);
    const bin = bins[Math.min(9, Math.floor(p * 10))];
    bin.count++; bin.sum += p; bin.outcomes += y;
  }
  return {
    count: rows.length, brier: brier / rows.length, log_loss: logLoss / rows.length,
    bins: bins.map(b => ({ lower: b.lower, upper: b.upper, count: b.count,
      mean_probability: b.count ? b.sum / b.count : null,
      observed_rate: b.count ? b.outcomes / b.count : null })),
  };
}

/** Local replay only. Changes require an actual prior published pair; accuracy
 * comparisons use identical settled rows with that baseline in each source group.
 * Eligibility describes snapshot timing/validity, not a new betting policy.
 */
export function auditTennisProbability(input: readonly TennisAuditSnapshot[]) {
  const exclusions = { invalid_identity: 0, invalid_timestamp: 0, invalid_probability: 0,
    not_pre_kickoff: 0, superseded_or_duplicate: 0, ambiguous_tie: 0 };
  const grouped = new Map<string, Array<{ row: TennisAuditSnapshot; time: number }>>();
  for (const row of input) {
    if (!row || typeof row.match_id !== "string" || !row.match_id.trim()) { exclusions.invalid_identity++; continue; }
    const time = timestamp(row.snapshot_at), kickoff = timestamp(row.kickoff);
    if (time === null || kickoff === null) { exclusions.invalid_timestamp++; continue; }
    if (time >= kickoff) { exclusions.not_pre_kickoff++; continue; }
    if (!validTennisPair(row.p1, row.p2)) { exclusions.invalid_probability++; continue; }
    const entries = grouped.get(row.match_id) ?? [];
    entries.push({ row, time }); grouped.set(row.match_id, entries);
  }
  const selected: TennisAuditSnapshot[] = [];
  for (const entries of grouped.values()) {
    const latest = entries.reduce((max, e) => Math.max(max, e.time), -Infinity);
    const tied = entries.filter(e => e.time === latest);
    // Equal instants written with distinct zone offsets are the same snapshot.
    const signatures = new Set(tied.map(e => canonical({ ...e.row, snapshot_at: e.time, kickoff: timestamp(e.row.kickoff) })));
    if (signatures.size !== 1) { exclusions.ambiguous_tie += entries.length; continue; }
    selected.push(tied[0].row);
    exclusions.superseded_or_duplicate += entries.length - 1;
  }
  const groups = Object.fromEntries(SOURCES.map(source => [source, { eligible: 0, answered: 0, observations: [] as Observation[] }])) as Record<TennisProbabilitySource, { eligible: number; answered: number; observations: Observation[] }>;
  let answered = 0, invalidOutcome = 0, missingBaseline = 0, compared = 0, changed = 0, delta = 0, absDelta = 0;
  for (const row of selected) {
    const resolved = resolveTennisProbability(row);
    const group = groups[resolved.source]; group.eligible++;
    const settled = row.result === "P1" || row.result === "P2";
    if (settled) { answered++; group.answered++; }
    else if (row.result != null) invalidOutcome++;
    if (!validTennisPair(row.published_p1, row.published_p2)) { missingBaseline++; continue; }
    compared++;
    const d = resolved.published!.p1 - row.published_p1!;
    delta += d; absDelta += Math.abs(d);
    if (Math.abs(d) > 1e-12 || Math.abs(resolved.published!.p2 - row.published_p2!) > 1e-12) changed++;
    if (settled) group.observations.push({ before: row.published_p1!, after: resolved.published!.p1, outcome: row.result === "P1" ? 1 : 0 });
  }
  return {
    version: "tennis-probability-audit-v1",
    counts: { input: input.length, eligible: selected.length, excluded: input.length - selected.length,
      unknown: groups.unknown.eligible, answered, invalid_outcome: invalidOutcome, missing_baseline: missingBaseline },
    exclusions,
    changes: { compared, changed, mean_delta_p1: compared ? delta / compared : null,
      mean_absolute_delta_p1: compared ? absDelta / compared : null },
    by_source: Object.fromEntries(SOURCES.map(source => {
      const g = groups[source];
      return [source, { eligible: g.eligible, answered: g.answered, paired: g.observations.length,
        before: metrics(g.observations, "before"), after: metrics(g.observations, "after") }];
    })) as Record<TennisProbabilitySource, { eligible: number; answered: number; paired: number;
      before: ReturnType<typeof metrics>; after: ReturnType<typeof metrics> }>,
  };
}
