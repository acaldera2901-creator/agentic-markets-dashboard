// components/SignupPopup.test.tsx — #SIGNUP-POPUP-D-0928
//
// Il trigger senza aspettare 90 secondi veri: timer finti su Date/setTimeout.
// Si verifica ciò che il design di psicologia-persuasione fissa: 90 s di
// tempo ATTIVO (la scheda nascosta non conta), engagement reale (uno scroll
// oltre la prima schermata o una card aperta), una pausa di 3 s, nessun
// overlay sopra; e che ogni chiusura scriva la memoria e il suo evento.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { SignupPopup, type SignupPopupProps } from "./SignupPopup";
import { SIGNUP_POPUP_ACTIVE_MS, SIGNUP_POPUP_PAUSE_MS, SIGNUP_POPUP_POLL_MS, readSignupPopupMemory, readSignupPopupSession, noteSignupPopupBlocker } from "@/lib/signup-popup";

let calls: { url: string; body: Record<string, unknown> }[] = [];
let visibility: DocumentVisibilityState = "visible";

const setScroll = (y: number) => {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  window.dispatchEvent(new Event("scroll"));
};
const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
};
const tracked = (type?: string) => calls.filter((c) => c.url === "/api/track" && (!type || c.body.event_type === type));
const popup = () => screen.queryByTestId("signup-popup");

// Avanza il tempo con l'orologio finto e lascia scattare il polling.
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const ARM = SIGNUP_POPUP_ACTIVE_MS;
const PAUSE = SIGNUP_POPUP_PAUSE_MS + SIGNUP_POPUP_POLL_MS;

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

describe("trigger: 90 s attivi + engagement + pausa", () => {
  it("non compare prima dei 90 secondi, anche con engagement e pausa", () => {
    render(<SignupPopup {...baseProps} />);
    setScroll(900);
    advance(ARM - 5_000); // engagement e pausa ci sono da un pezzo: manca solo il tempo
    expect(popup()).toBeNull();
    advance(5_000 + SIGNUP_POPUP_POLL_MS);
    expect(popup()).not.toBeNull();
  });

  it("senza scroll oltre la prima schermata né card aperta non compare mai", () => {
    render(<SignupPopup {...baseProps} />);
    setScroll(300);
    advance(ARM + 60_000);
    expect(popup()).toBeNull();
    expect(tracked("signup_popup_shown")).toHaveLength(0);
  });

  it("compare dopo 90 s attivi, uno scroll oltre la schermata e 3 s di pausa — e lo traccia", () => {
    render(<SignupPopup {...baseProps} />);
    advance(ARM);
    expect(popup()).toBeNull(); // armato, ma non ancora ingaggiato
    setScroll(900);
    advance(1_000);
    expect(popup()).toBeNull(); // pausa non ancora compiuta
    advance(PAUSE);
    expect(popup()).not.toBeNull();
    const ev = tracked("signup_popup_shown");
    expect(ev).toHaveLength(1);
    expect(ev[0].body.meta).toEqual({ audience: "anon" });
    expect(readSignupPopupSession().shown).toBe(true);
  });

  it("una card aperta vale come engagement; finché resta aperta, aspetta", () => {
    const { rerender } = render(<SignupPopup {...baseProps} />);
    advance(ARM);
    rerender(<SignupPopup {...baseProps} cardOpen />);
    advance(PAUSE + 5_000);
    expect(popup()).toBeNull();
    rerender(<SignupPopup {...baseProps} cardOpen={false} />);
    advance(PAUSE);
    expect(popup()).not.toBeNull();
  });

  it("la scheda nascosta ferma l'orologio: il tempo passato altrove non conta", () => {
    render(<SignupPopup {...baseProps} />);
    setScroll(900);
    advance(30_000);
    setVisibility("hidden");
    advance(10 * 60_000); // dieci minuti su un'altra scheda
    setVisibility("visible");
    advance(30_000);
    advance(PAUSE);
    expect(popup()).toBeNull(); // solo 60 s attivi
    advance(30_000 + PAUSE);
    expect(popup()).not.toBeNull(); // 90 s attivi compiuti
  });

  it("un gesto (scroll, tasto, tocco) riporta la pausa a zero", () => {
    render(<SignupPopup {...baseProps} />);
    advance(ARM - 1_000);
    setScroll(900); // a 89 s: da qui parte la pausa
    advance(2_000); // 91 s: armato, ma la pausa ha solo 2 s
    expect(popup()).toBeNull();
    fireEvent.keyDown(window, { key: "ArrowDown" }); // pausa da capo
    advance(2_000);
    expect(popup()).toBeNull();
    advance(PAUSE);
    expect(popup()).not.toBeNull();
  });

  it("con un overlay aperto (auth, checkout) non si somma", () => {
    const { rerender } = render(<SignupPopup {...baseProps} overlayOpen />);
    setScroll(900);
    advance(ARM + PAUSE + 5_000);
    expect(popup()).toBeNull();
    rerender(<SignupPopup {...baseProps} overlayOpen={false} />);
    advance(PAUSE);
    expect(popup()).not.toBeNull();
  });

  it("con un campo in focus aspetta che lo lasci", () => {
    render(
      <>
        <input aria-label="cerca" />
        <SignupPopup {...baseProps} />
      </>,
    );
    setScroll(900);
    screen.getByLabelText("cerca").focus();
    advance(ARM + PAUSE + 2_000);
    expect(popup()).toBeNull();
    (document.activeElement as HTMLElement).blur();
    advance(PAUSE);
    expect(popup()).not.toBeNull();
  });

  it("finché il banner cookie non ha risposta, aspetta; quando arriva, compare", () => {
    localStorage.removeItem("gdpr_consent");
    render(<SignupPopup {...baseProps} />);
    setScroll(900);
    advance(ARM + PAUSE + 2_000);
    expect(popup()).toBeNull();
    localStorage.setItem("gdpr_consent", "accepted");
    advance(PAUSE);
    expect(popup()).not.toBeNull();
  });
});

