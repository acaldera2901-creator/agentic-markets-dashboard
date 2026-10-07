// lib/v3c/live-match.ts (#V3C-LIVESCORES) — which ESPN event is which board
// row, and the live item in OUR orientation. Pure: the service passes the rows
// and the parsed feeds.
//
// Matching, strictest first (a wrong match shows another match's score, so
// ambiguity means NO score, never «take the first»):
//   1. the source id is in our id — `espn:<event>` (football), `tennis:espn:<competition>:…`;
//   2. football by names: same ESPN league, kick-off within 30', BOTH teams
//      with the strong identity of lib/espn-results.ts (abbinaFinaleCerto: one
//      name's tokens all inside the other's, a long token among them), either
//      orientation, exactly one candidate;
//   3. tennis by names: kick-off within 12 h, both sides with the same players
//      (canonicalPlayerKey tokens, so «Yi Zhou» = «Zhou Yi» and «Coleman Wong»
//      ⊂ «Chak Lam Coleman Wong»), singles with singles, exactly one candidate.
import { tokenSquadra } from "@/lib/dedupe-fixtures";
import { espnSlugForLeague } from "@/lib/espn-results";
import { canonicalPlayerKey } from "@/lib/tennis-names";
import type { V3LiveCoverage, V3LiveFootball, V3LiveItem, V3LiveResponse, V3LiveTennis } from "./live-contract";
import type { EspnSoccerEvent, EspnTennisMatch, EspnTennisSide } from "./live-espn";

export type LiveRow = { id: string; sport: "football" | "tennis"; league: string | null; kickoff: string; home: string; away: string };

/** Minutes after kick-off a row is still looked up (the board keeps rows 150'; a long match ends later). */
export const LIVE_WINDOW_MIN = 180;
/** …and minutes BEFORE kick-off (a clock a little off, a match started early). */
export const LIVE_LEAD_MIN = 15;

export const FOOTBALL_KICKOFF_MS = 30 * 60_000;
const TENNIS_KICKOFF_MS = 12 * 3_600_000;
const MIN_TOKEN = 4;

/** Mock/older rows carry a league name instead of the code («Serie A»): the same slug either way. */
const LEAGUE_NAME_TO_CODE: Record<string, string> = {
  "premier league": "PL", "serie a": "SA", "la liga": "PD", bundesliga: "BL1", "ligue 1": "FL1",
  "champions league": "CL", "uefa champions league": "CL", "europa league": "EL", eredivisie: "NED",
  "primeira liga": "POR", championship: "EFLC", mls: "MLS", "serie b": "SB",
};

export function soccerSlugFor(league: string | null): string | null {
  if (!league) return null;
  const code = league.trim();
  if (code.toUpperCase() === "FRIENDLY") return "fifa.friendly";
  return espnSlugForLeague(code.toUpperCase()) ?? espnSlugForLeague(LEAGUE_NAME_TO_CODE[code.toLowerCase()] ?? "") ?? null;
}

/** The ESPN id carried by our own id, if any. */
export function espnIdOf(row: Pick<LiveRow, "id" | "sport">): string | null {
  const m = row.sport === "football" ? /^espn:(\d+)$/.exec(row.id) : /^tennis:espn:(\d+):/.exec(row.id);
  return m ? m[1] : null;
}

/** Rows inside the live window at `now`. */
export function inLiveWindow<T extends { kickoff: string }>(rows: readonly T[], now: Date): T[] {
  const t = now.getTime();
  return rows.filter((r) => {
    const k = Date.parse(r.kickoff);
    return Number.isFinite(k) && k <= t + LIVE_LEAD_MIN * 60_000 && k > t - LIVE_WINDOW_MIN * 60_000;
  });
}

/** YYYYMMDD days ESPN may file a kick-off under (it files by the US Eastern day: UTC−4 or −5). */
export function espnDaysFor(kickoffIso: string): string[] {
  const k = Date.parse(kickoffIso);
  if (!Number.isFinite(k)) return [];
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
  return [...new Set([day(k - 4 * 3_600_000), day(k - 5 * 3_600_000)])];
}

// ─── football ────────────────────────────────────────────────────────────────

/**
 * tokenSquadra plus two spellings measured on 26/09–06/10 (19 misses on 103
 * rows): reserve sides («Real Sociedad B» = ESPN «Real Sociedad II») and a
 * plural («New York Red Bulls» = «Red Bull New York»). Both sides get the same
 * folding, so it can only make two names equal that differ by exactly that.
 */
function teamTokens(name: string): Set<string> {
  return new Set(tokenSquadra(name).map((t) => (t === "b" ? "ii" : t.length >= 5 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)));
}

export function strongSameTeam(a: string, b: string): boolean {
  const x = teamTokens(a);
  const y = teamTokens(b);
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  if (!small.size) return false;
  for (const t of small) if (!big.has(t)) return false;
  return [...small].some((t) => t.length >= MIN_TOKEN);
}

function sameClub(a: string, b: string): boolean {
  const x = teamTokens(a);
  const y = teamTokens(b);
  return x.size > 0 && x.size === y.size && [...x].every((t) => y.has(t));
}

