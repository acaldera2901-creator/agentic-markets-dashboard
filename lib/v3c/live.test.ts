// lib/v3c/live.test.ts (#V3C-LIVESCORES) — parser, matching and the response,
// on ESPN payloads RECORDED on 2026-10-07 (tests/fixtures/espn-live). No
// network: the service is not called here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanMinute, espnState, parseEspnSoccer, parseEspnTennis } from "./live-espn";
import { buildLive, espnDaysFor, espnIdOf, footballItem, inLiveWindow, livePlan, matchFootball, matchTennis, soccerSlugFor, tennisItem, type LiveRow } from "./live-match";

const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/espn-live", f), "utf8"));
const ATP = parseEspnTennis(fx("tennis-atp-20261007.json"));
const WTA = parseEspnTennis(fx("tennis-wta-20261007.json"));
const TENNIS = [...ATP, ...WTA];
const ESP2 = parseEspnSoccer(fx("soccer-esp2-20261004.json"));

/** A recorded final, turned into a live second half — SYNTHETIC status on real teams/events (no live soccer was on at recording time). */
function liveCopy(minute: string, name = "STATUS_SECOND_HALF") {
  const raw = fx("soccer-esp2-20261004.json");
  const ev = raw.events[1];
  ev.status = { displayClock: minute, type: { name, state: "in", completed: false } };
  ev.competitions[0].details = ev.competitions[0].details.slice(0, 3);
  return { events: [ev] };
}

describe("ESPN status and minute", () => {
  it("maps the statuses we meet", () => {
    expect(espnState({ type: { name: "STATUS_SECOND_HALF", state: "in" } })).toBe("live");
    expect(espnState({ type: { name: "STATUS_HALFTIME", state: "in" } })).toBe("break");
    expect(espnState({ type: { name: "STATUS_FULL_TIME", state: "post", completed: true } })).toBe("final");
    expect(espnState({ type: { name: "STATUS_POSTPONED", state: "post", completed: false } })).toBe("off");
    expect(espnState({ type: { name: "STATUS_SCHEDULED", state: "pre" } })).toBe("pre");
    expect(espnState({})).toBeNull();
  });
  it("a minute is «67'» or «45'+2'»; «0'», «HT» and junk are not", () => {
    expect(cleanMinute("67'")).toBe("67'");
    expect(cleanMinute("90'+7'")).toBe("90'+7'");
    expect(cleanMinute("0'")).toBeNull();
    expect(cleanMinute("HT")).toBeNull();
    expect(cleanMinute(undefined)).toBeNull();
  });
});

describe("parseEspnSoccer (recorded esp.2, 4 Oct)", () => {
  it("reads the finals with their goals and red cards, no yellow cards", () => {
    expect(ESP2).toHaveLength(4);
    const g = ESP2.find((e) => e.home === "Sporting Gijón")!;
    expect(g).toMatchObject({ state: "final", final_kind: "ft", minute: null, homeScore: 3, awayScore: 2, away: "RC Celta Fortuna" });
    expect(g.events.filter((e) => e.kind !== "red_card").length).toBe(5); // 3 + 2 goals
    expect(g.events.every((e) => /^\d/.test(e.minute))).toBe(true);
    const rs = ESP2.find((e) => e.home === "Real Sociedad II")!;
    expect(rs.events.filter((e) => e.kind !== "red_card").map((e) => e.team).sort()).toEqual(["away", "away", "away", "home", "home"]);
  });
  it("a missing score is null, never 0", () => {
    const raw = fx("soccer-esp2-20261004.json");
    delete raw.events[0].competitions[0].competitors[0].score;
    expect(parseEspnSoccer(raw)[0].homeScore).toBeNull();
  });
  it("live: minute from the clock; half-time is a break without a minute", () => {
    const live = parseEspnSoccer(liveCopy("67'"))[0];
    expect(live).toMatchObject({ state: "live", minute: "67'", final_kind: null });
    const ht = parseEspnSoccer(liveCopy("45'+2'", "STATUS_HALFTIME"))[0];
    expect(ht).toMatchObject({ state: "break", minute: null });
  });
  it("garbage in → nothing out", () => {
    expect(parseEspnSoccer(null)).toEqual([]);
    expect(parseEspnSoccer({ events: [{ id: 1 }] })).toEqual([]);
  });
});

