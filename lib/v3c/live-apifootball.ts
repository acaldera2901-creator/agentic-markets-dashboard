// lib/v3c/live-apifootball.ts (#V3C-LIVE2) — PURE parsing of API-Football
// `GET /fixtures?live=all` (one request = every match in play worldwide, with
// minute, goals and events). No network here: the service fetches.
//
// Shape recorded 07/10 (tests/fixtures/live-sources/apifootball-live-all-20261007.json).
// Anything unreadable is dropped — a score we cannot read is no score, never a 0.
//
// Own goals are NOT turned into events: whether API-Football files an own goal
// under the scorer's team or the team it counts for is not verified here, and a
// goal on the wrong side would be a made-up fact. The scoreline is unaffected.
import type { V3LiveState } from "./live-contract";
import type { EspnSoccerEvent } from "./live-espn";

/** A soccer event from any source, ESPN-shaped, plus when the source refreshed it. */
export type SourceSoccerEvent = EspnSoccerEvent & { updatedAt: string | null };

type RawFixture = {
  fixture?: { id?: unknown; date?: string; status?: { short?: string; elapsed?: unknown; extra?: unknown } };
  league?: { name?: string; country?: string };
  teams?: { home?: { id?: unknown; name?: string }; away?: { id?: unknown; name?: string } };
  goals?: { home?: unknown; away?: unknown };
  score?: { penalty?: { home?: unknown; away?: unknown } };
  events?: { time?: { elapsed?: unknown; extra?: unknown }; team?: { id?: unknown }; player?: { name?: string | null }; type?: string; detail?: string; comments?: string | null }[];
};

const LIVE = new Set(["1H", "2H", "ET", "LIVE", "P"]);
const BREAK = new Set(["HT", "BT"]);
const OFF = new Set(["PST", "CANC", "ABD", "SUSP", "INT", "AWD", "WO"]);

/** API-Football short status → our state (null = unknown, dropped). */
export function apifState(short: string | undefined): V3LiveState | null {
  const s = String(short ?? "");
  if (s === "NS" || s === "TBD") return "pre";
  if (LIVE.has(s)) return "live";
  if (BREAK.has(s)) return "break";
  if (s === "FT" || s === "AET" || s === "PEN") return "final";
  if (OFF.has(s)) return "off";
  return null;
}

function int(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < 1000 ? raw : null;
}

/** «67'» or «90'+4'», from elapsed + extra. */
export function apifMinute(elapsed: unknown, extra: unknown): string | null {
  const e = int(elapsed);
  if (e == null || e === 0) return null;
  const x = int(extra);
  return x ? `${e}'+${x}'` : `${e}'`;
}

export function parseApiFootballLive(data: unknown, fetchedAt: string): SourceSoccerEvent[] {
  const list = (data as { response?: unknown[] } | null)?.response;
  if (!Array.isArray(list)) return [];
  const out: SourceSoccerEvent[] = [];
  for (const raw of list) {
    const f = raw as RawFixture;
    const id = f?.fixture?.id;
    const date = f?.fixture?.date;
    const hn = f?.teams?.home?.name;
    const an = f?.teams?.away?.name;
    const short = f?.fixture?.status?.short;
    const state = apifState(short);
    if (id == null || !date || !hn || !an || !state) continue;
    const started = state !== "pre";
    const final_kind = state !== "final" ? null : short === "PEN" ? "pen" : short === "AET" ? "aet" : "ft";
    const ph = int(f.score?.penalty?.home);
    const pa = int(f.score?.penalty?.away);
    const homeId = f.teams?.home?.id;
    const awayId = f.teams?.away?.id;
    const events: EspnSoccerEvent["events"] = [];
    for (const e of f.events ?? []) {
      if (/shootout/i.test(String(e.comments ?? ""))) continue;
      const detail = String(e.detail ?? "");
      const kind =
        e.type === "Goal"
          ? detail === "Normal Goal"
            ? "goal"
            : detail === "Penalty"
              ? "penalty_goal"
              : null // Own Goal (side unverified) and Missed Penalty are not goals we can place
          : e.type === "Card" && /red card|second yellow/i.test(detail)
            ? "red_card"
            : null;
      const minute = apifMinute(e.time?.elapsed, e.time?.extra);
      const team = e.team?.id != null && e.team.id === homeId ? "home" : e.team?.id != null && e.team.id === awayId ? "away" : null;
      if (!kind || !minute || !team) continue;
      events.push({ minute, kind, team, player: e.player?.name ?? null });
    }
    out.push({
      id: String(id),
      kickoff: date,
      home: hn,
      away: an,
      state,
      final_kind,
      minute: state === "live" && short !== "P" ? apifMinute(f.fixture?.status?.elapsed, f.fixture?.status?.extra) : null,
      homeScore: started ? int(f.goals?.home) : null,
      awayScore: started ? int(f.goals?.away) : null,
      pens: final_kind === "pen" && ph != null && pa != null ? { home: ph, away: pa } : null,
      events,
      updatedAt: fetchedAt,
    });
  }
  return out;
}

/**
 * The key and how to send it. API_FOOTBALL_DIRECT_KEY is an api-sports.io key
 * (measured 07/10: plan Free, 100 requests/day, 10/min — and `live=all` IS
 * served on Free). API_FOOTBALL_KEY is the RapidAPI one (403 «not subscribed» on
 * 07/10), used only when the direct key is absent.
 */
export function apiFootballAuth(env: Record<string, string | undefined>): { base: string; headers: Record<string, string> } | null {
  const direct = env.API_FOOTBALL_DIRECT_KEY?.trim();
  if (direct) return { base: "https://v3.football.api-sports.io", headers: { "x-apisports-key": direct } };
  const rapid = env.API_FOOTBALL_KEY?.trim();
  if (rapid) return { base: "https://api-football-v1.p.rapidapi.com/v3", headers: { "x-rapidapi-key": rapid, "x-rapidapi-host": "api-football-v1.p.rapidapi.com" } };
  return null;
}
