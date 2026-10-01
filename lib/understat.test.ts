import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLeagueXG,
  matchTeam,
  parseUnderstatTeams,
  understatSeason,
  xgBlendBaseline,
  type TeamXG,
} from "./understat";

// Shape of the live response of https://understat.com/getLeagueData/EPL/2026
// (sampled 2026-10-01): numeric values, side in `h_a`, no `isHome` field.
const liveTeams = {
  "71": {
    id: "71",
    title: "Aston Villa",
    history: [
      { h_a: "a", xG: 0.5, xGA: 2.0, npxG: 0.5, ppda: { att: 300, def: 10 }, xpts: 0.2, result: "l" },
      { h_a: "h", xG: 2.0, xGA: 1.0, npxG: 1.5, ppda: { att: 200, def: 20 }, xpts: 2.0, result: "w" },
      { h_a: "h", xG: 1.0, xGA: 0.5, npxG: 1.0, ppda: { att: 100, def: 10 }, xpts: 1.8, result: "d" },
    ],
  },
};

describe("parseUnderstatTeams", () => {
  it("splits home/away on h_a and averages numeric fields", () => {
    const t = parseUnderstatTeams(liveTeams)["Aston Villa"];
    expect(t.xg_home).toBe(1.5);
    expect(t.xga_home).toBe(0.75);
    expect(t.npxg_home).toBe(1.25);
    expect(t.xg_away).toBe(0.5);
    expect(t.xga_away).toBe(2);
    expect(t.form).toBe("LWD");
  });

  it("still reads the legacy string shape with isHome", () => {
    const legacy = {
      "1": { id: "1", title: "X", history: [{ isHome: "1", xG: "1.2", xGA: "0.8", npxG: "1.2", result: "w" }] },
    };
    expect(parseUnderstatTeams(legacy).X.xg_home).toBe(1.2);
  });

  it("returns {} for a payload without teams", () => {
    expect(parseUnderstatTeams(undefined)).toEqual({});
    expect(parseUnderstatTeams({})).toEqual({});
  });
});

describe("understatSeason", () => {
  it("keys the season by its starting year", () => {
    expect(understatSeason(new Date("2026-10-01T00:00:00Z"))).toBe(2026);
    expect(understatSeason(new Date("2027-03-01T00:00:00Z"))).toBe(2026);
  });
});

describe("fetchLeagueXG", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls the JSON endpoint with the XHR header and parses teams", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ teams: liveTeams, players: [], dates: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const map = await fetchLeagueXG("PL");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/understat\.com\/getLeagueData\/EPL\/\d{4}$/);
    expect((init.headers as Record<string, string>)["X-Requested-With"]).toBe("XMLHttpRequest");
    expect(map["Aston Villa"].xg_home).toBe(1.5);
  });

  it("degrades to {} on HTTP error, non-JSON body or unsupported league (never fake xG)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>404</html>", { status: 404 })));
    expect(await fetchLeagueXG("PL")).toEqual({});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>ok</html>", { status: 200 })));
    expect(await fetchLeagueXG("SA")).toEqual({});
    expect(await fetchLeagueXG("DED")).toEqual({});
  });
});

describe("xgBlendBaseline (shadow gate)", () => {
  const team = (h: number, a: number): TeamXG => ({
    name: "t", xg_home: h, xga_home: 1, xg_away: a, xga_away: 1,
    npxg_home: h, npxg_away: a, ppda: 10, form: "", xpts: 1,
  });
  const map = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`T${i}`, team(1.5, 1.1)]));

  it("is null unless XG_BLEND_ENABLED=1, so served probabilities do not move", () => {
    expect(xgBlendBaseline(map, {})).toBeNull();
    expect(xgBlendBaseline(map, { XG_BLEND_ENABLED: "0" })).toBeNull();
  });

  it("returns the league baseline when enabled", () => {
    const b = xgBlendBaseline(map, { XG_BLEND_ENABLED: "1" })!;
    expect(b.home).toBeCloseTo(1.5);
    expect(b.away).toBeCloseTo(1.1);
  });
});

describe("matchTeam (football-data names → Understat titles)", () => {
  const t = (name: string): TeamXG => ({
    name, xg_home: 1, xga_home: 1, xg_away: 1, xga_away: 1, npxg_home: 1, npxg_away: 1, ppda: 1, form: "", xpts: 1,
  });
  const map = (names: string[]) => Object.fromEntries(names.map((n) => [n, t(n)]));

  it("never swaps Paris FC and PSG, nor Inter and Milan, whatever the key order", () => {
    for (const m of [map(["Paris FC", "Paris Saint Germain"]), map(["Paris Saint Germain", "Paris FC"])]) {
      expect(matchTeam("Paris FC", m)?.name).toBe("Paris FC");
      expect(matchTeam("Paris Saint-Germain FC", m)?.name).toBe("Paris Saint Germain");
    }
    for (const m of [map(["AC Milan", "Inter"]), map(["Inter", "AC Milan"])]) {
      expect(matchTeam("FC Internazionale Milano", m)?.name).toBe("Inter");
      expect(matchTeam("AC Milan", m)?.name).toBe("AC Milan");
    }
  });

  it("resolves the board names measured unmatched on 2026-10-01", () => {
    const m = map([
      "FC Cologne", "Bayer Leverkusen", "Borussia M.Gladbach", "Bayern Munich", "RasenBallsport Leipzig",
      "Rennes", "Atletico Madrid", "Alaves", "Malaga", "Celta Vigo", "Deportivo La Coruna", "Racing Santander",
      "Real Madrid", "Real Sociedad", "Borussia Dortmund",
    ]);
    const cases: [string, string][] = [
      ["1. FC Köln", "FC Cologne"], ["Bayer 04 Leverkusen", "Bayer Leverkusen"],
      ["Borussia Mönchengladbach", "Borussia M.Gladbach"], ["FC Bayern München", "Bayern Munich"],
      ["RB Leipzig", "RasenBallsport Leipzig"], ["Stade Rennais FC 1901", "Rennes"],
      ["Club Atlético de Madrid", "Atletico Madrid"], ["Deportivo Alavés", "Alaves"], ["Málaga CF", "Malaga"],
      ["RC Celta de Vigo", "Celta Vigo"], ["RC Deportivo La Coruña", "Deportivo La Coruna"],
      ["Real Racing Club de Santander", "Racing Santander"], ["Real Madrid CF", "Real Madrid"],
      ["Borussia Dortmund", "Borussia Dortmund"],
    ];
    for (const [fd, us] of cases) expect(matchTeam(fd, m)?.name, fd).toBe(us);
  });

  it("returns null on an ambiguous fuzzy match instead of guessing", () => {
    expect(matchTeam("Real", map(["Real Madrid", "Real Sociedad"]))).toBeNull();
  });
});
