// #ODDS-LOG-1008 — fetchOdds writes one log line per league call and its
// return value is unchanged. The fake key below must never reach any log.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(async () => []) }));

import { fetchOdds, retryDelayMs } from "./odds-api";
import { _resetForTest, observeRemaining, ODDS_RESERVE } from "./odds-quota";

const FAKE_KEY = "fakeKEY0123456789secret";

type Spy = ReturnType<typeof vi.spyOn>;
let spies: Spy[] = [];

function logged(): string {
  return spies
    .flatMap((s) => s.mock.calls)
    .map((args) => args.map((a: unknown) => (typeof a === "string" ? a : JSON.stringify(a) ?? String(a))).join(" "))
    .join("\n");
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const EVENT_OK = {
  home_team: "Inter Milan",
  away_team: "Parma",
  bookmakers: [
    {
      key: "pinnacle",
      markets: [
        { key: "h2h", outcomes: [{ name: "Inter Milan", price: 1.15 }, { name: "Draw", price: 9.27 }, { name: "Parma", price: 15.7 }] },
        { key: "totals", outcomes: [{ name: "Over", price: 1.5, point: 2.5 }] },
      ],
    },
  ],
};
const EVENT_NO_H2H = { home_team: "Brest", away_team: "Angers", bookmakers: [] };

const EXPECTED_OK = [
  {
    homeNorm: "inter milan",
    awayNorm: "parma",
    oddsHome: 1.15,
    oddsDraw: 9.27,
    oddsAway: 15.7,
    bookmaker: "pinnacle",
    margin: Math.round((1 / 1.15 + 1 / 9.27 + 1 / 15.7 - 1) * 10000) / 10000,
    extra: {
      over_1_5: null,
      over_2_5: 1.5,
      over_3_5: null,
      btts_yes: null,
      btts_no: null,
      double_1x: null,
      double_x2: null,
      double_12: null,
    },
  },
];

beforeEach(() => {
  _resetForTest();
  process.env.ODDS_API_KEY = FAKE_KEY;
  spies = [
    vi.spyOn(console, "log").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "info").mockImplementation(() => {}),
  ];
});

afterEach(() => {
  // The key must never appear in any log line, whatever the outcome.
  expect(logged()).not.toContain(FAKE_KEY);
  expect(logged()).not.toContain("apiKey=");
  expect(logged()).not.toContain("the-odds-api.com");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ODDS_API_KEY;
});

