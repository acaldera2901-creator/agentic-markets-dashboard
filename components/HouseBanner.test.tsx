import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HouseBanner } from "./HouseBanner";
import { HOUSE_CAMPAIGNS } from "@/lib/house-banners";

// #ATTRIB-EVERYWHERE-0915 — il banner house aveva una SECONDA implementazione del
// beacon che creava `am_sid` e lo mandava SEMPRE, anche a chi aveva rifiutato il
// banner cookie. In produzione si misuravano due eventi a 26 ms di distanza sullo
// stesso caricamento, uno con session_id e uno senza: il primo era lecito, il
// secondo era il consenso aggirato. Questi test tengono il banner sulla regola
// condivisa di lib/track-event, che e' l'unico posto dove quella regola deve vivere.

// Il creativo Ole (campagne con `creative`) rende un <img> e non il ramo con la
// copy: per i test di tracking basta una campagna qualunque, la scelta e' la
// prima dell'elenco reale — se cambia, il test resta valido.
const campaign = HOUSE_CAMPAIGNS[0];

let calls: { url: string; body: Record<string, unknown>; init?: RequestInit }[] = [];

beforeEach(() => {
  calls = [];
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")), init });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tracked = () => calls.filter((c) => c.url === "/api/track");

describe("HouseBanner — il tracking passa dal gate del consenso", () => {
  it("senza consenso la view parte anonima e NON crea un identificatore", () => {
    render(<HouseBanner campaign={campaign} lang="it" />);
    const ev = tracked();
    expect(ev).toHaveLength(1);
    expect(ev[0].body.event_type).toBe("house_banner_view");
    expect(ev[0].body.session_id).toBeUndefined();
    // Questa e' la riga che falliva prima del fix: il banner scriveva am_sid
    // di nascosto anche a chi non aveva accettato nulla.
    expect(sessionStorage.getItem("am_sid")).toBeNull();
  });

  it("col consenso allega il session_id, come ogni altro evento", () => {
    localStorage.setItem("gdpr_consent", "accepted");
    render(<HouseBanner campaign={campaign} lang="it" />);
    const ev = tracked();
    expect(ev).toHaveLength(1);
    expect(typeof ev[0].body.session_id).toBe("string");
  });

  it("usa lo stesso id della sessione, non uno suo", () => {
    localStorage.setItem("gdpr_consent", "accepted");
    sessionStorage.setItem("am_sid", "sid-gia-esistente");
    render(<HouseBanner campaign={campaign} lang="it" />);
    expect(tracked()[0].body.session_id).toBe("sid-gia-esistente");
  });

  it("il meta della campagna resta quello di prima", () => {
    render(<HouseBanner campaign={campaign} lang="it" />);
    expect(tracked()[0].body.meta).toEqual({ campaign_id: campaign.id, slot: campaign.slot });
  });

  it("anche dismiss e click passano dal gate", () => {
    render(<HouseBanner campaign={campaign} lang="it" />);
    fireEvent.click(screen.getByRole("button", { name: /chiudi/i }));
    const ev = tracked();
    expect(ev.at(-1)?.body.event_type).toBe("house_banner_dismiss");
    expect(ev.every((c) => c.body.session_id === undefined)).toBe(true);
    expect(sessionStorage.getItem("am_sid")).toBeNull();
  });

  it("il banner sparisce alla chiusura: il comportamento visivo non cambia", () => {
    const { container } = render(<HouseBanner campaign={campaign} lang="it" />);
    expect(container.querySelector(".house-banner")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /chiudi/i }));
    expect(container.querySelector(".house-banner")).toBeNull();
    expect(localStorage.getItem("br_house_dismissed")).toContain(campaign.id);
  });

  it("se il beacon fallisce il banner resta in piedi", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(() => render(<HouseBanner campaign={campaign} lang="it" />)).not.toThrow();
    expect(document.querySelector(".house-banner")).not.toBeNull();
  });
});
