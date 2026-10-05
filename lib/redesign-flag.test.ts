import { describe, expect, it } from "vitest";
import { cookieOverride, envFlagOn, readCookieValue, resolveRedesign, safeReturnPath } from "./redesign-flag";

describe("redesign flag (#REDESIGN-V3C F0)", () => {
  it("è OFF di default: variabile assente, vuota o con un valore ignoto", () => {
    expect(envFlagOn(undefined)).toBe(false);
    expect(envFlagOn("")).toBe(false);
    expect(envFlagOn("maybe")).toBe(false);
    expect(resolveRedesign(undefined, undefined)).toBe(false);
  });

  it("si accende solo con un sì esplicito", () => {
    for (const v of ["1", "true", "on", "TRUE", " yes "]) expect(envFlagOn(v)).toBe(true);
    for (const v of ["0", "false", "off", "2"]) expect(envFlagOn(v)).toBe(false);
  });

  it("il cookie vince sulla variabile, in entrambe le direzioni", () => {
    expect(resolveRedesign(undefined, "1")).toBe(true);
    expect(resolveRedesign("1", "0")).toBe(false);
    expect(resolveRedesign("1", undefined)).toBe(true);
  });

  it("un cookie che non capiamo non decide", () => {
    expect(cookieOverride("banana")).toBeNull();
    expect(resolveRedesign("1", "banana")).toBe(true);
    expect(resolveRedesign(undefined, "banana")).toBe(false);
  });

  it("legge il cookie da una stringa document.cookie", () => {
    expect(readCookieValue("a=1; br_redesign=1; c=3", "br_redesign")).toBe("1");
    expect(readCookieValue("br_redesign=%31", "br_redesign")).toBe("1");
    expect(readCookieValue("a=1", "br_redesign")).toBeNull();
    expect(readCookieValue(undefined, "br_redesign")).toBeNull();
  });

  it("il ritorno dopo il cookie resta sulla stessa origine", () => {
    expect(safeReturnPath("/tools")).toBe("/tools");
    expect(safeReturnPath("//evil.example")).toBe("/dev/ds");
    expect(safeReturnPath("https://evil.example")).toBe("/dev/ds");
    expect(safeReturnPath(null)).toBe("/dev/ds");
  });
});
