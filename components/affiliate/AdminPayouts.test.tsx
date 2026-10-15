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
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("2 selezionati · $310,60.")).toBeTruthy();
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
    expect((screen.getByRole("button", { name: /Crea/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("senza wallet di uscita: avviso e niente creazione", async () => {
    mock(list({ payout_from: null }));
    render(<AdminPayouts />);
    expect(await screen.findByText(/Wallet di uscita non configurato/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Crea/ }) as HTMLButtonElement).disabled).toBe(true);
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

  it("deselezionare ricalcola il totale; POST con expected_total e solo gli id scelti", async () => {
    mock((url, method) => method === "POST" ? { status: 200, body: { ok: true } } : list()(url));
    render(<AdminPayouts />);
    await screen.findByText("ESEMPIO-A");
    fireEvent.click(screen.getByLabelText("Seleziona ESEMPIO-B"));
    expect(screen.getByText("1 selezionato · $212,40.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Crea 1 payout" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ month: "2026-10", ids: [1], expected_total: "212.40" });
  });

  it("409 total_mismatch: mostra la differenza e rilegge (non crea)", async () => {
    mock((url, method) => method === "POST" ? { status: 409, body: { ok: false, error: "total_mismatch", expected: "310.60", actual: "374.00" } } : list()(url));
    render(<AdminPayouts />);
    await screen.findByText("ESEMPIO-A");
    fireEvent.click(screen.getByRole("button", { name: "Crea 2 payout" }));
    const alert = await screen.findByText(/Il totale è cambiato/);
    expect(alert.textContent).toMatch(/atteso \$310,60, ora \$374,00/);
    expect(alert.textContent).toMatch(/Non è stato creato niente/);
    await waitFor(() => expect(calls.filter((c) => c.method === "GET").length).toBeGreaterThanOrEqual(2));
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
    setup({ affiliate_status: "suspended" });
    await openTx();
    expect(screen.getByTestId("affiliate-status").textContent).toMatch(/SOSPESO/);
    expect((screen.getByRole("button", { name: "Registra e verifica" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(screen.getByTestId("tx-confirm")).getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
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

  it("submitted: Riverifica; annullo offerto solo dopo un not_found/tx_failed; overpaid con copy neutro", async () => {
    const adminSent = { ...ADMIN, rows: ADMIN.rows.map((r) => (r.payout ? { ...r, payout: { ...r.payout, status: "submitted" } } : r)) };
    mock((url, method) => {
      if (url.startsWith("/api/admin/affiliate/payouts?") || url === "/api/admin/affiliate/payouts") return { status: 200, body: adminSent };
      if (url === "/api/admin/affiliate/payouts/11" && method === "GET") return { status: 200, body: { payout: { ...ADMIN_PAYOUT, status: "submitted", tx_hash: TX, explorer_url: `https://x/tx/${TX}`, overpaid: true }, payout_from: ADMIN.payout_from } };
      if (url.endsWith("/verify")) return { status: 422, body: { outcome: "rejected", reason: "not_found" } };
      return undefined;
    });
    render(<AdminPayouts />);
    fireEvent.click(await screen.findByRole("button", { name: "Apri · riverifica" }));
    expect((await screen.findByTestId("overpaid")).textContent).toMatch(/superiore al dovuto/);
    expect(screen.queryByRole("button", { name: "Annulla payout" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Riverifica" }));
    await screen.findByText(/Hash non trovato sulla rete/);
    expect(screen.getByRole("button", { name: "Annulla payout" })).toBeTruthy();
  });
});
