import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// #ATTRIB-EVERYWHERE-0915 — 15 iscrizioni su 21 senza sorgente identificabile,
// nello stesso mese di 180 post IG, 42 card Telegram, 16 invii email, 3 dirette
// Kick e 7 reel. Non perche' non arrivasse nessuno: perche' il page_view
// registrava `meta.path` e nient'altro, e i tag che i nostri link portano gia'
// (utm_*, crm, src) venivano buttati via all'arrivo.

const pathname = vi.hoisted(() => ({ value: "/tools" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import PageViewTracker from "./PageViewTracker";

let calls: Record<string, unknown>[] = [];

function setUrl(href: string) {
  window.history.replaceState({}, "", href);
}

function setReferrer(v: string) {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => v });
}

beforeEach(() => {
  calls = [];
  pathname.value = "/tools";
  localStorage.clear();
  sessionStorage.clear();
  setUrl("/tools");
  setReferrer("");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url) === "/api/track") calls.push(JSON.parse(String(init?.body ?? "{}")));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setReferrer("");
});

const meta = (i = 0) => calls[i]?.meta as Record<string, unknown>;

describe("PageViewTracker — ogni visita dice da dove arriva", () => {
  it("il path resta dov'era: nessuna query esistente si rompe", () => {
    render(<PageViewTracker />);
    expect(calls).toHaveLength(1);
    expect(calls[0].event_type).toBe("page_view");
    expect(meta().path).toBe("/tools");
  });

  it("cattura gli utm del profilo Reddit", () => {
    setUrl("/tools?utm_source=reddit&utm_medium=profile&utm_campaign=algobetting");
    render(<PageViewTracker />);
    expect(meta()).toMatchObject({
      path: "/tools",
      utm_source: "reddit",
      utm_medium: "profile",
      utm_campaign: "algobetting",
    });
  });

  it("cattura il tag Telegram e quello delle email", () => {
    setUrl("/tools/kelly-calculator?src=tg-free");
    render(<PageViewTracker />);
    expect(meta().src).toBe("tg-free");
    cleanup();
    calls = [];
    setUrl("/plans?crm=wb_day7_renew");
    render(<PageViewTracker />);
    expect(meta().crm).toBe("wb_day7_renew");
  });

  // Il canale che NON porta nulla nell'URL (un thread Reddit, un post su X, un
  // blog che ci cita) lascia una sola traccia: l'header Referer.
  it("registra l'host del referrer esterno, mai la sua URL", () => {
    setReferrer("https://www.reddit.com/r/sportsbook/comments/abc/thread-title/");
    render(<PageViewTracker />);
    expect(meta().ref_host).toBe("www.reddit.com");
    expect(JSON.stringify(meta())).not.toContain("thread-title");
  });

  it("il referrer interno non e' una sorgente", () => {
    setReferrer(`${window.location.origin}/`);
    render(<PageViewTracker />);
    expect(meta().ref_host).toBeUndefined();
  });

  // document.referrer NON cambia durante le navigazioni client-side: allegarlo a
  // ogni page_view direbbe che tutte le pagine della sessione arrivano da Reddit.
  it("l'host del referrer si registra solo sulla pagina d'ingresso", () => {
    setReferrer("https://www.reddit.com/r/sportsbook/");
    const view = render(<PageViewTracker />);
    expect(meta(0).ref_host).toBe("www.reddit.com");
    pathname.value = "/plans";
    view.rerender(<PageViewTracker />);
    expect(calls).toHaveLength(2);
    expect(meta(1).path).toBe("/plans");
    expect(meta(1).ref_host).toBeUndefined();
  });

  // Il gate del consenso non si sposta: la cattura anonima e' un dato che
  // l'utente porta lui, il session_id no.
  it("senza consenso l'evento parte anonimo e non crea identificatori", () => {
    setUrl("/tools?utm_source=reddit");
    setReferrer("https://www.reddit.com/");
    render(<PageViewTracker />);
    expect(calls[0].session_id).toBeUndefined();
    expect(sessionStorage.getItem("am_sid")).toBeNull();
    expect(localStorage.getItem("am_attrib")).toBeNull(); // first-touch persistente: ancora gated
    expect(meta().utm_source).toBe("reddit"); // ma la sorgente la sappiamo lo stesso
  });

  it("col consenso il first-touch persistente torna a scriversi", () => {
    localStorage.setItem("gdpr_consent", "accepted");
    setUrl("/tools?utm_source=reddit");
    render(<PageViewTracker />);
    expect(JSON.parse(localStorage.getItem("am_attrib") ?? "{}").utm_source).toBe("reddit");
    expect(typeof calls[0].session_id).toBe("string");
  });

  // Superare il cap butta via l'INTERO meta lato route, path compreso.
  it("un path assurdo non fa saltare il cap di 2048 byte del meta", () => {
    pathname.value = `/${"x".repeat(5000)}`;
    render(<PageViewTracker />);
    expect(String(meta().path)).toHaveLength(512);
    expect(JSON.stringify(meta()).length).toBeLessThan(2048);
  });
});
