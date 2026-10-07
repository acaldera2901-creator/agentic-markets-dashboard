// lib/v3c/live-espn.ts (#V3C-LIVESCORES) — PURE parsing of the ESPN site-API
// scoreboards (the same feed /api/live, /api/tennis-live and the settlement
// recovery already read). No network here: the service fetches, these
// functions only read. Anything malformed is dropped — a score we cannot read
// is no score, never a 0.
import type { V3LiveState } from "./live-contract";

export type EspnSoccerEvent = {
  id: string;
  kickoff: string;
  home: string;
  away: string;
  state: V3LiveState;
  final_kind: "ft" | "aet" | "pen" | null;
  minute: string | null;
  homeScore: number | null;
  awayScore: number | null;
  pens: { home: number; away: number } | null;
  events: { minute: string; kind: "goal" | "own_goal" | "penalty_goal" | "red_card"; team: "home" | "away"; player: string | null }[];
};

export type EspnTennisSide = {
  /** the name as ESPN prints it (doubles: «Shi Han / Yao Xinxin») */
  name: string;
  /** one name per person (singles: 1, doubles: 2) */
  persons: string[];
  games: { value: number; tiebreak: number | null }[];
  serving: boolean | null;
  winner: boolean;
};

export type EspnTennisMatch = {
  id: string;
  kickoff: string;
  tournament: string;
  doubles: boolean;
  state: V3LiveState;
  final_kind: "done" | "ret" | null;
  a: EspnTennisSide;
  b: EspnTennisSide;
};

type RawStatus = { displayClock?: string; type?: { name?: string; state?: string; completed?: boolean } };

const OFF = new Set(["STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_ABANDONED", "STATUS_SUSPENDED", "STATUS_FORFEIT", "STATUS_DELAYED_ABANDONED"]);
const BREAK = new Set(["STATUS_HALFTIME", "STATUS_END_OF_REGULATION", "STATUS_END_OF_EXTRATIME", "STATUS_HALFTIME_ET"]);

/** ESPN status → our state. Unknown shapes fall to the ESPN `state` field; nothing at all → null (dropped). */
export function espnState(status: RawStatus | undefined): V3LiveState | null {
  const name = String(status?.type?.name ?? "");
  const st = status?.type?.state;
  if (OFF.has(name)) return "off";
  if (st === "in") return BREAK.has(name) ? "break" : "live";
  if (st === "post") return status?.type?.completed ? "final" : "off";
  if (st === "pre") return "pre";
  return null;
}

/** «67'» / «90'+4'» — anything else (e.g. «0'» before kick-off, «HT») is not a minute. */
export function cleanMinute(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return /^\d{1,3}'(\+\d{1,2}')?$/.test(s) && s !== "0'" ? s : null;
}

