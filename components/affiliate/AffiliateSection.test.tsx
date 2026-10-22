// components/affiliate/AffiliateSection.test.tsx — #AFFILIATE-V2-UI-1015
// Pannello utente con fetch finta: stati della pagina, iscrizione, wallet in due
// passi con gli errori del server mappati, a11y di base (label, aria-invalid).
import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { AffiliateSection } from "./AffiliateSection";
import { ADDR_NEW, JOIN_OPEN, ME, ME_COOLDOWN, ME_EMPTY, ME_NEGATIVE, ME_NO_TIERS, ME_PAYOUTS_ALL, ME_PENDING_SCREENING, ME_SUSPENDED, ME_TIER2 } from "./fixtures";

type Handler = (url: string, init?: RequestInit) => { status: number; body?: unknown } | undefined;
let calls: { url: string; method: string; body: unknown }[] = [];

function mockFetch(handler: Handler) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = handler(url, init) ?? { status: 404, body: {} };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body } as Response;
  }));
}

beforeEach(() => { vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn(async () => {}) } }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const me = (body: unknown): Handler => (url) => (url.startsWith("/api/affiliate/me") ? { status: 200, body } : undefined);

describe("stati della pagina", () => {
  it("401 → accedi", async () => {
    mockFetch(() => ({ status: 401, body: { error: "login required" } }));
    render(<AffiliateSection lang="it" />);
    expect(await screen.findByText(/Accedi per vedere il programma/)).toBeTruthy();
  });

  it("programma non aperto (open:false) → «iscrizioni non aperte», nessun form, nessun lede", async () => {
    mockFetch(me({ enrolled: false, open: false }));
    render(<AffiliateSection lang="it" />);
    expect(await screen.findByTestId("aff-closed")).toBeTruthy();
    expect(screen.queryByLabelText(/Scegli il tuo codice/)).toBeNull();
    expect(screen.queryByText(/Ricevi il 20%/)).toBeNull();
    expect(calls.some((c) => c.url === "/api/affiliate/join")).toBe(false);
  });

  it("aperto ma terms_version mancante → «iscrizioni non aperte», non un form rotto", async () => {
    mockFetch((url) => url.startsWith("/api/affiliate/me") ? { status: 200, body: { enrolled: false, open: true } } : url === "/api/affiliate/join" ? { status: 200, body: { ...JOIN_OPEN, terms_version: null } } : undefined);
    render(<AffiliateSection lang="it" />);
    expect(await screen.findByTestId("aff-closed")).toBeTruthy();
  });

  it("5xx → errore con «Riprova»; MAI l'iscrizione su un errore", async () => {
    mockFetch(() => ({ status: 500, body: { error: "read failed" } }));
    render(<AffiliateSection lang="it" />);
    expect(await screen.findByTestId("aff-error")).toBeTruthy();
    expect(screen.getByText(/Le commissioni non si perdono/)).toBeTruthy();
    expect(screen.queryByText(/Iscriviti al programma/)).toBeNull();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeTruthy();
  });

  it("errore di rete (fetch che lancia) → errore, non iscrizione", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    render(<AffiliateSection lang="it" />);
    expect(await screen.findByTestId("aff-error")).toBeTruthy();
  });

  it("join GET che fallisce dopo me aperto → errore, non form", async () => {
    mockFetch((url) => url.startsWith("/api/affiliate/me") ? { status: 200, body: { enrolled: false, open: true } } : { status: 500, body: {} });
    render(<AffiliateSection lang="it" />);
    expect(await screen.findByTestId("aff-error")).toBeTruthy();
  });
});

