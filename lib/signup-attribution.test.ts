// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { signupAttribution, sanitizeAttribution } from "./attribution";
import { consentedSessionId } from "./track-event";

// #G2-TRACKING-1110 — attribuzione sempre presente al signup, anche senza consenso.

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("signupAttribution", () => {
  it("senza consenso legge la pagina del signup, senza scrivere nello storage", () => {
    window.history.replaceState({}, "", "/tools?utm_source=ig&utm_medium=bio&ref=DLANOR");
    const a = signupAttribution();
    expect(a).toMatchObject({ utm_source: "ig", utm_medium: "bio", ref: "DLANOR", landing_path: "/tools", capture: "signup_page" });
    expect(localStorage.getItem("am_attrib")).toBeNull();
    expect(sanitizeAttribution(a)).toEqual(a);
  });

  it("col first-touch salvato usa quello e lo marca", () => {
    localStorage.setItem("am_attrib", JSON.stringify({ utm_source: "reddit", landing_path: "/" }));
    expect(signupAttribution()).toEqual({ utm_source: "reddit", landing_path: "/", capture: "first_touch" });
  });
});

describe("consentedSessionId", () => {
  it("null senza consenso, id col consenso", () => {
    expect(consentedSessionId()).toBeNull();
    localStorage.setItem("gdpr_consent", "accepted");
    expect(consentedSessionId()).toMatch(/^[a-z0-9]{6,64}$/);
  });
});
