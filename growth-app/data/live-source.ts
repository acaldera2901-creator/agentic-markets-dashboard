// LIVE source: runs core/sql.ts against Postgres, every query inside its own
// READ ONLY transaction. Even with a credential that could write, the server
// rejects any write in these transactions (SQLSTATE 25006).
//
// Not enabled in the preview: see data/index.ts and the PROPOSAL in README.md.

import postgres from "postgres";
import { type GrowthWindow, WINDOWS } from "@/core/kpi";
import { type RawResults, type Result, type Row, normalize } from "@/core/model";
import { mergeChain, normalizeChain } from "@/core/channels";
import { coarsenRows } from "@/core/privacy";
import { type RawSeries, normalizeSeries } from "@/core/series";
import { LIST_KEYS, type QueryKey, SCALAR_KEYS, SERIES_KEYS, buildChainSql, buildSeriesSql, buildSql } from "@/core/sql";
import type { GrowthSource } from "./source";

const STATEMENT_TIMEOUT_MS = 60_000;

/** The repo .env keeps DATABASE_URL in SQLAlchemy form; postgres.js needs plain libpq. */
export function normalizeDbUrl(raw: string | undefined): string {
  const url = (raw ?? "").trim().replace(/^["']|["']$/g, "");
  if (!url) throw new Error("DATABASE_URL assente");
  const m = url.match(/^postgres(?:ql)?\+(?:asyncpg|psycopg2?|psycopg):\/\//);
  if (m) return "postgresql://" + url.slice(m[0].length);
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("DATABASE_URL: schema non riconosciuto");
  return url;
}

export type Sql = ReturnType<typeof postgres>;

export function connect(url: string): Sql {
  // prepare:false — Supabase's pooler (transaction mode) does not keep
  // prepared statements across transactions.
  return postgres(normalizeDbUrl(url), { max: 4, prepare: false, connect_timeout: 10, idle_timeout: 5 });
}

async function readOnly(sql: Sql, query: string): Promise<Result<Row[]>> {
  try {
    const rows = await sql.begin("read only", async (tx) => {
      await tx.unsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      return tx.unsafe(query);
    });
    return { ok: true, data: rows.map((r) => ({ ...r })) };
  } catch (e) {
    console.error("[growth/live] query failed:", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "lettura fallita" };
  }
}

const KEYS: QueryKey[] = [...SCALAR_KEYS, ...LIST_KEYS];

/** Free-text labels are coarsened before they leave this module (snapshot or page). */
function sanitize(raw: RawResults): RawResults {
  if (raw.sources.ok) raw.sources = { ok: true, data: coarsenRows(raw.sources.data, "source", "sessions") };
  if (raw.channels.ok) raw.channels = { ok: true, data: coarsenRows(raw.channels.data, "channel", "n") };
  return raw;
}

/** Live page load: one read-only transaction per query, so one failure stays one ERRORE tile. */
export async function readRaw(sql: Sql, w: GrowthWindow): Promise<RawResults> {
  const q = buildSql(w);
  const results = await Promise.all(KEYS.map((k) => readOnly(sql, q[k])));
  return sanitize(Object.fromEntries(KEYS.map((k, i) => [k, results[i]])) as RawResults);
}

/**
 * Snapshot: every query of every window inside ONE repeatable-read, read-only
 * transaction — all numbers see the same data and the same now(). Any failure
 * aborts the whole snapshot (a snapshot with holes must not ship).
 */
export async function readAllWindows(sql: Sql): Promise<{
  dbNow: string;
  windows: Record<GrowthWindow, RawResults>;
  series: RawSeries;
  chain: Record<GrowthWindow, Result<Row[]>>;
}> {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    await tx.unsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const [{ now }] = await tx.unsafe("SELECT now() AS now");
    const windows = {} as Record<GrowthWindow, RawResults>;
    const chain = {} as Record<GrowthWindow, Result<Row[]>>;
    for (const { key } of WINDOWS) {
      const q = buildSql(key);
      const raw = {} as RawResults;
      for (const k of KEYS) raw[k] = { ok: true, data: (await tx.unsafe(q[k])).map((r) => ({ ...r })) };
      windows[key] = sanitize(raw);
      // Labels coarsened BEFORE they reach the snapshot file.
      chain[key] = { ok: true, data: mergeChain((await tx.unsafe(buildChainSql(key))).map((r) => ({ ...r }))) };
    }
    const sq = buildSeriesSql();
    const series = {} as RawSeries;
    for (const k of SERIES_KEYS) series[k] = { ok: true, data: (await tx.unsafe(sq[k])).map((r) => ({ ...r })) };
    return { dbNow: new Date(now as string | Date).toISOString(), windows, series, chain };
  });
}

/** Live page load of the Filone A extras, each query in its own read-only transaction. */
export async function readExtras(sql: Sql, w: GrowthWindow, asOf: string) {
  const sq = buildSeriesSql();
  const [chainRaw, ...seriesRaw] = await Promise.all([readOnly(sql, buildChainSql(w)), ...SERIES_KEYS.map((k) => readOnly(sql, sq[k]))]);
  const series = Object.fromEntries(SERIES_KEYS.map((k, i) => [k, seriesRaw[i]])) as RawSeries;
  return { trends: normalizeSeries(series, asOf), chain: normalizeChain(chainRaw) };
}

/** The database clock, so a snapshot records the instant its windows refer to. */
export async function dbNow(sql: Sql): Promise<string> {
  const [r] = await sql.begin("read only", (tx) => tx.unsafe("SELECT now() AS now"));
  return new Date(r.now as string | Date).toISOString();
}

export function liveSource(url: string): GrowthSource {
  const sql = connect(url);
  return {
    async load(w) {
      const asOf = await dbNow(sql);
      const [raw, extras] = await Promise.all([readRaw(sql, w), readExtras(sql, w, asOf)]);
      return { data: { ...normalize(w, raw), ...extras }, meta: { kind: "live", asOf, origin: "database di produzione, lettura diretta (sola lettura)" } };
    },
  };
}