describe("parseEspnTennis (recorded ATP/WTA, 7 Oct 08:15 UTC)", () => {
  it("reads sets, tie-breaks, server and the retired final", () => {
    const z = ATP.find((m) => m.id === "184839")!;
    expect(z.state).toBe("live");
    expect(z.a.name).toBe("Tomas Machac");
    expect(z.a.games).toEqual([{ value: 1, tiebreak: null }, { value: 6, tiebreak: 5 }]);
    const g = ATP.find((m) => m.id === "184346")!;
    expect([g.a.serving, g.b.serving]).toEqual([false, true]);
    const ret = ATP.find((m) => m.id === "183466")!;
    expect(ret).toMatchObject({ state: "final", final_kind: "ret" });
    expect(ret.b.winner).toBe(true);
  });
  it("doubles carry both players", () => {
    const d = WTA.find((m) => m.id === "185305")!;
    expect(d.doubles).toBe(true);
    expect(d.a.persons).toEqual(["Shi Han", "Yao Xinxin"]);
  });
});

const row = (p: Partial<LiveRow> & Pick<LiveRow, "id" | "home" | "away" | "kickoff">): LiveRow => ({ sport: "football", league: "PD2", ...p });

describe("football matching", () => {
  it("slug from league code or name; unknown → null", () => {
    expect(soccerSlugFor("PD2")).toBe("esp.2");
    expect(soccerSlugFor("SA")).toBe("ita.1");
    expect(soccerSlugFor("Serie A")).toBe("ita.1");
    expect(soccerSlugFor("POL")).toBeNull();
    expect(soccerSlugFor(null)).toBeNull();
  });
  it("names differ between sources: «Celta Fortuna» = «RC Celta Fortuna», «Sporting Gijon» = «Sporting Gijón»", () => {
    const hit = matchFootball(row({ id: "oddsapi:x", home: "Sporting Gijon", away: "Celta Fortuna", kickoff: "2026-10-04T14:15:00Z" }), ESP2);
    expect(hit?.ev.home).toBe("Sporting Gijón");
    expect(hit?.swapped).toBe(false);
    expect(hit?.by).toBe("names");
  });
  it("our home/away the other way round → score re-oriented", () => {
    // «Real Sociedad B» (ours) = «Real Sociedad II» (ESPN): reserve sides fold to the same token
    const ok = matchFootball(row({ id: "oddsapi:y", home: "Granada CF", away: "Real Sociedad B", kickoff: "2026-10-04T12:00:00Z" }), ESP2)!;
    expect(ok.swapped).toBe(true);
    const item = footballItem(ok.ev, ok.swapped);
    expect([item.home, item.away]).toEqual([3, 2]);
    expect(item.events.filter((e) => e.kind !== "red_card" && e.side === "home")).toHaveLength(3);
  });
  it("plural and word order: «New York Red Bulls» = «Red Bull New York»; «Real Sociedad» ≠ «Real Valladolid»", () => {
    const ev = { ...ESP2[0], id: "77", home: "Red Bull New York", away: "St. Louis CITY SC", kickoff: "2026-09-30T23:30Z" };
    expect(matchFootball(row({ id: "o", league: "MLS", home: "New York Red Bulls", away: "St. Louis City SC", kickoff: "2026-09-30T23:30:00Z" }), [ev])?.ev.id).toBe("77");
    const rv = { ...ESP2[0], id: "78", home: "Real Valladolid", away: "Granada", kickoff: "2026-10-04T12:00Z" };
    expect(matchFootball(row({ id: "o", home: "Real Sociedad B", away: "Granada", kickoff: "2026-10-04T12:00:00Z" }), [rv])).toBeNull();
  });
  it("kick-off too far, or a team that is not there → no match", () => {
    expect(matchFootball(row({ id: "a", home: "Sporting Gijon", away: "Celta Fortuna", kickoff: "2026-10-04T16:30:00Z" }), ESP2)).toBeNull();
    expect(matchFootball(row({ id: "a", home: "Las Palmas", away: "Ceuta", kickoff: "2026-10-04T16:30:00Z" }), ESP2)).toBeNull();
  });
  it("two candidates → none (ambiguity is not a match)", () => {
    const twin = [...ESP2, { ...ESP2[3], id: "999" }];
    expect(matchFootball(row({ id: "a", home: "Las Palmas", away: "Real Valladolid", kickoff: "2026-10-04T16:30:00Z" }), twin)).toBeNull();
  });
  // #V3C-LIVEFIX — measured on the preview 07/10 against ESPN: 181/213 board rows matched by the strict rule; in
  // leagues ESPN covers, misses were the same club written two ways («FC Bayern München» = «Bayern Munich»,
  // «1. FC Köln» = «FC Cologne»). The SLOT rule of lib/dedupe-fixtures.ts (#DUP-SAMESLOT-0916): the row's own
  // league scoreboard, same kick-off to the minute, one club EQUAL → the other is the same club written otherwise.
  it("slot: own league scoreboard + exact kick-off + one club equal → that match (real ESPN Bundesliga 10/10)", () => {
    const GER1 = parseEspnSoccer(fx("soccer-ger1-20261010.json"));
    const aug = matchFootball(row({ id: "oddsapi:aug", league: "BL1", home: "FC Augsburg", away: "FC Bayern München", kickoff: "2026-10-10T13:30:00.000Z" }), GER1, { slot: true })!;
    expect([aug.ev.home, aug.ev.away, aug.swapped, aug.by]).toEqual(["FC Augsburg", "Bayern Munich", false, "slot"]);
    // SYNTHETIC orientation: the same real event with our home/away reversed → re-oriented
    const rev = matchFootball(row({ id: "oddsapi:rev", league: "BL1", home: "FC Bayern München", away: "FC Augsburg", kickoff: "2026-10-10T13:30:00.000Z" }), GER1, { slot: true })!;
    expect([rev.ev.home, rev.swapped]).toEqual(["FC Augsburg", true]);
    // without the slot option (an espn: id row, read against every scoreboard) the rule stays «both names»
    expect(matchFootball(row({ id: "oddsapi:aug", league: "BL1", home: "FC Augsburg", away: "FC Bayern München", kickoff: "2026-10-10T13:30:00.000Z" }), GER1)).toBeNull();
  });
  it("slot never guesses: kick-off off by a minute, a club only CONTAINED, or our other club playing elsewhere → no match", () => {
    const GER1 = parseEspnSoccer(fx("soccer-ger1-20261010.json"));
    const FRA1 = parseEspnSoccer(fx("soccer-fra1-20261009.json"));
    expect(matchFootball(row({ id: "a", home: "FC Augsburg", away: "FC Bayern München", kickoff: "2026-10-10T13:31:00.000Z" }), GER1, { slot: true })).toBeNull();
    // accepted misses (real): «TSG 1899 Hoffenheim» only CONTAINS «TSG Hoffenheim», «Hamburger» ≠ «Hamburg»;
    // «Racing Club de Lens» ⊃ «Lens», «Olympique Lyonnais» ≠ «Lyon». Containment is not equality (Dundee ⊂ Dundee United)
    expect(matchFootball(row({ id: "a", home: "TSG 1899 Hoffenheim", away: "Hamburger SV", kickoff: "2026-10-10T13:30:00.000Z" }), GER1, { slot: true })).toBeNull();
    expect(matchFootball(row({ id: "a", home: "Racing Club de Lens", away: "Olympique Lyonnais", kickoff: "2026-10-09T18:45:00.000Z" }), FRA1, { slot: true })).toBeNull();
    // Augsburg is there, but our «Mainz» plays another match of the same slot: the sources disagree → nothing
    expect(matchFootball(row({ id: "a", home: "FC Augsburg", away: "Mainz", kickoff: "2026-10-10T13:30:00.000Z" }), GER1, { slot: true })).toBeNull();
    // the slot fallback never overrides an ambiguity of the strict rule
    const twin = [...ESP2, { ...ESP2[3], id: "999" }];
    expect(matchFootball(row({ id: "a", home: "Las Palmas", away: "Real Valladolid", kickoff: "2026-10-04T16:30:00Z" }), twin, { slot: true })).toBeNull();
  });
  it("an espn: id matches by id", () => {
    const id = ESP2[2].id;
    expect(espnIdOf({ id: `espn:${id}`, sport: "football" })).toBe(id);
    const hit = matchFootball(row({ id: `espn:${id}`, home: "CD Castellón", away: "AD Ceuta FC", kickoff: "2026-10-04T16:30:00Z" }), ESP2);
    expect(hit?.by).toBe("id");
  });
});