describe("#ODDS-LOG-1008 fetchOdds per-league log, behaviour unchanged", () => {
  it("ok with N events: same results, logs events/results/credits", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([EVENT_OK, EVENT_NO_H2H], 200, { "x-requests-remaining": "4785526", "x-requests-used": "214474" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchOdds("SA");
    expect(out).toEqual(EXPECTED_OK);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const log = logged();
    expect(log).toContain("[odds-api SA]");
    expect(log).toContain("sport=soccer_italy_serie_a");
    expect(log).toContain("outcome=ok");
    expect(log).toContain("status=200");
    expect(log).toContain("events=2");
    expect(log).toContain("results=1");
    expect(log).toContain("remaining=4785526");
    expect(log).toContain("used=214474");
    expect(log).toMatch(/ms=\d+/);
    expect(spies.flatMap((s) => s.mock.calls)).toHaveLength(1);
  });

  it("ok with 0 events: returns [] and says so", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([], 200)));
    expect(await fetchOdds("BL1")).toEqual([]);
    const log = logged();
    expect(log).toContain("[odds-api BL1]");
    expect(log).toContain("outcome=empty");
    expect(log).toContain("events=0");
    expect(log).toContain("remaining=-");
  });

  it("events present but none with a full h2h: returns [] and logs results=0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([EVENT_NO_H2H], 200)));
    expect(await fetchOdds("FL1")).toEqual([]);
    expect(logged()).toContain("events=1");
    expect(logged()).toContain("results=0");
  });

  it("HTTP non-200: returns [] and logs the status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(`{"message":"bad key ${FAKE_KEY} apiKey=${FAKE_KEY}"}`, { status: 401, headers: { "x-requests-remaining": "0" } }),
      ),
    );
    expect(await fetchOdds("PL")).toEqual([]);
    const log = logged();
    expect(log).toContain("outcome=http_error");
    expect(log).toContain("status=401");
    expect(log).toContain("remaining=0");
  });

  // #ODDS-CORE-MARKETS-1026 — the endpoint never serves btts/double_chance
  // (live 422 on 2026-10-26): every league, top-5 included, asks only for
  // h2h,totals, in ONE call.
  it.each(["SA", "PL", "PD", "BL1", "FL1", "CL", "EL", "SB"])(
    "%s asks only h2h,totals in a single call",
    async (league) => {
      const fetchMock = vi.fn(async () => jsonResponse([EVENT_OK], 200));
      vi.stubGlobal("fetch", fetchMock);
      await fetchOdds(league);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
      expect(url.searchParams.get("markets")).toBe("h2h,totals");
    },
  );

  it("422 is no longer retried: one call, http_error, []", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: "INVALID_MARKET" }, 422));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchOdds("PD")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logged()).toContain("outcome=http_error");
    expect(logged()).toContain("status=422");
  });

  it("429 then 200: one delayed retry, odds attach, logs retried429=1", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ message: "EXCEEDED_FREQ_LIMIT" }, 429))
        .mockResolvedValueOnce(jsonResponse([EVENT_OK], 200, { "x-requests-remaining": "100" }));
      vi.stubGlobal("fetch", fetchMock);
      const pending = fetchOdds("SA");
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1); // waiting, not hammering
      await vi.advanceTimersByTimeAsync(2000);
      expect(await pending).toEqual(EXPECTED_OK);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(logged()).toContain("retried429=1");
      expect(logged()).toContain("status=200");
    } finally {
      vi.useRealTimers();
    }
  });

  it("429 twice: gives up after one retry, http_error, []", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(async () => jsonResponse({ message: "EXCEEDED_FREQ_LIMIT" }, 429, { "retry-after": "1" }));
      vi.stubGlobal("fetch", fetchMock);
      const pending = fetchOdds("FL1");
      await vi.advanceTimersByTimeAsync(1000);
      expect(await pending).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(logged()).toContain("outcome=http_error");
      expect(logged()).toContain("status=429");
      expect(logged()).toContain("retried429=1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("retryDelayMs honours Retry-After, caps it, and jitters without it", () => {
    expect(retryDelayMs("2")).toBe(2000);
    expect(retryDelayMs("60")).toBe(5000);
    expect(retryDelayMs("0")).toBe(0);
    for (const h of [null, "", "soon"]) {
      const d = retryDelayMs(h);
      expect(d).toBeGreaterThanOrEqual(1000);
      expect(d).toBeLessThan(2000);
    }
  });

  it("exception/timeout: returns [] and logs a scrubbed, truncated message", async () => {
    const url = `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${FAKE_KEY}&regions=eu`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(`request to ${url} failed, reason: ETIMEDOUT ${FAKE_KEY} ${"x".repeat(500)}`);
      }),
    );
    expect(await fetchOdds("PL")).toEqual([]);
    const log = logged();
    expect(log).toContain("outcome=exception");
    expect(log).toContain("ETIMEDOUT");
    expect(log.length).toBeLessThan(500);
  });

  it("non-JSON 200 body: returns [] and logs non_json", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>gateway</html>", { status: 200 })));
    expect(await fetchOdds("CL")).toEqual([]);
    expect(logged()).toContain("outcome=non_json");
    expect(logged()).toContain("status=200");
  });

  it("budget gate closed: no call, returns [], logs the skip", async () => {
    observeRemaining(String(ODDS_RESERVE - 1));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchOdds("SA")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged()).toContain("outcome=skipped_budget");
  });

  it("no api key: no call, returns [], logs the skip without leaking anything", async () => {
    delete process.env.ODDS_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchOdds("SA")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged()).toContain("outcome=skipped_no_key");
  });
});
