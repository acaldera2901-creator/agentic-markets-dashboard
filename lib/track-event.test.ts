import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackEvent, getSessionId } from "./track-event";

// #STORAGE-CRASH-0813 — il bug che questi test chiudono.
// `trackEvent` leggeva `localStorage` FUORI da un try (la riga sotto, per il
// consenso, era invece protetta). In un browser che vieta lo storage — Safari in
// navigazione privata, i browser interni di WhatsApp/Instagram, i profili con i
// cookie bloccati — quella lettura LANCIA. Siccome trackEvent è chiamato da un
// useEffect al mount del desk (`trackEvent("page_view")`) e da ogni click su
// lingua/tema/tab/partner, l'eccezione risaliva fino al boundary globale e
// l'utente vedeva "Qualcosa non ha caricato correttamente" al posto del sito.
// Riprodotto con Playwright il 2026-08-13; lo stack indicava esattamente questa riga.
// Un beacon di analytics non può poter spegnere il prodotto.

const REAL_LOCAL = Object.getOwnPropertyDescriptor(window, "localStorage");
const REAL_SESSION = Object.getOwnPropertyDescriptor(window, "sessionStorage");

function block(which: "localStorage" | "sessionStorage") {
  const boom = () => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  };
  Object.defineProperty(window, which, {
    configurable: true,
    get: () => ({ getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }),
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  if (REAL_LOCAL) Object.defineProperty(window, "localStorage", REAL_LOCAL);
  if (REAL_SESSION) Object.defineProperty(window, "sessionStorage", REAL_SESSION);
  vi.unstubAllGlobals();
});

/** Il body dell'ultima POST verso /api/track. */
function sent(): Record<string, unknown> {
  const call = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(String((call[1] as RequestInit).body));
}

describe("trackEvent con lo storage bloccato", () => {
  it("NON lancia: un beacon non può spegnere la pagina", () => {
    block("localStorage");
    expect(() => trackEvent("page_view")).not.toThrow();
  });

  it("il beacon parte lo stesso, senza lingua", () => {
    block("localStorage");
    trackEvent("page_view");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent().event_type).toBe("page_view");
    expect(sent().language).toBeUndefined();
  });

  it("una lingua passata esplicitamente arriva anche senza storage", () => {
    block("localStorage");
    trackEvent("language_change", { language: "it" });
    expect(sent().language).toBe("it");
  });

  it("con sessionStorage bloccato non lancia e non inventa un id", () => {
    block("sessionStorage");
    window.localStorage.setItem("gdpr_consent", "accepted"); // consenso dato
    expect(() => trackEvent("tab_click")).not.toThrow();
    expect(sent().session_id).toBeUndefined();
  });

  it("getSessionId non lancia con lo storage bloccato", () => {
    block("sessionStorage");
    expect(() => getSessionId()).not.toThrow();
  });
});

describe("trackEvent col browser normale (nessuna regressione)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("legge la lingua dallo storage", () => {
    window.localStorage.setItem("agentic-lang", "it");
    trackEvent("page_view");
    expect(sent().language).toBe("it");
  });

  it("senza consenso non manda nessun session_id", () => {
    trackEvent("page_view");
    expect(sent().session_id).toBeUndefined();
  });

  it("col consenso manda un session_id stabile", () => {
    window.localStorage.setItem("gdpr_consent", "accepted");
    trackEvent("page_view");
    const first = sent().session_id;
    expect(typeof first).toBe("string");
    trackEvent("page_view");
    expect(sent().session_id).toBe(first);
  });
});