/**
 * `slot` (#V3C-LIVEFIX): `events` is the scoreboard of the row's OWN league, so the
 * calendar rule of lib/dedupe-fixtures.ts (#DUP-SAMESLOT-0916) holds — at the same
 * kick-off, to the minute, in the same competition a club plays one match. When
 * the strict «both names» rule finds nothing, one club EQUAL (not contained) is
 * enough, provided the event is the only one and our other club is not in
 * another match of that slot. Measured 07/10: «FC Bayern München» = «Bayern
 * Munich», «1. FC Köln» = «FC Cologne», «Olympique Lyonnais» = «Lyon».
 */
export function matchFootball(row: LiveRow, events: readonly EspnSoccerEvent[], opts: { slot?: boolean } = {}): { ev: EspnSoccerEvent; swapped: boolean; by: "id" | "names" | "slot" } | null {
  const id = espnIdOf(row);
  if (id) {
    const ev = events.find((e) => e.id === id);
    if (ev) return { ev, swapped: !strongSameTeam(ev.home, row.home) && strongSameTeam(ev.home, row.away), by: "id" };
  }
  const k = Date.parse(row.kickoff);
  if (!Number.isFinite(k)) return null;
  const found: { ev: EspnSoccerEvent; swapped: boolean }[] = [];
  for (const ev of events) {
    const t = Date.parse(ev.kickoff);
    if (!Number.isFinite(t) || Math.abs(t - k) > FOOTBALL_KICKOFF_MS) continue;
    if (strongSameTeam(ev.home, row.home) && strongSameTeam(ev.away, row.away)) found.push({ ev, swapped: false });
    else if (strongSameTeam(ev.home, row.away) && strongSameTeam(ev.away, row.home)) found.push({ ev, swapped: true });
  }
  if (found.length) return found.length === 1 ? { ...found[0], by: "names" } : null;
  if (!opts.slot) return null;
  const slot = events.filter((ev) => Date.parse(ev.kickoff) === k);
  const hits: { ev: EspnSoccerEvent; swapped: boolean }[] = [];
  for (const ev of slot) {
    const straight = sameClub(ev.home, row.home) || sameClub(ev.away, row.away);
    const swapped = sameClub(ev.home, row.away) || sameClub(ev.away, row.home);
    if (straight !== swapped) hits.push({ ev, swapped });
  }
  if (hits.length !== 1) return null;
  const [hit] = hits;
  const other = hit.swapped ? (sameClub(hit.ev.home, row.away) ? row.home : row.away) : sameClub(hit.ev.home, row.home) ? row.away : row.home;
  if (slot.some((ev) => ev !== hit.ev && (strongSameTeam(ev.home, other) || strongSameTeam(ev.away, other)))) return null;
  return { ...hit, by: "slot" };
}

export function footballItem(ev: EspnSoccerEvent, swapped: boolean): V3LiveFootball {
  const flip = (s: "home" | "away") => (swapped ? (s === "home" ? "away" : "home") : s);
  return {
    sport: "football",
    state: ev.state,
    final_kind: ev.final_kind,
    minute: ev.minute,
    home: swapped ? ev.awayScore : ev.homeScore,
    away: swapped ? ev.homeScore : ev.awayScore,
    pens: ev.pens ? (swapped ? { home: ev.pens.away, away: ev.pens.home } : ev.pens) : null,
    events: ev.events.map((e) => ({ minute: e.minute, kind: e.kind, side: flip(e.team), player: e.player })),
  };
}

// ─── tennis ──────────────────────────────────────────────────────────────────

function personTokens(name: string): string[] {
  return canonicalPlayerKey(name).split(" ").filter(Boolean);
}

/** Our side («Hiroko Kuwata/Qiu Yu Ye») as person names. */
function ourPersons(side: string): string[] {
  return side.split("/").map((s) => s.trim()).filter(Boolean);
}

