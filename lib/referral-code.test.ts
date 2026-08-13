import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { currentRefCode, writeRefCode } from "./referral-code";

/** Sostituisce localStorage con uno che LANCIA, come Safari in navigazione
 *  privata e come i browser interni delle app (WhatsApp/Instagram). */
function blockStorage() {
  const boom = () => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => ({ getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }),
  });
}

let realStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  realStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  try { window.localStorage.clear(); } catch { /* già bloccato */ }
});

afterEach(() => {
  if (realStorage) Object.defineProperty(window, "localStorage", realStorage);
});

describe("currentRefCode", () => {
  it("prende il codice dallo storage quando c'è", () => {
    writeRefCode("AMICO");
    expect(currentRefCode("")).toBe("AMICO");
  });

  it("first-touch: lo storage vince sulla URL, un link nuovo non ruba l'attribuzione", () => {
    writeRefCode("AMICO");
    expect(currentRefCode("?ref=MAVEN30")).toBe("AMICO");
  });

  it("senza niente in storage legge il codice dalla URL", () => {
    expect(currentRefCode("?ref=MAVEN30")).toBe("MAVEN30");
  });

  it("normalizza il codice della URL come fa il rail", () => {
    expect(currentRefCode("?ref=maven30")).toBe("MAVEN30");
  });

  it("un codice non valido nella URL non passa", () => {
    expect(currentRefCode("?ref=MA%20VEN")).toBeNull();
    expect(currentRefCode("?ref=A")).toBeNull();
  });

  it("senza codice da nessuna parte è null", () => {
    expect(currentRefCode("")).toBeNull();
    expect(currentRefCode("?utm_source=x")).toBeNull();
  });

  // Il difetto misurato il 2026-08-13: con lo storage bloccato la pagina carica,
  // ma il codice non veniva MAI recuperato → iscrizione senza il mese gratis,
  // in silenzio. La URL è la fonte che sopravvive a uno storage rotto.
  it("con lo storage BLOCCATO recupera comunque il codice dalla URL", () => {
    blockStorage();
    expect(currentRefCode("?ref=MAVEN30")).toBe("MAVEN30");
  });

  it("con lo storage BLOCCATO e nessun codice nella URL resta null senza lanciare", () => {
    blockStorage();
    expect(() => currentRefCode("")).not.toThrow();
    expect(currentRefCode("")).toBeNull();
  });
});
