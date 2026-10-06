import { describe, it, expect } from "vitest";
import { analyticsWriteAllowed } from "./events-write-gate";

// #SESSIONI-1006 leva 1 — 223 page_view/30g scritti da dev/test sul DB di prod.
describe("analyticsWriteAllowed", () => {
  it("produzione scrive", () => {
    expect(analyticsWriteAllowed({ VERCEL_ENV: "production" })).toBe(true);
  });
  it("preview, development e locale (nessun VERCEL_ENV) non scrivono", () => {
    expect(analyticsWriteAllowed({ VERCEL_ENV: "preview" })).toBe(false);
    expect(analyticsWriteAllowed({ VERCEL_ENV: "development" })).toBe(false);
    expect(analyticsWriteAllowed({})).toBe(false);
  });
  it("TRACK_ALLOW_WRITE=1 e' l'override esplicito; altri valori no", () => {
    expect(analyticsWriteAllowed({ VERCEL_ENV: "preview", TRACK_ALLOW_WRITE: "1" })).toBe(true);
    expect(analyticsWriteAllowed({ TRACK_ALLOW_WRITE: "1" })).toBe(true);
    expect(analyticsWriteAllowed({ TRACK_ALLOW_WRITE: "true" })).toBe(false);
    expect(analyticsWriteAllowed({ TRACK_ALLOW_WRITE: "0" })).toBe(false);
  });
});
