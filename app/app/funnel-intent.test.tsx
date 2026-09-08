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
let authPosts: Record<string, unknown>[] = [];
// Gate email ACCESO = come la produzione: il register risponde 202, nessuna
// sessione, l'utente deve passare dal link nella mail.
let emailGateOn = false;

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
    if (url.startsWith("/api/auth") && method === "POST") {
      let sent: Record<string, unknown> = {};
      try { sent = JSON.parse(String(init?.body ?? "{}")); } catch { /* ignore */ }
      authPosts.push(sent);
      // Gate email acceso: il register NON apre una sessione (202).
      if (emailGateOn && sent.action === "register") {
        return new Response(JSON.stringify({ pending_activation: true, identifier: sent.identifier }), { status: 202, headers: { "content-type": "application/json" } });
      }
      // Autenticazione riuscita: il server ha appena impostato il cookie.
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

/** Compila e invia il form di registrazione dal modale aperto. */
async function register(user: ReturnType<typeof userEvent.setup>) {
  const form = document.querySelector<HTMLFormElement>(".auth-modal-backdrop form.auth-modal");
  if (!form) throw new Error("modale di autenticazione non aperto");
  const inputs = [...form.querySelectorAll<HTMLInputElement>("input")];
  const name = inputs[0];
  const email = form.querySelector<HTMLInputElement>('input[inputmode="email"]');
  const password = form.querySelector<HTMLInputElement>('input[type="password"]');
  const [age, tos] = [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  if (!name || !email || !password || !age || !tos) throw new Error("form di registrazione incompleto");
  await user.type(name, "Test Buyer");
  await user.type(email, "buyer@example.com");
  await user.type(password, "password123");
  await user.click(age);
  await user.click(tos);
  const submit = form.querySelector<HTMLButtonElement>("button:not([type])");
  if (!submit) throw new Error("bottone di invio non trovato");
  expect(submit.disabled, "il form di registrazione non si e' validato").toBe(false);
  await user.click(submit);
}

/** Il rientro dal link di attivazione: il cookie c'e' gia', la navigazione e' nuova. */
function mockSession() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/track")) {
      try { beacons.push(JSON.parse(String(init?.body ?? "{}")).event_type); } catch { /* ignore */ }
      return new Response("{}", { status: 200 });
    }
    if (url.startsWith("/api/auth") && (init?.method ?? "GET").toUpperCase() === "GET") {
      return new Response(JSON.stringify({ identifier: "buyer@example.com", plan: "free", name: "Test Buyer" }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }));
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
    authPosts = [];
    emailGateOn = false;
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

  // ── Il gate email e' ACCESO in produzione (misurato sul DB l'08/09: activated_at
  // arriva 9-64 secondi dopo created_at, mai contestuale). Quindi la registrazione
  // NON apre una sessione, e l'utente torna da un link, in una navigazione nuova,
  // spesso su un altro dispositivo. Nessuno stato client sopravvive a quel salto:
  // l'intento deve viaggiare nel link.

  it("col gate email acceso, la registrazione porta con se' il piano scelto", async () => {
    const user = userEvent.setup();
    emailGateOn = true;
    mount("/plans", "plans");

    await waitFor(() => expect(payButton("base")).toBeTruthy());
    await user.click(payButton("base"));
    await waitFor(() => expect(wallIsUp()).toBe(true));
    await register(user);

    await waitFor(() => {
      const reg = authPosts.find((b) => b.action === "register");
      expect(reg, "nessuna registrazione inviata").toBeTruthy();
      expect(reg?.signup_intent, "il piano scelto deve partire col signup: e' l'unica cosa che sopravvive al giro via email")
        .toBe("plans:base");
    });
    // E il gate ha fatto il suo: nessuna sessione, quindi nessun checkout ancora.
    expect(checkoutIsOpen()).toBe(false);
  });

  it("al rientro dal link di attivazione il checkout si apre sul piano scelto", async () => {
    mockSession();
    mount("/plans?activated=1&goto=plans:base", "plans");

    await waitFor(() => {
      expect(checkoutIsOpen(), "chi attiva dalla mail con un intento deve trovare il checkout aperto").toBe(true);
    }, { timeout: 4000 });
    expect(document.body.textContent).toContain("14.99");
  });

  // Regressione: chi arriva da una mail fredda per le predizioni non deve
  // ritrovarsi sul listino. Questo comportamento esiste gia' e deve restare.
  it("al rientro SENZA intento non si apre nessun checkout", async () => {
    mockSession();
    mount("/predictions?activated=1", "bets");

    await waitFor(() => expect(wallIsUp()).toBe(false)); // sessione valida
    await new Promise((r) => setTimeout(r, 300));
    expect(checkoutIsOpen(), "senza intento il rientro deve restare quello di prima").toBe(false);
  });

  // `goto` arriva da un URL: chiunque puo' scriverlo.
  it.each(["plans:admin", "//evil.example.com", "../../admin", "PLANS:BASE"])(
    "un goto fuori allowlist (%s) viene ignorato", async (goto) => {
      mockSession();
      mount(`/plans?activated=1&goto=${encodeURIComponent(goto)}`, "plans");

      await waitFor(() => expect(wallIsUp()).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
      expect(checkoutIsOpen(), "un intento non riconosciuto non deve aprire nulla").toBe(false);
    }
  );

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
