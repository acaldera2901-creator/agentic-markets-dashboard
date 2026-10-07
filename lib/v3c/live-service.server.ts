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
//
// live2 (#V3C-LIVE2): football rows ESPN leaves without a score are then looked
// up in API-Football (`live=all`, one request for every match in play) and in
// The Odds API `/scores` (only the sport keys of those rows), each behind its own
// LiveBudget (quota, interval, backoff); see lib/v3c/live-fuse.ts for matching
// and merging. Tennis stays ESPN-only: no licensed ITF/Challenger feed is
// configured (docs/redesign/livescores.md).
import { dbQueryStrict } from "@/lib/db";
import { SPORT_KEYS } from "@/lib/odds-api";
import { ODDS_RESERVE } from "@/lib/odds-quota";
import { ESPN_HEADERS, ESPN_SITE_API } from "@/lib/espn";
import { FOOTBALL_LEDGER_SOURCE_TABLE } from "@/lib/pick-ledger-mirror";
import type { V3LiveItem, V3LiveResponse, V3LiveSourceId, V3LiveSourceStatus } from "./live-contract";
import { apiFootballAuth, parseApiFootballLive, type SourceSoccerEvent } from "./live-apifootball";
import { SOURCE_NAMES, SOURCE_ORDER, fuse, matchSourceEvent, oddsApiIdOf, sourceItem } from "./live-fuse";
import { parseOddsApiScores } from "./live-oddsapi";
import { LiveBudget, envInt, headerInt, type BudgetVerdict } from "./live-quota";
import { parseEspnSoccer, parseEspnTennis, type EspnSoccerEvent, type EspnTennisMatch } from "./live-espn";
import { LIVE_LEAD_MIN, LIVE_WINDOW_MIN, buildLive, espnIdOf, inLiveWindow, livePlan, soccerSlugFor, type LiveRow } from "./live-match";
import { TENNIS_LEDGER_SOURCE_TABLE } from "./tennis";
import { wantsLive } from "./live-view";

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

// ─── live2: the fallback sources (football) ──────────────────────────────────

/** How long a source's last good read may still be shown (its age is in each item's updated_at). */
const APIF_MAX_AGE_MS = 15 * 60_000;
const ODDS_MAX_AGE_MS = 5 * 60_000;
/** A row kicked off longer ago than this may already be over: The Odds API lists finished games only with daysFrom (2 credits). */
const ODDS_FINISHED_AFTER_MS = 100 * 60_000;

type SourceCache = { at: number; events: SourceSoccerEvent[] };
type Fallbacks = {
  apif: LiveBudget;
  odds: LiveBudget;
  apifCache: SourceCache | null;
  oddsCache: Map<string, SourceCache>;
};

/**
 * Defaults sized for what is in Production on 07/10 (env knobs override them):
 *   API-Football Free = 100 requests/day shared with the Python pipeline →
 *     ≤ 40/day for live, one read every 5 min, stop when ≤ 25 are left;
 *     with the Pro plan (7,500/day) set LIVE_APIF_DAILY=4000, LIVE_APIF_MIN_INTERVAL_S=20.
 *   The Odds API = 5M credits/month (≈ 4.93M left) → ≤ 20,000 credits/day for live,
 *     one read per sport key every 30 s, stop at the same reserve as the odds cron (ODDS_RESERVE).
 */
function newFallbacks(): Fallbacks {
  return {
    apif: new LiveBudget({ dailyBudget: envInt("LIVE_APIF_DAILY", 40), minIntervalMs: envInt("LIVE_APIF_MIN_INTERVAL_S", 300) * 1000, reserve: envInt("LIVE_APIF_RESERVE", 25) }),
    odds: new LiveBudget({ dailyBudget: envInt("LIVE_ODDS_DAILY", 20_000), minIntervalMs: envInt("LIVE_ODDS_MIN_INTERVAL_S", 30) * 1000, reserve: envInt("LIVE_ODDS_RESERVE", ODDS_RESERVE) }),
    apifCache: null,
    oddsCache: new Map(),
  };
}
let fb: Fallbacks | null = null;
function fallbacks(): Fallbacks {
  return (fb ??= newFallbacks());
}

/** Test/mock hooks: the local mock server serves fictitious feeds (scripts/v3c/mock-db.ts). */
function apifBase(real: string): string {
  return process.env.V3C_LIVE_APIF_BASE || real;
}
function oddsBase(): string {
  return process.env.V3C_LIVE_ODDS_BASE || "https://api.the-odds-api.com/v4";
}

const VERDICT_REASON: Record<Exclude<BudgetVerdict, "ok" | "interval">, string> = {
  backoff: "backing off after an error",
  reserve: "provider quota almost spent: live reads paused to leave it to the pipeline",
  budget: "daily live budget reached",
};

type Read = { events: SourceSoccerEvent[] | null; verdict: BudgetVerdict; fetched: boolean };

