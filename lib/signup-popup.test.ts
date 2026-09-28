// lib/signup-popup.test.ts — #SIGNUP-POPUP-D-0928
//
// La cadenza del pop-up è la parte che DSA art. 25(3)(b) guarda («richiedere
// ripetutamente una scelta già fatta»). Qui è una tabella di verità: una volta
// per sessione, 14 giorni dopo una chiusura, mai dopo due, mai dopo «Non
// mostrarlo più». E i numeri dei piani vengono dal codice, non dal brief.
import { describe, it, expect, beforeEach } from "vitest";
import {
  EMPTY_MEMORY, EMPTY_SESSION,
  SIGNUP_POPUP_COOLDOWN_MS, SIGNUP_POPUP_COPY, SIGNUP_POPUP_PAUSE_MS,
  noteSignupPopupBlocker, markSignupPopupShown,
  perDayAmount, readSignupPopupMemory, readSignupPopupSession,
  recordSignupPopupDismissal, recordSignupPopupNever,
  signupPopupAudience, signupPopupCooldownOk, signupPopupEligible, signupPopupEngaged,
  signupPopupPauseOk, signupPopupPlanRows, usdLabel,
} from "./signup-popup";
import { PUBLIC_PAID_PLANS } from "./commercial-plan";
import { showcaseAllowance } from "./access-projection";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("a chi si rivolge", () => {
  it("finché la sessione non è verificata non decide", () => {
    expect(signupPopupAudience({ authChecked: false, hasSession: false, plan: undefined })).toBeNull();
  });
  it("anonimo = nessuna sessione e nessun profilo", () => {
    expect(signupPopupAudience({ authChecked: true, hasSession: false, plan: undefined })).toBe("anon");
    expect(signupPopupAudience({ authChecked: true, hasSession: false, plan: null })).toBe("anon");
  });
  it("Free sì; Base, Pro, pending_payment, unpaid, admin mai", () => {
    expect(signupPopupAudience({ authChecked: true, hasSession: true, plan: "free" })).toBe("free");
    for (const plan of ["base", "premium", "pending_payment", "unpaid", "admin_full"]) {
      expect(signupPopupAudience({ authChecked: true, hasSession: true, plan }), plan).toBeNull();
    }
  });
  it("sessione senza profilo ancora caricato: non si decide", () => {
    expect(signupPopupAudience({ authChecked: true, hasSession: true, plan: undefined })).toBeNull();
  });
});

describe("cadenza (memoria per-browser)", () => {
  it("prima visita: ok", () => {
    expect(signupPopupCooldownOk(EMPTY_MEMORY, NOW)).toBe(true);
  });
  it("dopo una chiusura tace per 14 giorni, poi torna", () => {
    const m = { dismissals: 1, lastDismissedAt: NOW, never: false };
    expect(signupPopupCooldownOk(m, NOW + 13 * DAY)).toBe(false);
    expect(signupPopupCooldownOk(m, NOW + SIGNUP_POPUP_COOLDOWN_MS - 1)).toBe(false);
    expect(signupPopupCooldownOk(m, NOW + SIGNUP_POPUP_COOLDOWN_MS)).toBe(true);
  });
  it("dopo due chiusure non torna più, nemmeno fra un anno", () => {
    const m = { dismissals: 2, lastDismissedAt: NOW, never: false };
    expect(signupPopupCooldownOk(m, NOW + 365 * DAY)).toBe(false);
  });
  it("«Non mostrarlo più» vince su tutto, anche a zero chiusure", () => {
    expect(signupPopupCooldownOk({ dismissals: 0, lastDismissedAt: null, never: true }, NOW)).toBe(false);
  });
  it("le chiusure si contano davvero nello storage", () => {
    expect(readSignupPopupMemory()).toEqual(EMPTY_MEMORY);
    recordSignupPopupDismissal(NOW);
    expect(readSignupPopupMemory()).toEqual({ dismissals: 1, lastDismissedAt: NOW, never: false });
    recordSignupPopupDismissal(NOW + DAY);
    expect(readSignupPopupMemory().dismissals).toBe(2);
    recordSignupPopupNever();
    expect(readSignupPopupMemory().never).toBe(true);
  });
  it("storage corrotto = prima visita, non un crash", () => {
    localStorage.setItem("br_signup_popup", "{not json");
    expect(readSignupPopupMemory()).toEqual(EMPTY_MEMORY);
    localStorage.setItem("br_signup_popup", JSON.stringify({ dismissals: "molte", lastDismissedAt: "ieri", never: "sì" }));
    expect(readSignupPopupMemory()).toEqual(EMPTY_MEMORY);
  });
});

describe("una volta per sessione, e mai sopra una scelta già fatta", () => {
  const base = { audience: "anon" as const, memory: EMPTY_MEMORY, session: EMPTY_SESSION, consentDecided: true, now: NOW };
  it("caso pulito: eleggibile", () => {
    expect(signupPopupEligible(base)).toBe(true);
  });
  it("già mostrato in questa sessione: no", () => {
    markSignupPopupShown();
    expect(signupPopupEligible({ ...base, session: readSignupPopupSession() })).toBe(false);
  });
  it("ha visto i piani / cliccato una CTA / aperto la registrazione / visto il pannello B: no", () => {
    for (const b of ["plans", "plan_cta", "auth", "panel_b"] as const) {
      sessionStorage.clear();
      noteSignupPopupBlocker(b);
      expect(signupPopupEligible({ ...base, session: readSignupPopupSession() }), b).toBe(false);
    }
  });
  it("il blocker è idempotente", () => {
    noteSignupPopupBlocker("plans");
    noteSignupPopupBlocker("plans");
    expect(readSignupPopupSession().blockers).toEqual(["plans"]);
  });
  it("banner cookie ancora aperto: aspetta (niente due strisce insieme)", () => {
    expect(signupPopupEligible({ ...base, consentDecided: false })).toBe(false);
  });
  it("Base/Pro (audience null): mai", () => {
    expect(signupPopupEligible({ ...base, audience: null })).toBe(false);
  });
});