const tn = (p: Partial<LiveRow> & Pick<LiveRow, "id" | "home" | "away" | "kickoff">): LiveRow => ({ sport: "tennis", league: null, ...p });

describe("tennis matching", () => {
  it("tennis:espn: id → that competition, oriented by names", () => {
    const hit = matchTennis(tn({ id: "tennis:espn:184346:coco-gauff:elise-mertens", home: "Coco Gauff", away: "Elise Mertens", kickoff: "2026-10-07T07:05:00Z" }), TENNIS)!;
    expect(hit.by).toBe("id");
    expect(hit.aIsP1).toBe(false); // ESPN lists Mertens first
    const it2 = tennisItem(hit.m, hit.aIsP1);
    expect(it2.sets).toEqual([{ p1: 3, p2: 6, tb1: null, tb2: null }, { p1: 1, p2: 4, tb1: null, tb2: null }]);
    expect(it2.server).toBe("p1"); // Gauff serving
  });
  it("partner row by names: «Yi Zhou» = «Zhou Yi», kick-off 20' apart", () => {
    const hit = matchTennis(tn({ id: "tennis:partner:2026-10-07_mattia bellucci|yi zhou", home: "Mattia Bellucci", away: "Yi Zhou", kickoff: "2026-10-07T08:00:00Z" }), TENNIS)!;
    expect(hit.m.id).toBe("184870");
    expect(hit.by).toBe("names");
    expect(tennisItem(hit.m, hit.aIsP1)).toMatchObject({ state: "pre", sets: [] });
  });
  it("partner doubles «Han Shi/Xinxin Yao» = ESPN «Shi Han / Yao Xinxin»", () => {
    const hit = matchTennis(tn({ id: "tennis:partner:d", home: "Hiroko Kuwata/Qiu Yu Ye", away: "Han Shi/Xinxin Yao", kickoff: "2026-10-07T06:30:00Z" }), TENNIS)!;
    expect(hit.m.id).toBe("185305");
    expect(tennisItem(hit.m, hit.aIsP1).sets[0]).toEqual({ p1: 6, p2: 2, tb1: null, tb2: null });
  });
  it("the same match listed by ATP and WTA counts once; an unknown player → no match", () => {
    expect(matchTennis(tn({ id: "x", home: "Elise Mertens", away: "Coco Gauff", kickoff: "2026-10-07T07:00:00Z" }), TENNIS)?.m.id).toBe("184346");
    expect(matchTennis(tn({ id: "x", home: "Elise Mertens", away: "Mirra Andreeva", kickoff: "2026-10-07T07:00:00Z" }), TENNIS)).toBeNull();
  });
  it("a single surname is not an identity («Wong» alone)", () => {
    expect(matchTennis(tn({ id: "x", home: "Wong", away: "Halys", kickoff: "2026-10-07T08:30:00Z" }), TENNIS)).toBeNull();
  });
  it("retired final: winner and final_kind", () => {
    const hit = matchTennis(tn({ id: "x", home: "Alex de Minaur", away: "Hubert Hurkacz", kickoff: "2026-10-05T09:25:00Z" }), TENNIS)!;
    expect(tennisItem(hit.m, hit.aIsP1)).toMatchObject({ state: "final", final_kind: "ret", winner: "p1", server: null });
  });
});