describe("a chi non compare", () => {
  it("audience null (Base/Pro, sessione non verificata): nessun timer, niente", () => {
    render(<SignupPopup {...baseProps} audience={null} />);
    setScroll(900);
    advance(ARM + PAUSE + 60_000);
    expect(popup()).toBeNull();
  });

  it("se in sessione ha già visto i piani (o cliccato una CTA, o aperto la registrazione): no", () => {
    noteSignupPopupBlocker("plans");
    render(<SignupPopup {...baseProps} />);
    setScroll(900);
    advance(ARM + PAUSE + 5_000);
    expect(popup()).toBeNull();
  });

  it("un blocker arrivato DURANTE l'attesa vale lo stesso", () => {
    render(<SignupPopup {...baseProps} />);
    setScroll(900);
    advance(ARM - 5_000);
    noteSignupPopupBlocker("auth");
    advance(5_000 + PAUSE + 5_000);
    expect(popup()).toBeNull();
  });

  it("già chiuso 3 giorni fa: tace (14 giorni di cooldown)", () => {
    localStorage.setItem("br_signup_popup", JSON.stringify({ dismissals: 1, lastDismissedAt: Date.now() - 3 * 86_400_000, never: false }));
    render(<SignupPopup {...baseProps} />);
    setScroll(900);
    advance(ARM + PAUSE + 5_000);
    expect(popup()).toBeNull();
  });

  it("chiuso 15 giorni fa: torna, una volta", () => {
    localStorage.setItem("br_signup_popup", JSON.stringify({ dismissals: 1, lastDismissedAt: Date.now() - 15 * 86_400_000, never: false }));
    render(<SignupPopup {...baseProps} />);
    setScroll(900);
    advance(ARM + PAUSE);
    expect(popup()).not.toBeNull();
  });

  it("chiuso due volte: mai più", () => {
    localStorage.setItem("br_signup_popup", JSON.stringify({ dismissals: 2, lastDismissedAt: Date.now() - 400 * 86_400_000, never: false }));
    render(<SignupPopup {...baseProps} />);
    setScroll(900);
    advance(ARM + PAUSE + 5_000);
    expect(popup()).toBeNull();
  });
});

const show = (props: Partial<SignupPopupProps> = {}) => {
  const r = render(<SignupPopup {...baseProps} {...props} />);
  setScroll(900);
  advance(ARM + PAUSE);
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
    setScroll(1200);
    advance(ARM + PAUSE + 60_000);
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