describe("engagement e pausa", () => {
  it("serve uno scroll oltre la prima schermata o una card aperta", () => {
    expect(signupPopupEngaged({ scrollY: 0, viewportH: 800, cardOpened: false })).toBe(false);
    expect(signupPopupEngaged({ scrollY: 799, viewportH: 800, cardOpened: false })).toBe(false);
    expect(signupPopupEngaged({ scrollY: 800, viewportH: 800, cardOpened: false })).toBe(true);
    expect(signupPopupEngaged({ scrollY: 0, viewportH: 800, cardOpened: true })).toBe(true);
  });
  it("la pausa: 3 s senza gesti, niente overlay, niente campo in focus, scheda visibile", () => {
    const ok = { now: NOW, lastInteractionAt: NOW - SIGNUP_POPUP_PAUSE_MS, overlayOpen: false, fieldFocused: false, visible: true };
    expect(signupPopupPauseOk(ok)).toBe(true);
    expect(signupPopupPauseOk({ ...ok, lastInteractionAt: NOW - SIGNUP_POPUP_PAUSE_MS + 1 })).toBe(false);
    expect(signupPopupPauseOk({ ...ok, overlayOpen: true })).toBe(false);
    expect(signupPopupPauseOk({ ...ok, fieldFocused: true })).toBe(false);
    expect(signupPopupPauseOk({ ...ok, visible: false })).toBe(false);
  });
});

describe("i tre piani: numeri dal codice, non dal brief", () => {
  it("Free 3, Base 7 per sport, Pro senza tetto (non «14»)", () => {
    expect(showcaseAllowance("free")).toBe(3);
    expect(showcaseAllowance("base")).toBe(7);
    expect(showcaseAllowance("premium")).toBe(Infinity);
    const rows = signupPopupPlanRows("it");
    expect(rows.map((r) => r.key)).toEqual(["free", "base", "pro"]);
    expect(rows[0].allowance).toBe("3 letture/giorno per sport");
    expect(rows[1].allowance).toBe("7 letture/giorno per sport");
    expect(rows[2].allowance).toBe("Tutto il board");
    for (const r of rows) expect(r.allowance).not.toMatch(/14/);
  });
  it("mensile sempre presente; il giorno è accessorio e mai da solo", () => {
    const [free, base, pro] = signupPopupPlanRows("it");
    expect(free.price).toBe("$0");
    expect(free.perDay).toBe("");
    expect(base.price).toBe(`$${PUBLIC_PAID_PLANS.base.amountUsdt.toFixed(2).replace(".", ",")}`);
    expect(base.per).toBe("/mese");
    expect(base.perDay.replace(/\u00a0/g, " ")).toBe("≈ $0,50 al giorno");
    expect(pro.price).toBe("$29,99");
    expect(pro.perDay.replace(/\u00a0/g, " ")).toBe("≈ $1 al giorno");
  });
  it("il conto al giorno è 30 giorni, arrotondato al centesimo", () => {
    expect(perDayAmount(14.99)).toBe(0.5);
    expect(perDayAmount(29.99)).toBe(1);
  });
  it("formati per lingua: punto in EN, virgola altrove, valuta dopo in FR", () => {
    expect(usdLabel(14.99, "en")).toBe("$14.99");
    expect(usdLabel(14.99, "es")).toBe("$14,99");
    expect(usdLabel(14.99, "fr")).toBe("14,99 $");
    expect(signupPopupPlanRows("en")[1].perDay.replace(/\u00a0/g, " ")).toBe("≈ $0.50 a day");
    expect(signupPopupPlanRows("fr")[2].perDay.replace(/\u00a0/g, " ")).toBe("≈ 1 $ par jour");
  });
});

describe("copy: cinque lingue, niente pressione", () => {
  const langs = ["it", "en", "es", "fr", "ru"] as const;
  it("ogni lingua ha tutte le voci, e il titolo cita la quota Free vera", () => {
    for (const l of langs) {
      const c = SIGNUP_POPUP_COPY[l];
      expect(c.titleAnon).toMatch(new RegExp(`\\b${showcaseAllowance("free")}\\b`));
      expect(c.bodyFree(5, showcaseAllowance("base"))).toMatch(/5/);
      expect(c.bodyFree(5, showcaseAllowance("base"))).toMatch(/7/);
      expect(c.bodyFree(null, 7)).not.toMatch(/null|undefined/);
      // Il separatore delle migliaia è della lingua (it/es: nessuno sotto le
      // cinque cifre; fr/ru: spazio stretto U+202F): conta che il numero ci sia.
      expect(c.proof(1234)).toMatch(/1[\s.,  ]?234/);
      for (const k of ["ctaAnon", "ctaFree", "notNow", "compare", "never", "close", "legal", "legalLink"] as const) {
        expect(c[k].length, `${l}.${k}`).toBeGreaterThan(0);
      }
    }
  });
  it("nessun countdown, «solo oggi», «più scelto» o confirmshaming", () => {
    const all = langs.flatMap((l) => Object.values(SIGNUP_POPUP_COPY[l]).map((v) => (typeof v === "function" ? v(3, 7) : v)));
    const banned = /solo oggi|only today|scade|expires|più scelto|most popular|preferisco perdere|rather lose|ultimi posti|hurry|affrettati/i;
    for (const s of all) expect(s, s).not.toMatch(banned);
  });
});
