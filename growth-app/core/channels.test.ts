import { describe, expect, it } from "vitest";
import { MIN_SIGNUPS_FOR_PCT, chainRates, chainTotals, normalizeChain } from "./channels";
import { INTERNAL_ENTRY_LABEL } from "./estimate";

const row = (source: string, sessions: number, st: number, co: number, profiles: number, paying: number) => ({
  source,
  sessions,
  signup_started: st,
  signup_completed: co,
  profiles,
  paying,
});

describe("chain normalization", () => {
  it("referrers collapse to the registrable domain and their counts are summed", () => {
    const r = normalizeChain({
      ok: true,
      data: [
        row("referrer:www.google.com", 5, 1, 1, 0, 0),
        row("referrer:google.com", 3, 0, 0, 2, 1),
        row("referrer:betredge-studio-0922.mario-rossi-12.chatgpt.site", 1, 0, 0, 0, 0),
        row("referrer:someone-else.chatgpt.site", 1, 0, 0, 0, 0),
        row("ref:creator_handle", 2, 1, 0, 0, 0),
        row("instagram", 4, 0, 0, 1, 0),
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const by = Object.fromEntries(r.data.map((x) => [x.source, x]));
    expect(by["referrer:google.com"]).toEqual(row("referrer:google.com", 8, 1, 1, 2, 1));
    // #GROWTH-V7: our studio preview is folded into the internal row; another chatgpt.site host is coarsened.
    expect(by[INTERNAL_ENTRY_LABEL].sessions).toBe(1);
    expect(by["referrer:chatgpt.site"].sessions).toBe(1);
    expect(by["ref:(codice referral)"].sessions).toBe(2);
    expect(JSON.stringify(r.data)).not.toMatch(/mario|creator_handle/);
  });

  it("attribution holes are listed last, sources by sessions", () => {
    const r = normalizeChain({
      ok: true,
      data: [row("(non registrata)", 0, 0, 0, 30, 2), row("a", 1, 0, 0, 0, 0), row("b", 9, 0, 0, 0, 0), row("(signup senza sessione)", 0, 4, 2, 0, 0)],
    });
    expect(r.ok && r.data.map((x) => x.source)).toEqual(["b", "a", "(non registrata)", "(signup senza sessione)"]);
  });

  it("a failed read stays a failure; a non-numeric count fails loud", () => {
    expect(normalizeChain({ ok: false, error: "x" }).ok).toBe(false);
    expect(normalizeChain({ ok: true, data: [{ ...row("a", 1, 0, 0, 0, 0), sessions: "abc" }] }).ok).toBe(false);
  });
});

describe("chain rates — small samples get counts only", () => {
  it(`no percentage under ${MIN_SIGNUPS_FOR_PCT} signups`, () => {
    expect(chainRates(row("x", 100, 4, 3, 4, 2))).toEqual({ sessionToSignup: null, profileToPaying: null });
  });

  it("each rate stays inside its own attribution base", () => {
    const r = chainRates(row("x", 100, 5, 4, 10, 1));
    expect(r.sessionToSignup).toBeCloseTo(0.05);
    expect(r.profileToPaying).toBeCloseTo(0.1);
    expect(chainRates(row("x", 0, 6, 0, 0, 0)).sessionToSignup).toBeNull(); // no sessions: no division
  });

  it("totals expose the unattributed share", () => {
    const t = chainTotals([
      row("a", 10, 2, 1, 1, 0),
      row("(non registrata)", 0, 0, 0, 7, 1),
      row("(signup senza sessione)", 0, 3, 1, 0, 0),
      row("(sessione senza page_view nella finestra)", 0, 1, 0, 0, 0),
    ]);
    expect(t).toMatchObject({ sessions: 10, signup_started: 6, profiles: 8, paying: 1, profilesUnattributed: 7, signupsUnattributed: 4 });
  });

  // #GROWTH-V7 — the same fold as entries: explicit test sources on BOTH bases (sessions and profiles).
  it("internal/test sources fold into one row, kept out of the totals and listed last", () => {
    const r = normalizeChain({
      ok: true,
      data: [
        row("src:pr-check", 3, 0, 0, 0, 0),
        row("test123", 2, 1, 0, 0, 0),
        row("qa", 0, 0, 0, 1, 0),
        row("referrer:localhost:3000", 1, 0, 0, 0, 0),
        row("referrer:betredge-studio-0922.x-y-1.chatgpt.site", 4, 0, 0, 0, 0),
        row("(diretto / nessuna fonte)", 50, 3, 1, 2, 0),
        row("(signup senza sessione)", 0, 9, 0, 0, 0),
        row("coldmail", 4, 1, 0, 0, 0),
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.map((x) => x.source)).toEqual(["(diretto / nessuna fonte)", "coldmail", "(signup senza sessione)", INTERNAL_ENTRY_LABEL]);
    const t = chainTotals(r.data);
    expect(t.internal).toEqual(row(INTERNAL_ENTRY_LABEL, 10, 1, 0, 1, 0));
    expect(t).toMatchObject({ sessions: 54, signup_started: 13, profiles: 2 });
  });
});