/** One budgeted GET (or the cached copy). Never throws; the URL (which may carry a key) is never logged. */
async function budgetedRead(
  budget: LiveBudget,
  resource: string,
  cost: number,
  cached: SourceCache | null | undefined,
  maxAgeMs: number,
  label: string,
  failed: string[],
  doFetch: () => Promise<Response>,
  parse: (data: unknown, at: string) => SourceSoccerEvent[],
  remainingHeader: string,
  nowMs: number,
  store: (c: SourceCache) => void,
): Promise<Read> {
  const fresh = cached && nowMs - cached.at < maxAgeMs ? cached.events : null;
  const verdict = budget.check(nowMs, resource, cost);
  if (verdict !== "ok") return { events: fresh, verdict, fetched: false };
  try {
    const r = await doFetch();
    const remaining = headerInt(r.headers, remainingHeader);
    const last = headerInt(r.headers, "x-requests-last");
    if (!r.ok) {
      const retry = headerInt(r.headers, "retry-after");
      budget.record(nowMs, { ok: false, resource, cost: last ?? cost, remaining, retryAfterMs: retry != null ? retry * 1000 : null });
      failed.push(`${label}:${r.status}`);
      return { events: fresh, verdict: "backoff", fetched: false };
    }
    const data = await r.json();
    // API-Football answers 200 with `errors` (bad key, plan limits, rate limit): a failure, not an empty list
    const errs = (data as { errors?: unknown } | null)?.errors;
    if (errs && ((Array.isArray(errs) && errs.length) || (!Array.isArray(errs) && typeof errs === "object" && Object.keys(errs).length))) {
      budget.record(nowMs, { ok: false, resource, cost, remaining });
      failed.push(`${label}:errors`);
      return { events: fresh, verdict: "backoff", fetched: false };
    }
    budget.record(nowMs, { ok: true, resource, cost: last ?? cost, remaining });
    const events = parse(data, new Date(nowMs).toISOString());
    store({ at: nowMs, events });
    return { events, verdict: "ok", fetched: true };
  } catch (e) {
    budget.record(nowMs, { ok: false, resource, cost });
    failed.push(`${label}:${e instanceof Error ? e.name : "error"}`);
    return { events: fresh, verdict: "backoff", fetched: false };
  }
}

function status(id: V3LiveSourceId, state: V3LiveSourceStatus["state"], reason: string | null, budget: LiveBudget | null, items: number): V3LiveSourceStatus {
  const snap = budget?.snapshot();
  return { id, name: SOURCE_NAMES[id], state, reason, calls_today: snap?.used ?? 0, budget_day: snap?.budget ?? null, remaining: snap?.remaining ?? null, items };
}

export async function computeLive(now = new Date()): Promise<V3LiveResponse> {
  const rows = await fetchLiveRows();
  const plan = livePlan(rows, now);
  const failed: string[] = [];
  const base = espnBase();
  const readAt = now.toISOString();
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
  const out = buildLive(rows, { soccer, tennis, tennisRead: tennisRes.some((x) => x != null), failed, readAt }, now);
  return addFallbacks(out, rows, now, failed);
}

