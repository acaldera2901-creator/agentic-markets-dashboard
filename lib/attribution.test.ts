import { describe, it, expect, beforeEach } from "vitest";
import { initAttribution, getAttribution, sanitizeAttribution, acquisitionJson } from "./attribution";

// #FUNNEL-MEAS-0813 — la regola che questi test difendono: l'attribuzione è
// FIRST-touch (la sorgente che ha portato l'utente la prima volta, non l'ultima)
// e il payload che arriva al DB è sanificato, perché lo scrive il client.

const setUrl = (url: string) => window.history.replaceState({}, "", url);

beforeEach(() => {
  window.localStorage.clear();
  setUrl("/");
  Object.defineProperty(document, "referrer", { value: "", configurable: true });
});

describe("initAttribution", () => {
  it("cattura utm + landing path al primo caricamento", () => {
    setUrl("/tools?utm_source=reddit&utm_medium=post&utm_campaign=aug");
    initAttribution();
    const a = getAttribution();
    expect(a?.utm_source).toBe("reddit");
    expect(a?.utm_medium).toBe("post");
    expect(a?.utm_campaign).toBe("aug");
    expect(a?.landing_path).toBe("/tools");
    expect(a?.first_seen).toBeTruthy();
  });

  it("non sovrascrive mai un record esistente (first-touch)", () => {
    setUrl("/?utm_source=reddit");
    initAttribution();
    setUrl("/weekly-pick?utm_source=newsletter");
    initAttribution();
    expect(getAttribution()?.utm_source).toBe("reddit");
    expect(getAttribution()?.landing_path).toBe("/");
  });

  it("ignora il referrer interno: la navigazione nel sito non è una sorgente", () => {
    Object.defineProperty(document, "referrer", { value: `${window.location.origin}/tools`, configurable: true });
    initAttribution();
    expect(getAttribution()?.referrer).toBeUndefined();
  });

  it("registra il referrer esterno", () => {
    Object.defineProperty(document, "referrer", { value: "https://www.google.com/", configurable: true });
    initAttribution();
    expect(getAttribution()?.referrer).toBe("https://www.google.com/");
  });

  it("traffico diretto: nessun utm, ma la landing resta misurata", () => {
    setUrl("/partners");
    initAttribution();
    expect(getAttribution()).toEqual(
      expect.objectContaining({ landing_path: "/partners" })
    );
  });
});

describe("sanitizeAttribution (trust boundary del server)", () => {
  it("scarta le chiavi sconosciute e i valori non stringa", () => {
    expect(sanitizeAttribution({ utm_source: "x", evil: "drop", utm_medium: 42 }))
      .toEqual({ utm_source: "x" });
  });

  it("tronca ogni valore a 200 caratteri", () => {
    const long = "a".repeat(500);
    expect(sanitizeAttribution({ utm_campaign: long })?.utm_campaign).toHaveLength(200);
  });

  it("null su input vuoto, non-oggetto o senza chiavi note", () => {
    expect(sanitizeAttribution(null)).toBeNull();
    expect(sanitizeAttribution("stringa")).toBeNull();
    expect(sanitizeAttribution([1, 2])).toBeNull();
    expect(sanitizeAttribution({ evil: "x" })).toBeNull();
  });

  it("acquisitionJson rende una stringa JSON o null", () => {
    expect(acquisitionJson({ utm_source: "reddit" })).toBe('{"utm_source":"reddit"}');
    expect(acquisitionJson(undefined)).toBeNull();
  });
});

describe("getAttribution", () => {
  it("null se il record è corrotto (il signup non deve mai rompersi)", () => {
    window.localStorage.setItem("am_attrib", "{non-json");
    expect(getAttribution()).toBeNull();
  });
});
