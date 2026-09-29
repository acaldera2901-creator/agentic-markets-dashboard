// components/SignupPopup.test.tsx — #SIGNUP-POPUP-D-0928 · #SESSION-POPUP-0929
//
// #SESSION-POPUP-0929 (direttiva Andrea, 29/09): il pop-up compare al PRIMO
// caricamento della sessione, su qualunque tab, una volta per sessione
// (sessionStorage), chiudibile. Resta ciò che non si somma: un overlay aperto
// (muro auth, checkout) e il banner cookie senza risposta lo fanno aspettare.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { SignupPopup, type SignupPopupProps } from "./SignupPopup";
import { SIGNUP_POPUP_POLL_MS, readSignupPopupMemory, readSignupPopupSession, noteSignupPopupBlocker } from "@/lib/signup-popup";

let calls: { url: string; body: Record<string, unknown> }[] = [];
let visibility: DocumentVisibilityState = "visible";

const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
};
const tracked = (type?: string) => calls.filter((c) => c.url === "/api/track" && (!type || c.body.event_type === type));
const popup = () => screen.queryByTestId("signup-popup");

// Avanza il tempo con l'orologio finto e lascia scattare il polling.
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const TICK = SIGNUP_POPUP_POLL_MS;

const baseProps: SignupPopupProps = {
  lang: "it", audience: "anon", cardOpen: false, overlayOpen: false,
  lockedToday: 12, settledCount: 1234,
  onCreateProfile: vi.fn(), onComparePlans: vi.fn(),
};

beforeEach(() => {
  calls = [];
  visibility = "visible";
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("gdpr_consent", "declined"); // il banner cookie ha avuto risposta
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 800 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("trigger: primo caricamento della sessione", () => {
  it("compare subito al caricamento, senza scroll né attesa — e lo traccia", () => {
    render(<SignupPopup {...baseProps} />);
    advance(TICK);
    expect(popup()).not.toBeNull();
    const ev = tracked("signup_popup_shown");
    expect(ev).toHaveLength(1);
    expect(ev[0].body.meta).toEqual({ audience: "anon" });
    expect(readSignupPopupSession().shown).toBe(true);
  });

  it("con un overlay aperto (muro auth, checkout) non si somma; chiuso quello, compare", () => {
    const { rerender } = render(<SignupPopup {...baseProps} overlayOpen />);
    advance(TICK * 10);
    expect(popup()).toBeNull();
    rerender(<SignupPopup {...baseProps} overlayOpen={false} />);
    advance(TICK);
    expect(popup()).not.toBeNull();
  });

  it("finché il banner cookie non ha risposta, aspetta; quando arriva, compare", () => {
    localStorage.removeItem("gdpr_consent");
    render(<SignupPopup {...baseProps} />);
    advance(TICK * 10);
    expect(popup()).toBeNull();
    localStorage.setItem("gdpr_consent", "accepted");
    advance(TICK);
    expect(popup()).not.toBeNull();
  });

  it("aperta in una scheda nascosta: compare quando la scheda torna visibile", () => {
    visibility = "hidden";
    render(<SignupPopup {...baseProps} />);
    advance(TICK * 10);
    expect(popup()).toBeNull();
    setVisibility("visible");
    advance(TICK);
    expect(popup()).not.toBeNull();
  });
});

describe("a chi non compare, e quando non ricompare", () => {
  it("audience null (Pro, sessione non verificata): niente", () => {
    render(<SignupPopup {...baseProps} audience={null} />);
    advance(TICK * 10);
    expect(popup()).toBeNull();
  });

  it("se in sessione ha già visto i piani (o cliccato una CTA, o aperto la registrazione): no", () => {
    noteSignupPopupBlocker("plans");
    render(<SignupPopup {...baseProps} />);
    advance(TICK * 10);
    expect(popup()).toBeNull();
  });

  it("già mostrato in questa sessione: cambiare tab (nuovo mount) non lo ripropone", () => {
    const first = render(<SignupPopup {...baseProps} />);
    advance(TICK);
    fireEvent.click(screen.getByRole("button", { name: "Non ora" }));
    first.unmount();
    render(<SignupPopup {...baseProps} />);
    advance(TICK * 10);
    expect(popup()).toBeNull();
    expect(tracked("signup_popup_shown")).toHaveLength(1);
  });

  it("sessione nuova (sessionStorage vuoto): torna anche se chiuso due volte ieri", () => {
    localStorage.setItem("br_signup_popup", JSON.stringify({ dismissals: 2, lastDismissedAt: Date.now() - 86_400_000, never: false }));
    render(<SignupPopup {...baseProps} />);
    advance(TICK);
    expect(popup()).not.toBeNull();
  });

  it("«Non mostrarlo più» in passato: non torna nemmeno in una sessione nuova", () => {
    localStorage.setItem("br_signup_popup", JSON.stringify({ dismissals: 0, lastDismissedAt: null, never: true }));
    render(<SignupPopup {...baseProps} />);
    advance(TICK * 10);
    expect(popup()).toBeNull();
  });
});

const show = (props: Partial<SignupPopupProps> = {}) => {
  const r = render(<SignupPopup {...baseProps} {...props} />);
  advance(TICK);
  expect(popup()).not.toBeNull();
  return r;
};

describe("chiusura: memoria, evento, focus", () => {
  it("apre col focus sul titolo e lo restituisce alla chiusura", () => {
    render(<button type="button">prima</button>);
    screen.getByText("prima").focus();
    show();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 }));
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(popup()).toBeNull();
    expect(document.activeElement).toBe(screen.getByText("prima"));
  });

  it("la X (44px) conta una chiusura e traccia il motivo", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(readSignupPopupMemory()).toMatchObject({ dismissals: 1, never: false });
    expect(tracked("signup_popup_dismissed")[0].body.meta).toEqual({ audience: "anon", reason: "x" });
  });

  it("«Non ora» chiude allo stesso modo", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Non ora" }));
    expect(popup()).toBeNull();
    expect(readSignupPopupMemory().dismissals).toBe(1);
    expect(tracked("signup_popup_dismissed")[0].body.meta).toEqual({ audience: "anon", reason: "not_now" });
  });

  it("Esc chiude", () => {
    show();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(popup()).toBeNull();
    expect(tracked("signup_popup_dismissed")[0].body.meta).toEqual({ audience: "anon", reason: "esc" });
  });

  it("«Non mostrarlo più» è definitivo, subito", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Non mostrarlo più" }));
    expect(popup()).toBeNull();
    expect(readSignupPopupMemory().never).toBe(true);
    expect(tracked("signup_popup_dismissed")[0].body.meta).toEqual({ audience: "anon", reason: "never" });
  });

  it("non riappare nella stessa sessione dopo una chiusura", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Non ora" }));
    advance(TICK * 20);
    expect(popup()).toBeNull();
    expect(tracked("signup_popup_shown")).toHaveLength(1);
  });
});