function samePlayers(ours: string, theirs: EspnTennisSide): boolean {
  const mine = ourPersons(ours);
  if (mine.length !== theirs.persons.length) return false;
  const x = new Set(mine.flatMap(personTokens));
  const y = new Set(theirs.persons.flatMap(personTokens));
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  if (small.size < 2) return false;
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

/** `aIsP1`: ESPN's first competitor is our player1. */
export function matchTennis(row: LiveRow, matches: readonly EspnTennisMatch[]): { m: EspnTennisMatch; aIsP1: boolean; by: "id" | "names" } | null {
  const orient = (m: EspnTennisMatch): boolean | null => {
    if (samePlayers(row.home, m.a) && samePlayers(row.away, m.b)) return true;
    if (samePlayers(row.home, m.b) && samePlayers(row.away, m.a)) return false;
    return null;
  };
  const id = espnIdOf(row);
  if (id) {
    const m = matches.find((x) => x.id === id);
    const o = m ? orient(m) : null;
    // the id is ours, but the orientation still comes from the names: without it the score could be upside down
    if (m && o != null) return { m, aIsP1: o, by: "id" };
  }
  const k = Date.parse(row.kickoff);
  if (!Number.isFinite(k)) return null;
  const found: { m: EspnTennisMatch; aIsP1: boolean }[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    if (seen.has(m.id)) continue; // ATP and WTA scoreboards both list mixed events
    const t = Date.parse(m.kickoff);
    if (!Number.isFinite(t) || Math.abs(t - k) > TENNIS_KICKOFF_MS) continue;
    const o = orient(m);
    if (o == null) continue;
    seen.add(m.id);
    found.push({ m, aIsP1: o });
  }
  return found.length === 1 ? { ...found[0], by: "names" } : null;
}

export function tennisItem(m: EspnTennisMatch, aIsP1: boolean): V3LiveTennis {
  const [p1, p2] = aIsP1 ? [m.a, m.b] : [m.b, m.a];
  const started = m.state !== "pre";
  return {
    sport: "tennis",
    state: m.state,
    final_kind: m.final_kind,
    sets: started ? p1.games.map((g, i) => ({ p1: g.value, p2: p2.games[i].value, tb1: g.tiebreak, tb2: p2.games[i].tiebreak })) : [],
    server: m.state === "live" && p1.serving !== p2.serving && p1.serving != null && p2.serving != null ? (p1.serving ? "p1" : "p2") : null,
    winner: m.state === "final" ? (p1.winner && !p2.winner ? "p1" : p2.winner && !p1.winner ? "p2" : null) : null,
  };
}

// ─── the response ────────────────────────────────────────────────────────────

export type LiveFeeds = {
  /** parsed soccer scoreboards, by ESPN slug */
  soccer: Map<string, EspnSoccerEvent[]>;
  /** ATP + WTA, parsed */
  tennis: EspnTennisMatch[];
  /** whether the tennis feed was read at all (both scoreboards failed → no source) */
  tennisRead: boolean;
  failed: string[];
  /** live2: when the scoreboards were read (default: `now`) */
  readAt?: string;
};

export const LIVE_SOURCE_NOTE =
  "Scores from ESPN's public scoreboards, read at most every ~20 s and re-oriented to our home/away. Information only: they never change the sealed record, the estimates or the settlement.";

export function buildLive(rows: readonly LiveRow[], feeds: LiveFeeds, now: Date): V3LiveResponse {
  const items: Record<string, V3LiveItem> = {};
  const cov = (): V3LiveCoverage => ({ rows: 0, matched: 0, no_source: 0, unmatched: 0 });
  const coverage = { football: cov(), tennis: cov(), failed_feeds: [...feeds.failed] };
  const allSoccer = [...feeds.soccer.values()].flat();
  const readAt = feeds.readAt ?? now.toISOString();
  for (const row of inLiveWindow(rows, now)) {
    const c = coverage[row.sport];
    c.rows += 1;
    if (row.sport === "football") {
      const slug = soccerSlugFor(row.league);
      const pool = slug ? feeds.soccer.get(slug) : undefined;
      // an `espn:` id is found in whatever scoreboard was read; a name match needs its league's scoreboard
      const hit = espnIdOf(row) ? matchFootball(row, allSoccer) : matchFootball(row, pool ?? [], { slot: true });
      if (hit) {
        items[row.id] = { ...footballItem(hit.ev, hit.swapped), source_id: `espn:${hit.ev.id}`, matched_by: hit.by, source: "espn", updated_at: readAt };
        c.matched += 1;
      } else if (!pool && !espnIdOf(row)) c.no_source += 1;
      else c.unmatched += 1;
    } else {
      const hit = feeds.tennisRead ? matchTennis(row, feeds.tennis) : null;
      if (hit) {
        items[row.id] = { ...tennisItem(hit.m, hit.aIsP1), source_id: `espn:${hit.m.id}`, matched_by: hit.by, source: "espn", updated_at: readAt };
        c.matched += 1;
      } else if (!feeds.tennisRead) c.no_source += 1;
      else c.unmatched += 1;
    }
  }
  return {
    contract: "v3.live.1",
    generated_at: now.toISOString(),
    window_min: LIVE_WINDOW_MIN,
    source: { name: "ESPN", note: LIVE_SOURCE_NOTE },
    sources: [],
    degraded: false,
    items,
    coverage,
  };
}

/** What to read for these rows: soccer slug → days, and the tennis days. */
export function livePlan(rows: readonly LiveRow[], now: Date): { soccer: Map<string, string[]>; tennisDays: string[] } {
  const soccer = new Map<string, string[]>();
  const tennis = new Set<string>();
  for (const r of inLiveWindow(rows, now)) {
    const days = espnDaysFor(r.kickoff);
    if (r.sport === "tennis") {
      days.forEach((d) => tennis.add(d));
      continue;
    }
    const slug = soccerSlugFor(r.league);
    if (!slug) continue;
    const list = soccer.get(slug) ?? [];
    for (const d of days) if (!list.includes(d)) list.push(d);
    soccer.set(slug, list.sort());
  }
  return { soccer, tennisDays: [...tennis].sort() };
}