function score(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) return raw;
  if (typeof raw !== "string" || !/^\d{1,3}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

type RawSoccerCompetitor = { homeAway?: string; score?: unknown; shootoutScore?: unknown; team?: { id?: string; displayName?: string } };
type RawDetail = {
  clock?: { displayValue?: string };
  team?: { id?: string };
  scoringPlay?: boolean;
  redCard?: boolean;
  ownGoal?: boolean;
  penaltyKick?: boolean;
  shootout?: boolean;
  athletesInvolved?: { displayName?: string }[];
};

/** One soccer scoreboard (`/soccer/{slug}/scoreboard?dates=…`). */
export function parseEspnSoccer(data: unknown): EspnSoccerEvent[] {
  const events = (data as { events?: unknown[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const out: EspnSoccerEvent[] = [];
  for (const raw of events) {
    const ev = raw as { id?: unknown; date?: string; status?: RawStatus; competitions?: { competitors?: RawSoccerCompetitor[]; details?: RawDetail[] }[] };
    const comp = ev?.competitions?.[0];
    const cs = comp?.competitors;
    if (!ev?.id || !ev.date || !Array.isArray(cs)) continue;
    const h = cs.find((c) => c.homeAway === "home");
    const a = cs.find((c) => c.homeAway === "away");
    const hn = h?.team?.displayName;
    const an = a?.team?.displayName;
    const state = espnState(ev.status);
    if (!hn || !an || !state) continue;
    const name = String(ev.status?.type?.name ?? "");
    const final_kind = state !== "final" ? null : name === "STATUS_FINAL_PEN" ? "pen" : name === "STATUS_FINAL_AET" ? "aet" : "ft";
    const started = state !== "pre";
    const homeScore = started ? score(h?.score) : null;
    const awayScore = started ? score(a?.score) : null;
    const ph = score(h?.shootoutScore);
    const pa = score(a?.shootoutScore);
    const evs: EspnSoccerEvent["events"] = [];
    for (const d of comp?.details ?? []) {
      if (d.shootout) continue;
      const kind = d.scoringPlay ? (d.ownGoal ? "own_goal" : d.penaltyKick ? "penalty_goal" : "goal") : d.redCard ? "red_card" : null;
      const minute = String(d.clock?.displayValue ?? "").trim();
      // an own goal carries the team it COUNTS for (measured 07/10 on 21 own goals of 202609: Graves of
      // PEC Zwolle → Feyenoord's id), so `team` is always the side whose score moved
      const team = d.team?.id && d.team.id === h?.team?.id ? "home" : d.team?.id && d.team.id === a?.team?.id ? "away" : null;
      if (!kind || !minute || !team) continue;
      evs.push({ minute, kind, team, player: d.athletesInvolved?.[0]?.displayName ?? null });
    }
    out.push({
      id: String(ev.id),
      kickoff: ev.date,
      home: hn,
      away: an,
      state,
      final_kind,
      minute: state === "live" ? cleanMinute(ev.status?.displayClock) : null,
      homeScore,
      awayScore,
      pens: final_kind === "pen" && ph != null && pa != null ? { home: ph, away: pa } : null,
      events: evs,
    });
  }
  return out;
}

type RawTennisCompetitor = {
  homeAway?: string;
  order?: number;
  winner?: boolean;
  possession?: boolean;
  linescores?: { value?: unknown; tiebreak?: unknown }[];
  athlete?: { displayName?: string };
  roster?: { displayName?: string; athletes?: { displayName?: string }[] };
};

function tennisSide(c: RawTennisCompetitor | undefined): EspnTennisSide | null {
  if (!c) return null;
  const persons = c.athlete?.displayName ? [c.athlete.displayName] : (c.roster?.athletes ?? []).map((x) => x.displayName ?? "").filter(Boolean);
  const name = c.athlete?.displayName ?? c.roster?.displayName ?? "";
  if (!name || !persons.length) return null;
  const games: EspnTennisSide["games"] = [];
  for (const l of c.linescores ?? []) {
    const v = typeof l.value === "number" ? l.value : Number.NaN;
    if (!Number.isInteger(v) || v < 0 || v > 99) return { name, persons, games: [], serving: null, winner: false };
    games.push({ value: v, tiebreak: typeof l.tiebreak === "number" && Number.isInteger(l.tiebreak) ? l.tiebreak : null });
  }
  return { name, persons, games, serving: typeof c.possession === "boolean" ? c.possession : null, winner: c.winner === true };
}

/** One tennis scoreboard (`/tennis/{atp|wta}/scoreboard?dates=…`): every singles and doubles match. */
export function parseEspnTennis(data: unknown): EspnTennisMatch[] {
  const events = (data as { events?: unknown[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const out: EspnTennisMatch[] = [];
  for (const raw of events) {
    const ev = raw as { name?: string; groupings?: { grouping?: { displayName?: string }; competitions?: unknown[] }[] };
    for (const g of ev?.groupings ?? []) {
      const gname = String(g?.grouping?.displayName ?? "");
      const doubles = /doubles/i.test(gname);
      if (!doubles && !/singles/i.test(gname)) continue;
      for (const rc of g.competitions ?? []) {
        const c = rc as { id?: unknown; date?: string; status?: RawStatus; competitors?: RawTennisCompetitor[] };
        const state = espnState(c?.status);
        if (!c?.id || !c.date || !state || !Array.isArray(c.competitors) || c.competitors.length !== 2) continue;
        const a = tennisSide(c.competitors[0]);
        const b = tennisSide(c.competitors[1]);
        if (!a || !b) continue;
        // the two sides must report the same number of sets, or the score is not readable
        if (a.games.length !== b.games.length) continue;
        const name = String(c.status?.type?.name ?? "");
        out.push({
          id: String(c.id),
          kickoff: c.date,
          tournament: String(ev.name ?? ""),
          doubles,
          state,
          final_kind: state !== "final" ? null : name === "STATUS_RETIRED" ? "ret" : "done",
          a,
          b,
        });
      }
    }
  }
  return out;
}