describe("iscrizione", () => {
  const setup = (joinPost?: { status: number; body: unknown }) => {
    mockFetch((url, init) => {
      if (url.startsWith("/api/affiliate/me")) return { status: 200, body: { enrolled: false, open: true } };
      if (url === "/api/affiliate/join" && (init?.method ?? "GET") === "GET") return { status: 200, body: JOIN_OPEN };
      if (url === "/api/affiliate/join") return joinPost ?? { status: 200, body: { ok: true } };
      return undefined;
    });
    render(<AffiliateSection lang="it" />);
  };

  it("la CTA resta spenta finché codice valido + 3 spunte", async () => {
    setup();
    const cta = (await screen.findByRole("button", { name: "Iscrivimi al programma" })) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Scegli il tuo codice"), { target: { value: "mio-codice" } });
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
    expect(cta.disabled).toBe(true); // manca la terza (clausole onerose)
    fireEvent.click(boxes[2]);
    expect(cta.disabled).toBe(false);
  });

  it("POST con le tre conferme letterali e la versione dei Termini", async () => {
    setup();
    await screen.findByRole("button", { name: "Iscrivimi al programma" });
    fireEvent.change(screen.getByLabelText("Scegli il tuo codice"), { target: { value: "mio-codice" } });
    screen.getAllByRole("checkbox").forEach((b) => fireEvent.click(b));
    fireEvent.click(screen.getByRole("button", { name: "Iscrivimi al programma" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ code: "MIO-CODICE", terms_version: "v1", age: true, onerous_ack: true });
  });

  it("code_taken → messaggio", async () => {
    setup({ status: 409, body: { error: "code_taken" } });
    await screen.findByRole("button", { name: "Iscrivimi al programma" });
    fireEvent.change(screen.getByLabelText("Scegli il tuo codice"), { target: { value: "xx" } });
    screen.getAllByRole("checkbox").forEach((b) => fireEvent.click(b));
    fireEvent.click(screen.getByRole("button", { name: "Iscrivimi al programma" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/già in uso/);
  });

  it("terms_outdated → spunte azzerate", async () => {
    setup({ status: 409, body: { error: "terms_outdated", terms_version: "v2" } });
    await screen.findByRole("button", { name: "Iscrivimi al programma" });
    fireEvent.change(screen.getByLabelText("Scegli il tuo codice"), { target: { value: "xx" } });
    screen.getAllByRole("checkbox").forEach((b) => fireEvent.click(b));
    fireEvent.click(screen.getByRole("button", { name: "Iscrivimi al programma" }));
    await screen.findByText(/Termini sono stati aggiornati/);
    screen.getAllByRole("checkbox").forEach((b) => expect((b as HTMLInputElement).checked).toBe(false));
  });

  it("codice già assegnato: campo in sola lettura", async () => {
    mockFetch((url) => url.startsWith("/api/affiliate/me") ? { status: 200, body: { enrolled: false, open: true } } : { status: 200, body: { ...JOIN_OPEN, code: "GIA", code_locked: true } });
    render(<AffiliateSection lang="it" />);
    const input = (await screen.findByLabelText("Il tuo codice")) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe("GIA");
  });
});

describe("React StrictMode (dev: mount, unmount, remount)", () => {
  it("la pagina esce da «caricamento» anche dopo il doppio mount", async () => {
    mockFetch(me(ME));
    render(<StrictMode><AffiliateSection lang="it" /></StrictMode>);
    expect(await screen.findByText("Il tuo link")).toBeTruthy();
  });
});

describe("dashboard", () => {
  it("ledger, wallet attivo, storico: dati dell'API, mai inventati", async () => {
    mockFetch(me(ME));
    render(<AffiliateSection lang="it" />);
    await screen.findByText("Il tuo link");
    expect(screen.getByText("$41,98")).toBeTruthy();
    expect(screen.getAllByText("$23,39").length).toBeGreaterThan(0);
    expect(screen.getAllByText("−$6,00").length).toBeGreaterThan(0);
    expect(screen.getByText(/Intestato a A\. Bianchi · Italia/)).toBeTruthy();
    expect(screen.queryByText(/Esempio/)).toBeNull();
    const link = screen.getByRole("textbox", { name: "Il tuo link" }) as HTMLInputElement;
    expect(link.value).toMatch(/\/r\/ESEMPIO$/);
    // indirizzo SEMPRE mascherato
    expect(screen.getByText("0x4b1e…91d7")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/0x4b1e9a07/);
  });

  it("sotto soglia: fatto, non obiettivo (nessun «ti mancano»)", async () => {
    mockFetch(me(ME));
    render(<AffiliateSection lang="it" />);
    await screen.findByText("Il tuo link");
    expect(document.body.textContent).toMatch(/maturati su 50 \$: il prossimo pagamento parte quando arrivano a 50 \$/);
    expect(document.body.textContent).not.toMatch(/ti mancano|ti manca/i);
  });

  it("livello (#AFFILIATE-TIERS-1021): tasso, conteggio e prossimo gradino dall'API; la scala è quella del server", async () => {
    mockFetch(me(ME));
    render(<AffiliateSection lang="it" />);
    const block = await screen.findByTestId("aff-tier");
    expect(block.textContent).toMatch(/Livello base/);
    expect(block.textContent).toMatch(/7% sui rinnovi/);
    expect(block.textContent).toMatch(/3 referiti paganti/);
    expect(block.textContent).toMatch(/Ancora 2 referiti paganti e ogni rinnovo passa al 10%/);
    expect(block.textContent).toMatch(/fino a 4 referiti paganti/);
    expect(block.textContent).toMatch(/da 15 referiti paganti/);
    expect(block.textContent).toMatch(/il primo acquisto resta al 20%/);
    // niente promesse: nessun importo stimato, nessun «guadagna»
    expect(block.textContent).not.toMatch(/guadagn|garantit|\$\d/i);
  });

  it("livello massimo e scala spenta: «livello più alto» / «nessuno scaglione»; risposta senza tier → nessun blocco", async () => {
    mockFetch(me(ME_TIER2));
    const a = render(<AffiliateSection lang="it" />);
    const top = await screen.findByTestId("aff-tier");
    expect(top.textContent).toMatch(/Livello 2/);
    expect(top.textContent).toMatch(/15% sui rinnovi/);
    expect(top.textContent).toMatch(/Sei al livello più alto della scala/);
    a.unmount();
    mockFetch(me(ME_NO_TIERS));
    const b = render(<AffiliateSection lang="it" />);
    expect((await screen.findByTestId("aff-tier")).textContent).toMatch(/Nessuno scaglione attivo/);
    b.unmount();
    const { tier: _omit, ...noTier } = ME;
    void _omit;
    mockFetch(me(noTier));
    render(<AffiliateSection lang="it" />);
    await screen.findByText("Il tuo link");
    expect(screen.queryByTestId("aff-tier")).toBeNull();
  });

  it("saldo negativo: maturata a $0,00 + saldo da recuperare", async () => {
    mockFetch(me(ME_NEGATIVE));
    render(<AffiliateSection lang="it" />);
    await screen.findByText(/Saldo da recuperare: −\$6,00/);
  });

  it("wallet: nessuno / in attesa / non ancora utilizzabile / sospeso", async () => {
    mockFetch(me(ME_EMPTY));
    const a = render(<AffiliateSection lang="it" />);
    expect(await screen.findByText("Nessun wallet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aggiungi wallet" })).toBeTruthy();
    a.unmount();

    mockFetch(me(ME_COOLDOWN));
    const b = render(<AffiliateSection lang="it" />);
    expect(await screen.findByText(/Utilizzabile dal/)).toBeTruthy();
    expect(screen.getByText(/Per 72 ore non possiamo pagarti/)).toBeTruthy();
    b.unmount();

    mockFetch(me(ME_PENDING_SCREENING));
    const c = render(<AffiliateSection lang="it" />);
    expect(await screen.findByText("Non ancora utilizzabile")).toBeTruthy();
    c.unmount();

    mockFetch(me(ME_SUSPENDED));
    render(<AffiliateSection lang="it" />);
    expect((await screen.findAllByText(/I pagamenti sono sospesi per una verifica\./)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cambia wallet" })).toBeNull();
  });

  it("storico pagamenti: tutti gli stati, annullato col testo del codice", async () => {
    mockFetch(me(ME_PAYOUTS_ALL));
    render(<AffiliateSection lang="it" />);
    await screen.findByText("Il tuo link");
    fireEvent.click(screen.getByRole("button", { name: "Tutti gli stati e i dettagli" }));
    const t = await screen.findByRole("table");
    expect(within(t).getByText("In preparazione")).toBeTruthy();
    expect(within(t).getByText("Inviato · in conferma")).toBeTruthy();
    expect(within(t).getByText("Pagato")).toBeTruthy();
    expect(within(t).getByText("Annullato")).toBeTruthy();
    expect(within(t).getByText(/Hai cambiato wallet prima dell'invio/)).toBeTruthy();
    expect(within(t).getByText("Ottobre 2026")).toBeTruthy(); // mese di esecuzione
    const links = t.querySelectorAll('a[target="_blank"]');
    expect(links.length).toBe(2); // inviato + pagato; «in preparazione» e «annullato» non hanno link
    links.forEach((a) => expect(a.getAttribute("rel")).toBe("noopener noreferrer"));
  });

  it("storico vuoto", async () => {
    mockFetch(me(ME_EMPTY));
    render(<AffiliateSection lang="it" />);
    expect((await screen.findAllByText("Nessun pagamento ancora.")).length).toBeGreaterThan(0);
    expect(screen.getByText("Il primo parte quando il maturato arriva a 50 $ e hai un wallet attivo. Qui vedrai mese, importo e il link alla transazione sulla rete.")).toBeTruthy();
    expect(screen.getByText("Nessuna commissione ancora.")).toBeTruthy();
  });

  it("inglese", async () => {
    mockFetch(me(ME));
    render(<AffiliateSection lang="en" />);
    expect(await screen.findByText("Your link")).toBeTruthy();
    expect(screen.getAllByText("$23.39").length).toBeGreaterThan(0);
  });
});

describe("wallet in due passi", () => {
  const open = async (handlerOver?: Handler) => {
    mockFetch((url, init) => handlerOver?.(url, init) ?? (url.startsWith("/api/affiliate/me") ? { status: 200, body: ME_EMPTY } : undefined));
    render(<AffiliateSection lang="it" />);
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi wallet" }));
    await screen.findByText("Passo 1 di 2 · Dati e indirizzo");
  };
  const fill = (over: Partial<{ name: string; country: string; addr: string; last6: string; checks: boolean }> = {}) => {
    const v = { name: "A. Bianchi", country: "IT", addr: ADDR_NEW, last6: "6c91d7", checks: true, ...over };
    fireEvent.change(screen.getByLabelText("Nome legale"), { target: { value: v.name } });
    fireEvent.change(screen.getByLabelText("Paese di residenza"), { target: { value: v.country } });
    fireEvent.change(screen.getByLabelText("Indirizzo del wallet (Polygon)"), { target: { value: v.addr } });
    fireEvent.change(screen.getByLabelText(/Conferma le ultime 6 cifre/), { target: { value: v.last6 } });
    if (v.checks) screen.getAllByRole("checkbox").forEach((b) => { if (!(b as HTMLInputElement).checked) fireEvent.click(b); });
  };

  it("form vuoto: riepilogo in cima (role=alert) con tutti gli errori, aria-invalid sui campi", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Ci sono 6 cose da correggere/);
    expect((screen.getByLabelText("Nome legale") as HTMLElement).getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByLabelText("Indirizzo del wallet (Polygon)") as HTMLElement).getAttribute("aria-invalid")).toBe("true");
  });

  it("Tron incollato: messaggio dedicato; ultime 6 diverse: messaggio dedicato", async () => {
    await open();
    fill({ addr: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", last6: "gjLj6t" });
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/indirizzo Tron/);
    cleanup();
    await open();
    fill({ last6: "000000" });
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/ultime 6 cifre non coincidono/);
  });

  it("paste permesso: nessun handler blocca onPaste", async () => {
    await open();
    const input = screen.getByLabelText("Indirizzo del wallet (Polygon)");
    const ev = new Event("paste", { bubbles: true, cancelable: true });
    input.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("passo 2: indirizzo intero con primi/ultimi 6 evidenziati, avviso 72 ore, salvataggio PUT corretto", async () => {
    await open((url, init) => {
      if (url.startsWith("/api/affiliate/me")) return { status: 200, body: ME_EMPTY };
      if (url === "/api/affiliate/wallet" && init?.method === "PUT") return { status: 200, body: { ok: true, wallet: null, cancelled_payouts: 0 } };
      return undefined;
    });
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    await screen.findByText("Passo 2 di 2 · Controlla e conferma");
    const big = screen.getByTestId("confirm-address");
    expect(big.textContent!.replace(/\s/g, "")).toBe(ADDR_NEW);
    expect([...big.querySelectorAll("b")].map((b) => b.textContent)).toEqual(["4b1e9a", "6c91d7"]);
    expect(screen.getByText(/72 ore dopo il salvataggio/)).toBeTruthy();
    // uscita facile quanto l'ingresso
    expect(screen.getByRole("button", { name: "Modifica i dati" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salva wallet" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
      address: ADDR_NEW, last6: "6c91d7", payee_legal_name: "A. Bianchi", payee_country: "IT",
      declarations: { sanctions: true, tax: true }, network_ack: true,
    });
  });

  it.each([
    ["invalid_checksum", "address", /Maiuscole e minuscole non corrispondono/],
    ["address_blocked", "address", /Non possiamo usare questo indirizzo/],
    ["address_not_allowed", "address", /non può ricevere i pagamenti/],
    ["last6_mismatch", "last6", /ultime 6 cifre non coincidono/],
    ["invalid_legal_name", "payee_legal_name", /nome legale/],
  ])("errore del server %s (campo %s) → torna al passo 1 col messaggio sul campo", async (error, field, re) => {
    await open((url, init) => {
      if (url.startsWith("/api/affiliate/me")) return { status: 200, body: ME_EMPTY };
      if (init?.method === "PUT") return { status: 422, body: { error, field } };
      return undefined;
    });
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salva wallet" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(re);
    expect(screen.getByText("Passo 1 di 2 · Dati e indirizzo")).toBeTruthy();
    expect(document.querySelector('[aria-invalid="true"]')).toBeTruthy();
  });

  it("il messaggio di screening non spiega il motivo", async () => {
    await open((url, init) => url.startsWith("/api/affiliate/me") ? { status: 200, body: ME_EMPTY } : init?.method === "PUT" ? { status: 422, body: { error: "address_blocked", field: "address" } } : undefined);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salva wallet" }));
    const t = (await screen.findByRole("alert")).textContent!;
    expect(t).not.toMatch(/sanzion|lista|rischio/i);
  });

  it("guasto (503 screening_unavailable) → resta al passo 2, «il wallet precedente non è cambiato»", async () => {
    await open((url, init) => url.startsWith("/api/affiliate/me") ? { status: 200, body: ME_EMPTY } : init?.method === "PUT" ? { status: 503, body: { error: "screening_unavailable" } } : undefined);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salva wallet" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/wallet precedente, se c'era, non è cambiato/);
    expect(screen.getByText("Passo 2 di 2 · Controlla e conferma")).toBeTruthy();
  });

  it("cambio wallet: indirizzo vuoto (mai precompilato), nome/paese precompilati, «Rimuovi» chiede conferma e fa DELETE", async () => {
    mockFetch((url, init) => url.startsWith("/api/affiliate/me") ? { status: 200, body: ME } : init?.method === "DELETE" ? { status: 200, body: { ok: true } } : undefined);
    render(<AffiliateSection lang="it" />);
    fireEvent.click(await screen.findByRole("button", { name: "Cambia wallet" }));
    expect((await screen.findByLabelText("Nuovo indirizzo (Polygon)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nome legale") as HTMLInputElement).value).toBe("A. Bianchi");
    expect(screen.getByText(/Cosa succede se lo cambi/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi il wallet" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
  });
});

describe("wallet USDC",()=>{
 it("changes the network acknowledgment with the selected coin and resets consent",async()=>{
 mockFetch(me({...ME_EMPTY, rails:{coins:["USDT","USDC"],networks:["polygon"]}}));
 render(<AffiliateSection lang="it"/>);
 fireEvent.click(await screen.findByRole("button",{name:/Aggiungi wallet/}));
 const ack=screen.getByRole("checkbox",{name:/Il mio wallet.*USDT/});
 fireEvent.click(ack);
 const select=screen.getAllByRole("combobox").find(e=>Array.from((e as HTMLSelectElement).options).some(o=>o.value==="USDC"))!;
 fireEvent.change(select,{target:{value:"USDC"}});
 expect(screen.getByRole("checkbox",{name:/Il mio wallet.*USDC/})).not.toBeChecked();
 });
});

