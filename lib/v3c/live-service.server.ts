// lib/v3c/live-service.server.ts (#V3C-LIVESCORES) — builds GET /api/v3/live.
//
// Read-only end to end: one SELECT on unified_predictions (the board rows of
// the live window) and GETs to the ESPN scoreboards. No write, no settlement:
// /api/live (the old site) persists scores and settles; this endpoint never does.
//
// Cost control: scores are global, so one response serves every visitor. Each
// serverless instance keeps it LIVE_TTL_MS and shares the in-flight build; the
// route adds a CDN s-maxage on top. Only the ESPN scoreboards of leagues with a
// row in the window are read (usually 0–4 soccer slugs + 2 tennis scoreboards).
import { dbQueryStrict } from "@/lib/db";
import { ESPN_HEADERS, ESPN_SITE_API } from "@/lib/espn";
import { FOOTBALL_LEDGER_SOURCE_TABLE } from "@/lib/pick-ledger-mirror";
import type { V3LiveResponse } from "./live-contract";
import { parseEspnSoccer, parseEspnTennis, type EspnSoccerEvent, type EspnTennisMatch } from "./live-espn";
import { LIVE_LEAD_MIN, LIVE_WINDOW_MIN, buildLive, livePlan, type LiveRow } from "./live-match";
import { TENNIS_LEDGER_SOURCE_TABLE } from "./tennis";

export const LIVE_TTL_MS = 20_000;
const FETCH_TIMEOUT_MS = 5_000;

/** Test/mock hook: the local mock server serves fictitious scoreboards (scripts/v3c/mock-db.ts). */
function espnBase(): string {
  return process.env.V3C_LIVE_ESPN_BASE || ESPN_SITE_API;
}

export async function fetchLiveRows(): Promise<LiveRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `SELECT source_id, source_table, league, starts_at, home_team, away_team
       FROM unified_predictions
      WHERE starts_at > NOW() - ($1 || ' minutes')::interval
        AND starts_at < NOW() + ($2 || ' minutes')::interval
        AND published_at IS NOT NULL
        AND is_historical = FALSE
        AND is_demo = FALSE
        AND source_table IN ($3, $4)`,
    [String(LIVE_WINDOW_MIN), String(LIVE_LEAD_MIN), FOOTBALL_LEDGER_SOURCE_TABLE, TENNIS_LEDGER_SOURCE_TABLE],
  );
  return rows
    .filter((r) => r.source_id && r.home_team && r.away_team && r.starts_at)
    .map((r) => ({
      id: String(r.source_id),
      sport: r.source_table === TENNIS_LEDGER_SOURCE_TABLE ? ("tennis" as const) : ("football" as const),
      league: (r.league as string) ?? null,
      kickoff: new Date(String(r.starts_at)).toISOString(),
      home: String(r.home_team),
      away: String(r.away_team),
    }));
}

async function getJson(url: string, label: string, failed: string[]): Promise<unknown | null> {
  try {
    const r = await fetch(url, { headers: ESPN_HEADERS, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!r.ok) {
      failed.push(`${label}:${r.status}`);
      return null;
    }
    return await r.json();
  } catch (e) {
    failed.push(`${label}:${e instanceof Error ? e.name : "error"}`);
    return null;
  }
}

export async function computeLive(now = new Date()): Promise<V3LiveResponse> {
  const rows = await fetchLiveRows();
  const plan = livePlan(rows, now);
  const failed: string[] = [];
  const base = espnBase();
  const soccerJobs = [...plan.soccer.entries()].flatMap(([slug, days]) =>
    days.map(async (d) => ({ slug, events: parseEspnSoccer(await getJson(`${base}/soccer/${slug}/scoreboard?dates=${d}`, `soccer/${slug}/${d}`, failed)) })),
  );
  const tennisJobs = plan.tennisDays.flatMap((d) =>
    (["atp", "wta"] as const).map(async (tour) => {
      const data = await getJson(`${base}/tennis/${tour}/scoreboard?dates=${d}`, `tennis/${tour}/${d}`, failed);
      return data == null ? null : parseEspnTennis(data);
    }),
  );
  const [soccerRes, tennisRes] = await Promise.all([Promise.all(soccerJobs), Promise.all(tennisJobs)]);
  const soccer = new Map<string, EspnSoccerEvent[]>();
  for (const { slug, events } of soccerRes) {
    const list = soccer.get(slug) ?? [];
    for (const e of events) if (!list.some((x) => x.id === e.id)) list.push(e);
    soccer.set(slug, list);
  }
  const tennis: EspnTennisMatch[] = tennisRes.flatMap((x) => x ?? []);
  return buildLive(rows, { soccer, tennis, tennisRead: tennisRes.some((x) => x != null), failed }, now);
}

let cache: { at: number; data: V3LiveResponse } | null = null;
let inflight: Promise<V3LiveResponse> | null = null;

/** The shared response: fresh for LIVE_TTL_MS, one build at a time per instance. */
export async function getLive(): Promise<V3LiveResponse> {
  if (cache && Date.now() - cache.at < LIVE_TTL_MS) return cache.data;
  if (!inflight) {
    inflight = computeLive()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Tests only. */
export function _resetLiveCache(): void {
  cache = null;
  inflight = null;
}
