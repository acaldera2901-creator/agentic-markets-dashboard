import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "@/app/app/page";

// #FUNNEL-INTENT-0908 — l'intento d'acquisto deve sopravvivere all'autenticazione.
//
// Misurato sul DB di produzione l'08/09: 11 registrazioni reali completate in 30
// giorni, ZERO aperture del checkout, ZERO ordini da 41. Il signup converte, la
// vendita no. Misurato poi sul sito vivo, in finestra pulita: su /plans il muro di
// login (#LOGIN-WALL-0626) copriva il listino e i tre CTA dei piani erano
// `disabled` — l'unico percorso d'acquisto del sito era un vicolo cieco, e il ramo
// anonimo di `submitCryptoPayment` era codice morto che nessuno poteva raggiungere.
//
// Decisione di Andrea: il listino si apre agli anonimi, il muro resta sui dati.
// Qui si inchiodano le due meta' di quella decisione — che il listino venda, e che
// le predizioni restino chiuse.

const PROFILE_KEY = "agentic-client-profile";

let beacons: string[] = [];

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.startsWith("/api/track")) {
      try { beacons.push(JSON.parse(String(init?.body ?? "{}")).event_type); } catch { /* ignore */ }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }
    // Visitatore anonimo: nessun cookie di sessione.
    if (url.startsWith("/api/auth") && method === "GET") {
      return new Response(JSON.stringify({ error: "no_session" }), { status: 401, headers: { "content-type": "application/json" } });
    }
    // Autenticazione riuscita: il server ha appena impostato il cookie di sessione.
    if (url.startsWith("/api/auth") && method === "POST") {
      return new Response(JSON.stringify({ plan: "free", name: "Test Buyer" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    // Tutto il resto (predictions, odds, geo...) risponde vuoto: qui si testa il
    // funnel, non i dati.
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  });
}

const wallIsUp = () => document.querySelector(".auth-modal-backdrop") !== null;
const checkoutIsOpen = () => document.querySelector(".checkout-wallet-block") !== null;

/** Il bottone di pagamento dentro la scheda del piano indicato. */
function payButton(card: "is-premium" | "base"): HTMLButtonElement {
  const cards = [...document.querySelectorAll("article.plan-card")];
  const el = card === "is-premium"
    ? cards.find((c) => c.classList.contains("is-premium"))
    : cards.find((c) => !c.classList.contains("is-premium") && c.querySelector(".crypto-pay-box"));
  if (!el) throw new Error(`scheda del piano ${card} non trovata`);
  const btn = el.querySelector<HTMLButtonElement>(".crypto-pay-box button");
  if (!btn) throw new Error(`bottone di pagamento del piano ${card} non trovato`);
  return btn;
}

/** Si autentica dal modale aperto, sulla scheda Login. */
async function authenticate(user: ReturnType<typeof userEvent.setup>) {
  const form = document.querySelector<HTMLFormElement>(".auth-modal-backdrop form.auth-modal");
  if (!form) throw new Error("modale di autenticazione non aperto");
  const loginTab = [...form.querySelectorAll<HTMLButtonElement>(".auth-mode-switch button")]
    .find((b) => /login/i.test(b.textContent ?? ""));
  if (!loginTab) throw new Error("scheda Login non trovata nel modale");
  await user.click(loginTab);

  // Il campo email non ha type="email" (usa inputMode): si cerca cosi'.
  const email = form.querySelector<HTMLInputElement>('input[inputmode="email"]');
  const password = form.querySelector<HTMLInputElement>('input[type="password"]');
  if (!email || !password) throw new Error("campi email/password non trovati nel modale");
  await user.type(email, "buyer@example.com");
  await user.type(password, "password123");

  // L'unico bottone senza type esplicito e' il submit del form.
  const submit = form.querySelector<HTMLButtonElement>("button:not([type])");
  if (!submit) throw new Error("bottone di invio non trovato");
  expect(submit.disabled, "il form di login non si e' validato").toBe(false);
  await user.click(submit);
}

function mount(path: string, tab: "plans" | "bets" | "history") {
  window.history.replaceState({}, "", path);
  return render(<Dashboard initialTab={tab} />);
}

describe("#FUNNEL-INTENT-0908 — dall'anonimo al checkout", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("agentic-lang", "en");
    beacons = [];
    vi.stubGlobal("fetch", mockFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("anonimo → clic sul piano Pro → autenticazione → il checkout si apre sul piano scelto", async () => {
    const user = userEvent.setup();
    mount("/plans", "plans");

    // Il listino e' aperto: nessun muro sopra il prezzo.
    await waitFor(() => expect(payButton("is-premium")).toBeTruthy());
    expect(wallIsUp(), "il listino non deve essere coperto dal muro di login").toBe(false);

    // 1. L'utente sceglie di pagare il piano Pro.
    const pay = payButton("is-premium");
    expect(pay.disabled, "il CTA di un piano a pagamento non puo' essere un vicolo cieco per l'anonimo").toBe(false);
    await user.click(pay);

    // 2. Il clic avvia l'autenticazione (e viene misurato).
    await waitFor(() => expect(wallIsUp()).toBe(true));
    expect(beacons).toContain("plan_cta_click");

    // 3. Si autentica.
    await authenticate(user);

    // 4. Il checkout del piano SCELTO si apre da solo: l'utente non deve tornare
    //    indietro sui suoi passi a ricliccare.
    await waitFor(() => {
      expect(checkoutIsOpen(), "dopo l'autenticazione il checkout del piano scelto deve essere aperto").toBe(true);
    }, { timeout: 4000 });
    expect(document.body.textContent, "il checkout deve essere sul piano Pro, non su un altro").toContain("29.99");
    expect(beacons).toContain("checkout_opened");
  });

  it("anonimo → clic su 'attiva Free' → autenticazione → il piano free viene davvero attivato", async () => {
    const user = userEvent.setup();
    mount("/plans", "plans");

    const freeBtn = await waitFor(() => {
      const b = document.querySelector<HTMLButtonElement>("article.plan-card button.plan-action");
      if (!b) throw new Error("bottone del piano Free non trovato");
      return b;
    });
    expect(freeBtn.disabled, "il CTA del piano Free non puo' essere un vicolo cieco per l'anonimo").toBe(false);
    await user.click(freeBtn);

    await waitFor(() => expect(wallIsUp()).toBe(true));
    await authenticate(user);

    // Prima del fix chi cliccava qui si registrava e NON otteneva nemmeno il free:
    // activateFreePlan non veniva mai richiamato dopo l'autenticazione.
    await waitFor(() => {
      const raw = localStorage.getItem(PROFILE_KEY);
      expect(raw, "nessun profilo salvato dopo l'autenticazione").not.toBeNull();
      expect(JSON.parse(raw as string).plan).toBe("free");
    }, { timeout: 4000 });
  });

  // La regressione che farebbe piu' danno: aprire il listino non deve aprire il
  // prodotto. Le predizioni e lo storico sono la cosa che si vende.
  it.each([
    ["/predictions", "bets"],
    ["/history", "history"],
  ] as const)("il muro di login RESTA su %s per un anonimo", async (path, tab) => {
    mount(path, tab);
    await waitFor(() => {
      expect(wallIsUp(), `${path} deve restare chiusa a chi non ha una sessione`).toBe(true);
    });
    // E non deve essere chiudibile: niente × nel modale del muro.
    const closeX = document.querySelector('.auth-modal-backdrop [aria-label="Close"], .auth-modal-backdrop [aria-label="Chiudi"]');
    expect(closeX, "il muro sui dati non deve essere chiudibile").toBeNull();
  });
});