describe("window, plan and the response", () => {
  const now = new Date("2026-10-07T08:15:00Z");
  const rows: LiveRow[] = [
    tn({ id: "tennis:espn:184839:tomas-machac:zhang-zhizhen", home: "Tomas Machac", away: "Zhang Zhizhen", kickoff: "2026-10-07T06:45:00Z" }),
    tn({ id: "tennis:partner:2026-10-07_a|b", home: "Galena Krastenova", away: "Anastasiia Sobolieva", kickoff: "2026-10-07T07:00:00Z" }),
    row({ id: "oddsapi:pl", league: "POL", home: "Legia", away: "Lech", kickoff: "2026-10-07T07:30:00Z" }),
    row({ id: "oddsapi:old", home: "A", away: "B", kickoff: "2026-10-07T04:00:00Z" }),
    row({ id: "oddsapi:later", league: "BRA", home: "Remo", away: "Grêmio", kickoff: "2026-10-07T22:30:00Z" }),
  ];
  it("keeps rows from 180' before to 15' after now", () => {
    expect(inLiveWindow(rows, now).map((r) => r.id)).toEqual([rows[0].id, rows[1].id, rows[2].id]);
  });
  it("ESPN days follow the US Eastern day", () => {
    expect(espnDaysFor("2026-10-07T03:00:00Z")).toEqual(["20261006"]);
    expect(espnDaysFor("2026-10-07T04:30:00Z")).toEqual(["20261007", "20261006"]);
    expect(espnDaysFor("2026-10-07T12:00:00Z")).toEqual(["20261007"]);
  });
  it("plan: only covered soccer leagues; tennis by day", () => {
    const p = livePlan(rows, now);
    expect([...p.soccer.keys()]).toEqual([]); // POL has no ESPN league
    expect(p.tennisDays).toEqual(["20261007"]);
  });
  it("items keyed by board id, with an honest coverage", () => {
    const r = buildLive(rows, { soccer: new Map(), tennis: TENNIS, tennisRead: true, failed: [] }, now);
    expect(Object.keys(r.items)).toEqual([rows[0].id]);
    const z = r.items[rows[0].id];
    expect(z).toMatchObject({ sport: "tennis", state: "live", matched_by: "id", source_id: "espn:184839" });
    expect(r.coverage.tennis).toEqual({ rows: 2, matched: 1, no_source: 0, unmatched: 1 });
    expect(r.coverage.football).toEqual({ rows: 1, matched: 0, no_source: 1, unmatched: 0 });
    expect(r.contract).toBe("v3.live.1");
  });
  it("tennis feed down → no_source, never stale data", () => {
    const r = buildLive(rows, { soccer: new Map(), tennis: [], tennisRead: false, failed: ["tennis/atp/20261007:503"] }, now);
    expect(r.items).toEqual({});
    expect(r.coverage.tennis.no_source).toBe(2);
    expect(r.coverage.failed_feeds).toEqual(["tennis/atp/20261007:503"]);
  });
});
