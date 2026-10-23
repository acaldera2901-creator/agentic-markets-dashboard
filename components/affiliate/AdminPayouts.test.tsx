// components/affiliate/AdminPayouts.test.tsx — #AFFILIATE-V2-UI-1015
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { AdminPayouts } from "./AdminPayouts";
import { ADMIN, ADMIN_PAYOUT, TX } from "./fixtures";

type R = { status: number; body?: unknown } | undefined;
let calls: { url: string; method: string; body: unknown }[] = [];
function mock(h: (url: string, method: string, body: unknown) => R) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const r = h(url, method, body) ?? { status: 404, body: {} };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body } as Response;
  }));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const list = (over: object = {}) => (url: string): R => (url.startsWith("/api/admin/affiliate/payouts?") || url === "/api/admin/affiliate/payouts" ? { status: 200, body: { ...ADMIN, ...over } } : undefined);

describe("lista del mese", () => {
  it("nessuna riga sparisce; i non pagabili hanno il motivo in parole; solo gli eleggibili hanno la spunta", async () => {
    mock(list());
    render(<AdminPayouts />);
    await screen.findByText("ESEMPIO-A");
    for (const c of ["ESEMPIO-A", "ESEMPIO-B", "ESEMPIO-C", "ESEMPIO-D", "ESEMPIO-E", "ESEMPIO-F"]) expect(screen.getByText(c)).toBeTruthy();
    expect(screen.getByText(/wallet in attesa delle 72 ore/)).toBeTruthy();
    expect(screen.getAllByText(/sotto soglia: passa al mese dopo/).length).toBeGreaterThan(0);
    // #AFFILIATE-COMPLETE-1023: creation lives in the backoffice (named operators), not here.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Crea/ })).toBeNull();
    expect(screen.getByTestId("create-in-bo").textContent).toMatch(/backoffice/);
  });

  it("l'indirizzo intero non compare mai nella lista (solo mascherato)", async () => {
    mock(list());
    render(<AdminPayouts />);
    await screen.findByText("ESEMPIO-A");
    expect(document.body.textContent).not.toMatch(/0x4b1e9a07c3d85f2e/);
    expect(screen.getAllByText("0x4b1e…91d7").length).toBeGreaterThan(0);
  });

  it("mode:off è visibile e spegne Crea", async () => {
    mock(list({ mode: "off" }));
    render(<AdminPayouts />);
    expect(await screen.findByTestId("payouts-off")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Crea/ })).toBeNull();
  });

  it("senza wallet di uscita: avviso e niente creazione", async () => {
    mock(list({ payout_from: null }));
    render(<AdminPayouts />);
    expect(await screen.findByText(/Wallet di uscita non configurato/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Crea/ })).toBeNull();
  });

  it("401 → sessione scaduta; 500 → errore con retry, nessuna riga inventata", async () => {
    mock(() => ({ status: 401, body: { error: "Unauthorized" } }));
    const a = render(<AdminPayouts />);
    expect(await screen.findByText(/Sessione admin scaduta/)).toBeTruthy();
    a.unmount();
    mock(() => ({ status: 500, body: { error: "read failed" } }));
    render(<AdminPayouts />);
    expect(await screen.findByText(/Non riesco a leggere i payout/)).toBeTruthy();
    expect(screen.queryByText("ESEMPIO-A")).toBeNull();
  });

  it("mese passato: sola lettura", async () => {
    mock(list({ month: "2026-09" }));
    render(<AdminPayouts />);
    await screen.findByText(/Mese passato: sola lettura/);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("registra tx", () => {
  const setup = (payout: object = {}, over?: (url: string, method: string) => R) => {
    const p = { ...ADMIN_PAYOUT, ...payout };
    mock((url, method, body) => {
      const o = over?.(url, method);
      if (o) return o;
      if (url.startsWith("/api/admin/affiliate/payouts?") || url === "/api/admin/affiliate/payouts") return { status: 200, body: ADMIN };
      if (url === "/api/admin/affiliate/payouts/11" && method === "GET") return { status: 200, body: { payout: p, payout_from: ADMIN.payout_from } };
      if (url.endsWith("/tx")) return { status: 200, body: { outcome: "paid", payout_id: 11, confirmations: 34, amount_coin: "63.400000" } };
      void body;
      return undefined;
    });
  };
  const openTx = async () => {
    render(<AdminPayouts />);
    fireEvent.click(await screen.findByRole("button", { name: "Invia e registra hash" }));
    await screen.findByText("1 · Importo da inviare (USDT, 2 decimali)");
  };

  it("indirizzo intero in gruppi, primi/ultimi 6 evidenziati, stato dell'affiliato in vista", async () => {
    setup();
    await openTx();
    const big = screen.getByRole("group", { name: "Indirizzo di destinazione" });
    expect(big.textContent!.replace(/\s/g, "")).toBe(ADMIN_PAYOUT.to_address);
    expect([...big.querySelectorAll("b")].map((b) => b.textContent)).toEqual(["58cde3", "b2a014"]);
    expect(screen.getByTestId("affiliate-status").textContent).toMatch(/attivo/);
  });

  it("importo: a schermo con la virgola italiana, micro-etichetta «copia: 63.40» col punto, e il valore copiato è col punto", async () => {
    setup();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await openTx();
    expect(screen.getByText("63,40")).toBeTruthy();
    expect(screen.getByTestId("copy-hint").textContent).toMatch(/^copia: 63\.40/);
    fireEvent.click(screen.getByRole("button", { name: "Copia importo" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("63.40"));
  });

  it("importo ESATTO dichiarato nel passo 1; amount_too_low ha un motivo leggibile", async () => {
    setup({}, (url) => url.endsWith("/tx") ? { status: 422, body: { outcome: "rejected", reason: "amount_too_low" } } : undefined);
    await openTx();
    expect(screen.getByTestId("exact-amount").textContent).toMatch(/Invia l'importo ESATTO.*0,01 in meno viene rifiutato/);
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Registra e verifica" }));
    const t = (await screen.findByTestId("tx-result")).textContent!;
    expect(t).toMatch(/inferiore al dovuto \(anche di 0,01\): serve l'importo ESATTO/);
    expect(t).toMatch(/resta com'era/);
  });

  it("«Registra e verifica» resta spento finché non c'è la conferma obbligatoria e l'hash", async () => {
    setup();
    await openTx();
    const btn = screen.getByRole("button", { name: "Registra e verifica" }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    expect(btn.disabled).toBe(true);
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    expect(btn.disabled).toBe(false);
  });

  it("riletta prima di scrivere: se stato o indirizzo sono cambiati NON registra", async () => {
    let n = 0;
    setup({}, (url, method) => {
      if (url === "/api/admin/affiliate/payouts/11" && method === "GET") {
        n += 1;
        if (n >= 2) return { status: 200, body: { payout: { ...ADMIN_PAYOUT, status: "cancelled", cancel_code: "wallet_changed" }, payout_from: ADMIN.payout_from } };
        return { status: 200, body: { payout: ADMIN_PAYOUT, payout_from: ADMIN.payout_from } };
      }
      return undefined;
    });
    await openTx();
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Registra e verifica" }));
    expect((await screen.findByTestId("tx-result")).textContent).toMatch(/cambiato mentre lavoravi/);
    expect(calls.some((c) => c.url.endsWith("/tx"))).toBe(false);
  });

  it("affiliato sospeso: blocco evidente, nessun invio/registrazione", async () => {
    setup({ affiliate_status: "suspended", sent_marked_at: null, sent_marked_by: null });
    await openTx();
    expect(screen.getByTestId("affiliate-status").textContent).toMatch(/SOSPESO/);
    expect((screen.getByRole("button", { name: "Registra e verifica" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(screen.getByTestId("tx-confirm")).getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  });

  it("#AFFILIATE-COMPLETE-1023: sospeso dopo la marca «in uscita» → l'hash si registra (come la SQL)", async () => {
    setup({ affiliate_status: "suspended" });
    await openTx();
    expect(screen.getByTestId("affiliate-status").textContent).toMatch(/SOSPESO.*già approvato e marcato/);
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    expect((screen.getByRole("button", { name: "Registra e verifica" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("#AFFILIATE-COMPLETE-1023: non ancora marcato «in uscita» → avviso, niente registrazione", async () => {
    setup({ sent_marked_at: null, sent_marked_by: null });
    await openTx();
    expect(screen.getByTestId("mark-state").textContent).toMatch(/Non ancora approvato.*Non inviare fondi/);
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    expect((screen.getByRole("button", { name: "Registra e verifica" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("USDC: il passo 1 dice la valuta del payout, non USDT", async () => {
    setup({ coin: "USDC" });
    render(<AdminPayouts />);
    fireEvent.click(await screen.findByRole("button", { name: "Invia e registra hash" }));
    expect(await screen.findByText("1 · Importo da inviare (USDC, 2 decimali)")).toBeTruthy();
    expect(screen.getByTestId("mark-state").textContent).toMatch(/bo:marco/);
  });

  it("esito paid: POST /tx con l'hash, messaggio di verifica", async () => {
    setup();
    await openTx();
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: ` ${TX} ` } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Registra e verifica" }));
    expect((await screen.findByTestId("tx-result")).textContent).toMatch(/Verificato sulla rete/);
    expect(calls.find((c) => c.url.endsWith("/tx"))?.body).toEqual({ hash: TX });
  });

  it("esito rejected: motivo in parole, il payout resta in preparazione", async () => {
    setup({}, (url) => url.endsWith("/tx") ? { status: 422, body: { outcome: "rejected", reason: "wrong_recipient" } } : undefined);
    await openTx();
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Registra e verifica" }));
    const t = (await screen.findByTestId("tx-result")).textContent!;
    expect(t).toMatch(/destinatario è diverso/);
    expect(t).toMatch(/resta com'era/);
  });

  it("annulla: motivo obbligatorio, POST /cancel", async () => {
    setup({}, (url, method) => url.endsWith("/cancel") && method === "POST" ? { status: 200, body: { ok: true } } : undefined);
    await openTx();
    fireEvent.click(screen.getByRole("button", { name: "Annulla payout" }));
    fireEvent.click(screen.getByRole("button", { name: "Conferma annullo" }));
    expect((await screen.findByTestId("tx-result")).textContent).toMatch(/motivo è obbligatorio/);
    expect(calls.some((c) => c.url.endsWith("/cancel"))).toBe(false);
    fireEvent.change(screen.getByLabelText(/Motivo dell.annullo/), { target: { value: "wallet errato" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferma annullo" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/cancel"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/cancel"))?.body).toEqual({ reason: "wallet errato" });
  });

  let sentAffStatus = "active";
  const sentSetup = (extra: (url: string, method: string) => R) => {
    const adminSent = { ...ADMIN, rows: ADMIN.rows.map((r) => (r.payout ? { ...r, payout: { ...r.payout, status: "submitted" } } : r)) };
    mock((url, method) => {
      const o = extra(url, method);
      if (o) return o;
      if (url.startsWith("/api/admin/affiliate/payouts?") || url === "/api/admin/affiliate/payouts") return { status: 200, body: adminSent };
      if (url === "/api/admin/affiliate/payouts/11" && method === "GET") return { status: 200, body: { payout: { ...ADMIN_PAYOUT, status: "submitted", tx_hash: TX, tx_nonce: 42, tx_block: 1234567, tx_from: ADMIN.payout_from, affiliate_status: sentAffStatus, explorer_url: `https://x/tx/${TX}` }, payout_from: ADMIN.payout_from } };
      return undefined;
    });
  };
  const openSent = async () => {
    render(<AdminPayouts />);
    fireEvent.click(await screen.findByRole("button", { name: "Apri · riverifica" }));
    await screen.findByText("Hash registrato");
  };

  it("submitted: il bottone Annulla dice che prima si riverifica; il server decide (tx valida → 409, mai «paga di nuovo»)", async () => {
    sentSetup((url, method) => url.endsWith("/cancel") && method === "POST" ? { status: 409, body: { error: "tx_on_chain", outcome: "paid" } } : undefined);
    await openSent();
    expect(document.body.textContent).toMatch(/il server controlla la rete/);
    expect(document.body.textContent).toMatch(/almeno 30 minuti/);
    fireEvent.click(screen.getByRole("button", { name: /il server controlla la rete/ }));
    fireEvent.change(screen.getByLabelText(/Motivo dell.annullo/), { target: { value: "tx sparita" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferma annullo" }));
    const t = (await screen.findByTestId("tx-result")).textContent!;
    expect(t).toMatch(/ancora valida sulla rete/);
    expect(t).not.toMatch(/paga(re)? di nuovo|ripaga(re)? lo stesso|riprova a pagare/i);
  });

  it("submitted: tx sparita → annullo riuscito con testo dedicato", async () => {
    sentSetup((url, method) => url.endsWith("/cancel") && method === "POST" ? { status: 200, body: { ok: true, cancel_code: "tx_dropped", onchain: "not_found" } } : undefined);
    await openSent();
    fireEvent.click(screen.getByRole("button", { name: /il server controlla la rete/ }));
    fireEvent.change(screen.getByLabelText(/Motivo dell.annullo/), { target: { value: "tx sparita" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferma annullo" }));
    expect((await screen.findByTestId("tx-result")).textContent).toMatch(/non potrà più essere minata/);
  });

  it("503 «verificatore non disponibile» è distinto da «hash non trovato»; too_recent ha il suo testo", async () => {
    sentSetup((url, method) => url.endsWith("/verify") && method === "POST" ? { status: 503, body: { error: "verifier_unavailable" } } : url.endsWith("/cancel") && method === "POST" ? { status: 409, body: { ok: false, error: "too_recent" } } : undefined);
    await openSent();
    fireEvent.click(screen.getByRole("button", { name: "Riverifica" }));
    const t = (await screen.findByTestId("tx-result")).textContent!;
    expect(t).toMatch(/non risponde/);
    expect(t).not.toMatch(/Hash non trovato sulla rete/);
    fireEvent.click(screen.getByRole("button", { name: /il server controlla la rete/ }));
    fireEvent.change(screen.getByLabelText(/Motivo dell.annullo/), { target: { value: "tx sparita" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferma annullo" }));
    await waitFor(() => expect(screen.getByTestId("tx-result").textContent).toMatch(/meno di 30 minuti/));
  });

  it.each([
    ["nonce_unknown", undefined, /nonce dell'invio/],
    ["tx_not_droppable", "nonce_not_consumed", /sostituire la tx bloccata dal wallet di uscita \(stesso nonce\) e aspettare che sia finalizzata/],
    ["tx_not_droppable", "tx_pending", /ancora in attesa sulla rete/],
    ["tx_not_droppable", "tx_on_chain", /ancora valida sulla rete/],
    ["tx_not_droppable", "not_finalized", /aspetta la finalizzazione/],
    ["tx_not_droppable", "transfer_found", /La tx risulta sulla rete: non si annulla/],
    ["block_unknown", undefined, /blocco dell'invio/],
    ["from_unknown", undefined, /mittente della tx non è registrato: il server non annulla, gestiscilo a mano/],
  ])("annullo di submitted rifiutato: %s %s → testo dedicato, mai «pagare di nuovo»", async (error, reason, re) => {
    sentSetup((url, method) => url.endsWith("/cancel") && method === "POST" ? { status: 409, body: { error, reason } } : undefined);
    await openSent();
    fireEvent.click(screen.getByRole("button", { name: /il server controlla la rete/ }));
    fireEvent.change(screen.getByLabelText(/Motivo dell.annullo/), { target: { value: "tx bloccata" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferma annullo" }));
    const t = (await screen.findByTestId("tx-result")).textContent!;
    expect(t).toMatch(re);
    expect(t).not.toMatch(/pagare di nuovo|paga di nuovo|ripaga|rifai il pagamento/i);
  });

  it("hash_already_used con dropped:true → «appartiene a un pagamento annullato»", async () => {
    setup({}, (url) => url.endsWith("/tx") ? { status: 409, body: { error: "hash_already_used", dropped: true } } : undefined);
    await openTx();
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Registra e verifica" }));
    expect((await screen.findByTestId("tx-result")).textContent).toMatch(/appartiene a un pagamento annullato perché la transazione era sparita/);
  });

  it("submitted: il nonce registrato è visibile; affiliato sospeso NON blocca Riverifica (può diventare Pagato)", async () => {
    sentAffStatus = "suspended";
    sentSetup(() => undefined);
    await openSent();
    expect(screen.getByText(/Nonce registrato: 42 · blocco 1234567/)).toBeTruthy();
    expect(screen.getByTestId("tx-from").textContent).toContain(ADMIN.payout_from);
    expect(screen.getByTestId("affiliate-status").textContent).toMatch(/SOSPESO.*puoi riverificare/);
    expect((screen.getByRole("button", { name: "Riverifica" }) as HTMLButtonElement).disabled).toBe(false);
    sentAffStatus = "active";
  });

  it("tx_from_mismatch (dall'esito di verify): avviso «non potrà essere annullato automaticamente»", async () => {
    sentSetup((url, method) => url.endsWith("/verify") && method === "POST" ? { status: 200, body: { outcome: "submitted", payout_id: 11, confirmations: 12, required: 30, tx_from_mismatch: true } } : undefined);
    await openSent();
    fireEvent.click(screen.getByRole("button", { name: "Riverifica" }));
    expect((await screen.findByTestId("from-mismatch")).textContent).toMatch(/Tx non firmata dal wallet di uscita.*non potrà essere annullato automaticamente/);
    expect(screen.getByRole("button", { name: "Riverifica" })).toBeTruthy(); // la registrazione è avvenuta comunque
  });

  it("from_unknown (409) su «Riverifica» e su «Registra e verifica»: stesso testo neutro, payout invariato", async () => {
    sentSetup((url, method) => url.endsWith("/verify") && method === "POST" ? { status: 409, body: { error: "from_unknown" } } : undefined);
    await openSent();
    fireEvent.click(screen.getByRole("button", { name: "Riverifica" }));
    expect((await screen.findByTestId("tx-result")).textContent).toMatch(/mittente della tx non è registrato: il server non annulla, gestiscilo a mano/);
    cleanup();
    setup({}, (url) => url.endsWith("/tx") ? { status: 409, body: { error: "from_unknown" } } : undefined);
    await openTx();
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Registra e verifica" }));
    expect((await screen.findByTestId("tx-result")).textContent).toMatch(/mittente della tx non è registrato/);
  });

  it("overpaid (dall'esito di verify): avviso neutro, nessuna azione automatica", async () => {
    sentSetup((url, method) => url.endsWith("/verify") && method === "POST" ? { status: 200, body: { outcome: "submitted", payout_id: 11, confirmations: 12, required: 30, overpaid: true } } : undefined);
    await openSent();
    fireEvent.click(screen.getByRole("button", { name: "Riverifica" }));
    expect((await screen.findByTestId("overpaid")).textContent).toMatch(/superiore al dovuto.*Nessuna azione automatica/);
  });

  it("registra: affiliate_not_active dal DB → messaggio, niente registrato", async () => {
    setup({}, (url) => url.endsWith("/tx") ? { status: 409, body: { error: "affiliate_not_active", affiliate_status: "suspended" } } : undefined);
    await openTx();
    fireEvent.change(screen.getByLabelText(/Incolla l.hash/), { target: { value: TX } });
    fireEvent.click(within(screen.getByTestId("tx-confirm")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Registra e verifica" }));
    expect((await screen.findByTestId("tx-result")).textContent).toMatch(/L'affiliato non è attivo/);
  });
});