describe("le CTA", () => {
  it("anonimo: la primaria apre la registrazione, traccia, e vale come chiusura", () => {
    const onCreateProfile = vi.fn();
    show({ onCreateProfile });
    fireEvent.click(screen.getByRole("button", { name: "Crea il profilo gratuito" }));
    expect(onCreateProfile).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
    expect(tracked("signup_popup_cta_click")[0].body.meta).toEqual({ audience: "anon", cta: "primary" });
    expect(tracked("signup_popup_dismissed")).toHaveLength(0);
    expect(readSignupPopupMemory().dismissals).toBe(1);
  });

  it("«Confronta i piani» porta ai piani", () => {
    const onComparePlans = vi.fn();
    show({ onComparePlans });
    fireEvent.click(screen.getByRole("button", { name: "Confronta i piani" }));
    expect(onComparePlans).toHaveBeenCalledTimes(1);
    expect(tracked("signup_popup_cta_click")[0].body.meta).toEqual({ audience: "anon", cta: "plans" });
  });

  it("Free: titolo e corpo cambiano, la primaria è «Vedi Base» e porta ai piani", () => {
    const onComparePlans = vi.fn();
    show({ audience: "free", onComparePlans, lockedToday: 9 });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Le tue 3 letture di oggi sono aperte");
    expect(screen.getByText(/Il board ne ha altre 9 oggi/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vedi Base" }));
    expect(onComparePlans).toHaveBeenCalledTimes(1);
    expect(tracked("signup_popup_shown")[0].body.meta).toEqual({ audience: "free" });
  });

  // #SESSION-POPUP-0929: Base riceve l'invito all'upgrade verso Pro.
  it("Base: invito all'upgrade, la primaria è «Vedi Pro» e porta ai piani", () => {
    const onComparePlans = vi.fn();
    const onCreateProfile = vi.fn();
    show({ audience: "base", onComparePlans, onCreateProfile, lockedToday: 9 });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Le tue 7 letture per sport di oggi sono aperte");
    expect(screen.getByText(/Il board ne ha altre 9 oggi/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vedi Pro" }));
    expect(onComparePlans).toHaveBeenCalledTimes(1);
    expect(onCreateProfile).not.toHaveBeenCalled();
    expect(tracked("signup_popup_shown")[0].body.meta).toEqual({ audience: "base" });
    expect(tracked("signup_popup_cta_click")[0].body.meta).toEqual({ audience: "base", cta: "primary" });
  });
});

describe("contenuto: prezzi veri, prova sociale solo se vera, niente pressione", () => {
  it("i tre piani con mensile e giorno, Pro senza «14»", () => {
    show();
    const el = popup()!;
    expect(el.textContent).toContain("$14,99");
    const text = el.textContent!.replace(/\u00a0/g, " ");
    expect(text).toContain("≈ $0,50 al giorno");
    expect(el.textContent).toContain("$29,99");
    expect(text).toContain("≈ $1 al giorno");
    expect(el.textContent).toContain("Tutto il board");
    expect(el.textContent).not.toMatch(/fino a 14|14 letture/);
  });

  it("la riga di prova sociale c'è solo con un numero dal DB", () => {
    show({ settledCount: 1234 });
    // it-IT non raggruppa sotto le cinque cifre: «1234», non «1.234».
    expect(screen.getByText(/1[\s.  ]?234 letture chiuse/)).toBeTruthy();
    cleanup();
    sessionStorage.clear();
    show({ settledCount: null });
    expect(screen.queryByText(/letture chiuse/)).toBeNull();
  });

  it("non è una modale: nessun aria-modal, nessun dialog, scroll della pagina intatto", () => {
    show();
    expect(popup()!.getAttribute("aria-modal")).toBeNull();
    expect(popup()!.getAttribute("role")).toBe("region");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    // #SIGNUP-POPUP-CENTER-0929: sta al centro, ma nessuno tocca lo scroll del
    // documento e l'host che centra non è un velo (pointer-events none in CSS).
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
    expect(screen.getByTestId("signup-popup-host").className).toBe("br-nudge-host");
  });

  // #SIGNUP-POPUP-CENTER-0929: centrato senza velo → un click fuori chiude, ma
  // il gesto arriva comunque al board (niente preventDefault/stopPropagation).
  it("un click fuori dalla card la chiude, conta come chiusura, e il board riceve il click", () => {
    const onBoard = vi.fn();
    render(<button type="button" onClick={onBoard}>una card del board</button>);
    show();
    const target = screen.getByText("una card del board");
    fireEvent.pointerDown(target);
    fireEvent.click(target);
    expect(popup()).toBeNull();
    expect(onBoard).toHaveBeenCalledTimes(1);
    expect(readSignupPopupMemory().dismissals).toBe(1);
    expect(tracked("signup_popup_dismissed")[0].body.meta).toEqual({ audience: "anon", reason: "outside" });
  });

  it("un click dentro la card non la chiude", () => {
    show();
    fireEvent.pointerDown(screen.getByRole("heading", { level: 2 }));
    fireEvent.pointerDown(screen.getByText(/Tutto il board/));
    expect(popup()).not.toBeNull();
    expect(tracked("signup_popup_dismissed")).toHaveLength(0);
  });

  it("«Non ora» e la CTA hanno la stessa classe e la stessa geometria di riga", () => {
    show();
    const cta = screen.getByRole("button", { name: "Crea il profilo gratuito" });
    const notNow = screen.getByRole("button", { name: "Non ora" });
    expect(cta.className).toBe("br-cta");
    expect(notNow.className).toBe("br-cta");
    expect(cta.parentElement).toBe(notNow.parentElement);
    expect(cta.parentElement!.className).toBe("br-nudge__actions");
  });

  it("legale in calce e nessun countdown", () => {
    show();
    expect(popup()!.textContent).toMatch(/18\+/);
    expect(popup()!.textContent).toMatch(/Gioco responsabile/);
    expect(popup()!.textContent).not.toMatch(/\d+:\d\d|solo oggi|scade/i);
  });
});
