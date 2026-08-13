import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { storageGet, storageSet } from "./safe-storage";

const REAL = Object.getOwnPropertyDescriptor(window, "localStorage");

function block() {
  const boom = () => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => ({ getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }),
  });
}

beforeEach(() => {
  if (REAL) Object.defineProperty(window, "localStorage", REAL);
  window.localStorage.clear();
});
afterEach(() => {
  if (REAL) Object.defineProperty(window, "localStorage", REAL);
});

describe("storageGet / storageSet", () => {
  it("leggono e scrivono come localStorage quando funziona", () => {
    storageSet("agentic-lang", "it");
    expect(storageGet("agentic-lang")).toBe("it");
  });

  it("una chiave assente è null", () => {
    expect(storageGet("mai-scritta")).toBeNull();
  });

  // Il motivo per cui questo file esiste: in Safari privato, nei browser interni
  // delle app e coi cookie bloccati, `localStorage` LANCIA. Una lettura nuda
  // dentro un render o un effetto porta l'intera app nel boundary globale.
  it("con lo storage bloccato la lettura torna null invece di lanciare", () => {
    block();
    expect(() => storageGet("agentic-lang")).not.toThrow();
    expect(storageGet("agentic-lang")).toBeNull();
  });

  it("con lo storage bloccato la scrittura è un no-op silenzioso", () => {
    block();
    expect(() => storageSet("agentic-lang", "it")).not.toThrow();
  });

  it("dice se la scrittura è andata a buon fine", () => {
    expect(storageSet("k", "v")).toBe(true);
    block();
    expect(storageSet("k", "v")).toBe(false);
  });
});