/** live2: API-Football and The Odds API for the football rows ESPN left without a score; then the merge and the honest coverage. */
async function addFallbacks(out: V3LiveResponse, rows: readonly LiveRow[], now: Date, failed: string[]): Promise<V3LiveResponse> {
  const f = fallbacks();
  const nowMs = now.getTime();
  const football = inLiveWindow(rows, now).filter((r) => r.sport === "football");
  // only rows already kicked off (or about to) and still without a score are worth a paid read
  const need = football.filter((r) => !out.items[r.id] && Date.parse(r.kickoff) <= nowMs + 5 * 60_000);

  // API-Football: one request covers every match in play
  const auth = apiFootballAuth(process.env);
  let apifEvents: SourceSoccerEvent[] = [];
  let apifState: V3LiveSourceStatus["state"] = auth ? "idle" : "off";
  let apifReason: string | null = auth ? null : "no API-Football key configured";
  if (auth && need.length) {
    const r = await budgetedRead(
      f.apif, "live=all", 1, f.apifCache, APIF_MAX_AGE_MS, "api-football/live", failed,
      () => fetch(`${apifBase(auth.base)}/fixtures?live=all`, { headers: auth.headers, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
      parseApiFootballLive, "x-ratelimit-requests-remaining", nowMs, (c) => { f.apifCache = c; },
    );
    apifEvents = r.events ?? [];
    apifState = r.verdict === "ok" || r.verdict === "interval" ? "ok" : "degraded";
    apifReason = r.verdict === "ok" || r.verdict === "interval" ? null : VERDICT_REASON[r.verdict];
  }

  // The Odds API: only the sport keys of the rows still without a score
  const oddsKey = process.env.ODDS_API_KEY?.trim();
  const byKey = new Map<string, LiveRow[]>();
  for (const r of need) {
    const k = r.league ? SPORT_KEYS[r.league.trim().toUpperCase()] : undefined;
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const oddsEvents = new Map<string, SourceSoccerEvent[]>();
  let oddsState: V3LiveSourceStatus["state"] = oddsKey ? "idle" : "off";
  let oddsReason: string | null = oddsKey ? null : "no The Odds API key configured";
  if (oddsKey && byKey.size) {
    const reads = await Promise.all(
      [...byKey.entries()].map(async ([sk, rs]) => {
        const finished = rs.some((r) => nowMs - Date.parse(r.kickoff) > ODDS_FINISHED_AFTER_MS);
        const qs = `apiKey=${encodeURIComponent(oddsKey)}${finished ? "&daysFrom=1" : ""}`;
        const r = await budgetedRead(
          f.odds, sk, finished ? 2 : 1, f.oddsCache.get(sk), ODDS_MAX_AGE_MS, `odds-api/scores/${sk}`, failed,
          () => fetch(`${oddsBase()}/sports/${sk}/scores?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
          (data) => parseOddsApiScores(data, now), "x-requests-remaining", nowMs, (c) => { f.oddsCache.set(sk, c); },
        );
        if (r.events) oddsEvents.set(sk, r.events);
        return r.verdict;
      }),
    );
    const bad = reads.find((v) => v !== "ok" && v !== "interval") as Exclude<BudgetVerdict, "ok" | "interval"> | undefined;
    oddsState = bad ? "degraded" : "ok";
    oddsReason = bad ? VERDICT_REASON[bad] : null;
  }

  // merge, one board row at a time
  const items: Record<string, V3LiveItem> = { ...out.items };
  for (const r of need) {
    const cands: V3LiveItem[] = [];
    const ah = matchSourceEvent(r, apifEvents, null);
    if (ah) cands.push(sourceItem(ah, "api_football", now.toISOString()));
    const sk = r.league ? SPORT_KEYS[r.league.trim().toUpperCase()] : undefined;
    const oh = sk ? matchSourceEvent(r, oddsEvents.get(sk) ?? [], oddsApiIdOf(r)) : null;
    if (oh) cands.push(sourceItem(oh, "odds_api", now.toISOString()));
    const best = fuse(cands);
    if (best) items[r.id] = best;
  }

  // coverage, recounted over every source
  const cov = { rows: 0, matched: 0, no_source: 0, unmatched: 0 };
  for (const r of football) {
    cov.rows += 1;
    const covered = Boolean(espnIdOf(r) || soccerSlugFor(r.league) || (auth && apifState !== "degraded") || (oddsKey && r.league && SPORT_KEYS[r.league.trim().toUpperCase()]));
    if (items[r.id]) cov.matched += 1;
    else if (!covered) cov.no_source += 1;
    else cov.unmatched += 1;
  }
  const count = (id: V3LiveSourceId) => Object.values(items).filter((x) => x.source === id).length;
  const espnFailed = failed.some((x) => x.startsWith("soccer/") || x.startsWith("tennis/"));
  const sources: V3LiveSourceStatus[] = [
    status("espn", espnFailed ? "degraded" : "ok", espnFailed ? "a scoreboard did not answer (see coverage.failed_feeds)" : null, null, count("espn")),
    status("api_football", apifState, apifReason, auth ? f.apif : null, count("api_football")),
    status("odds_api", oddsState, oddsReason, oddsKey ? f.odds : null, count("odds_api")),
  ];
  const used = SOURCE_ORDER.filter((id) => count(id) > 0).map((id) => SOURCE_NAMES[id]);
  return {
    ...out,
    source: { name: used.length ? used.join(" + ") : "ESPN", note: LIVE_SOURCES_NOTE },
    sources,
    degraded: sources.some((x) => x.state === "degraded"),
    items,
    coverage: { ...out.coverage, football: cov, failed_feeds: [...failed] },
  };
}

const LIVE_SOURCES_NOTE =
  "Scores from ESPN's public scoreboards, API-Football and The Odds API, each read at most every 20 s–5 min within its quota and re-oriented to our home/away. Each score carries its source and time. Information only: never part of the sealed record, the estimates or the settlement.";

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

/** final2: how long a page rendered per request waits for the first live read before rendering without it. */
export const SEED_WAIT_MS = 1_500;

/**
 * final2: the first live read, done by the page itself (home, board, match are rendered
 * per request), so the score is already in the HTML and nothing is pushed down when the
 * browser's first poll lands (CLS). Only when a match is around kick-off (wantsLive);
 * same shared getLive() cache as the route; slow or failing → null and the browser
 * reads /api/v3/live as before.
 */
export async function liveSeed(kickoffs: readonly string[], now: Date): Promise<V3LiveResponse | null> {
  if (!kickoffs.some((k) => wantsLive(k, now))) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([getLive(), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), SEED_WAIT_MS); })]);
  } catch (e) {
    console.error("[v3c/live seed]", String(e));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Tests only. */
export function _resetLiveCache(): void {
  cache = null;
  inflight = null;
  fb = null;
}
