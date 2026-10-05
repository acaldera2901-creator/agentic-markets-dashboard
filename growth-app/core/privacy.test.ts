import { describe, expect, it } from "vitest";
import { coarsenLabel, coarsenRows, registrableDomain } from "./privacy";

describe("privacy guard on labels", () => {
  it("cuts referrer hosts to the registrable domain", () => {
    expect(registrableDomain("betredge-studio-0922.mario-rossi-7829.chatgpt.site")).toBe("chatgpt.site");
    expect(registrableDomain("www.google.com")).toBe("google.com");
    expect(registrableDomain("www.google.co.uk")).toBe("google.co.uk");
    expect(registrableDomain("chatgpt.com")).toBe("chatgpt.com");
  });

  it("masks referral codes, leaves campaign labels alone", () => {
    expect(coarsenLabel("ref:mario99")).toBe("ref:(codice referral)");
    expect(coarsenLabel("coldmail")).toBe("coldmail");
    expect(coarsenLabel("(nessuna fonte)")).toBe("(nessuna fonte)");
  });

  it("sums counts of rows that collapse to the same label — never drops or invents", () => {
    const rows = [
      { source: "(nessuna fonte)", sessions: 10 },
      { source: "referrer:www.google.com", sessions: 2 },
      { source: "referrer:google.com", sessions: 3 },
      { source: "ref:a", sessions: 1 },
      { source: "ref:b", sessions: 1 },
    ];
    const out = coarsenRows(rows, "source", "sessions");
    expect(out).toEqual([
      { source: "(nessuna fonte)", sessions: 10 },
      { source: "referrer:google.com", sessions: 5 },
      { source: "ref:(codice referral)", sessions: 2 },
    ]);
    const total = (r: { sessions: number }[]) => r.reduce((s, x) => s + x.sessions, 0);
    expect(total(out)).toBe(total(rows));
  });
});
