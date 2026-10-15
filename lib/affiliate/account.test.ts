import { describe, expect, it } from "vitest";
import { hashIp, ledgerView, maskIdentifier, parseCursor, payoutView, walletView, type WalletRow } from "./account";
import { cleanCountry, cleanLegalName } from "./payee";

const ADDR = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const NOW = new Date("2026-10-15T12:00:00Z");

function wallet(over: Partial<WalletRow> = {}): WalletRow {
  return {
    id: 1,
    coin: "USDT",
    network: "polygon",
    address: ADDR,
    created_at: "2026-10-01T00:00:00Z",
    usable_after: "2026-10-04T00:00:00Z",
    screening_result: "clear",
    ...over,
  };
}

describe("maskIdentifier: le email dei referiti escono mascherate dal server", () => {
  it("email", () => {
    expect(maskIdentifier("mario.rossi@gmail.com")).toBe("m***@g***.com");
    expect(maskIdentifier(" Bea@sub.example.co.uk ")).toBe("B***@s***.uk");
  });
  it("non-email e casi limite", () => {
    expect(maskIdentifier("ab")).toBe("***");
    expect(maskIdentifier("telegram:12345")).toBe("te***");
    expect(maskIdentifier("x@nodot")).toBe("x***@n***");
  });
  it("non contiene mai la parte locale intera né il dominio", () => {
    const m = maskIdentifier("segreto.personale@dominio-privato.it");
    expect(m).not.toContain("segreto");
    expect(m).not.toContain("dominio");
  });
});

describe("walletView: stato derivato, indirizzo sempre mascherato", () => {
  it("nessun wallet", () => {
    expect(walletView(null, "active", NOW)).toMatchObject({ state: "none", payable: false, address_masked: null });
  });
  it("in cooldown (72 h) → non pagabile", () => {
    expect(walletView(wallet({ usable_after: "2026-10-16T00:00:00Z" }), "active", NOW)).toMatchObject({
      state: "cooldown",
      payable: false,
    });
  });
  it("fuori cooldown ma non screenato (nessun provider) → pending_screening, non pagabile", () => {
    expect(walletView(wallet({ screening_result: "not_screened" }), "active", NOW)).toMatchObject({
      state: "pending_screening",
      payable: false,
      screened: false,
    });
  });
  it("attivo", () => {
    const v = walletView(wallet(), "active", NOW);
    expect(v).toMatchObject({ state: "active", payable: true, address_masked: "0x5aAe…eAed" });
    expect(JSON.stringify(v)).not.toContain(ADDR);
  });
  it("sospeso vince su tutto", () => {
    expect(walletView(wallet(), "suspended", NOW)).toMatchObject({ state: "suspended", payable: false });
  });
});

describe("ledgerView", () => {
  it("somme per stato in centesimi, storni a parte, prossima maturazione", () => {
    const v = ledgerView(
      [
        { status: "pending", kind: "first", total: "10.10", n: 2, next_after: "2026-12-01 00:00:00+00" },
        { status: "pending", kind: "renewal", total: "0.20", n: 1, next_after: "2026-11-20 00:00:00+00" },
        { status: "payable", kind: "first", total: "60.00", n: 3, next_after: null },
        { status: "payable", kind: "clawback", total: "-6.00", n: 1, next_after: null },
        { status: "in_payout", kind: "first", total: "12.00", n: 1, next_after: null },
        { status: "paid", kind: "renewal", total: "7.07", n: 1, next_after: null },
      ],
      50,
    );
    expect(v).toEqual({
      pending: 10.3,
      payable: 54,
      to_recover: 0,
      in_payout: 12,
      paid: 7.07,
      reversed: -6,
      count: 9,
      next_payable_after: "2026-11-20 00:00:00+00",
      min_payout_usd: 50,
    });
  });
  it("netto negativo: Maturata a 0 e saldo da recuperare", () => {
    const v = ledgerView(
      [
        { status: "payable", kind: "first", total: "4.00", n: 1, next_after: null },
        { status: "payable", kind: "clawback", total: "-10.00", n: 1, next_after: null },
      ],
      50,
    );
    expect(v.payable).toBe(0);
    expect(v.to_recover).toBe(-6);
  });
  it("vuoto → tutto a zero, nessuna data", () => {
    expect(ledgerView([], 50)).toMatchObject({ pending: 0, payable: 0, paid: 0, count: 0, next_payable_after: null });
  });
});

describe("payoutView", () => {
  const base = {
    id: "7",
    period_month: "2026-10-01",
    amount_usd: "60.00",
    coin: "USDT" as const,
    network: "polygon" as const,
    amount_coin: "60.000000",
    tx_hash: `0x${"ab".repeat(32)}`,
    paid_at: "2026-10-05",
    cancel_code: null,
  };
  it("paid: explorer_url e importo letto on-chain", () => {
    expect(payoutView({ ...base, status: "paid" })).toMatchObject({
      id: 7,
      amount_usd: 60,
      amount_coin: 60,
      explorer_url: `https://polygon.blockscout.com/tx/0x${"ab".repeat(32)}`,
    });
  });
  it("prima di paid amount_coin non esce; senza hash nessun link", () => {
    expect(payoutView({ ...base, status: "submitted" }).amount_coin).toBeNull();
    expect(payoutView({ ...base, status: "created", tx_hash: null }).explorer_url).toBeNull();
  });
  it("annullato: esce il codice enumerato, mai un testo libero", () => {
    const v = payoutView({ ...base, status: "cancelled", tx_hash: null, cancel_code: "admin_cancelled" });
    expect(v.cancel_code).toBe("admin_cancelled");
    expect(Object.keys(v)).not.toContain("cancel_reason");
    expect(Object.keys(v)).not.toContain("to_address");
  });
});

describe("parseCursor / hashIp", () => {
  it("cursore: solo interi positivi", () => {
    expect(parseCursor("42")).toBe(42);
    for (const bad of [null, "", "0", "-1", "1;DROP", "1e3", "01"]) expect(parseCursor(bad)).toBeNull();
  });
  it("hashIp: HMAC stabile, mai l'IP in chiaro; senza segreto null", () => {
    const h = hashIp("1.2.3.4", "s".repeat(32));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashIp("1.2.3.4", "s".repeat(32)));
    expect(hashIp("1.2.3.4", undefined)).toBeNull();
    expect(hashIp("unknown", "s".repeat(32))).toBeNull();
  });
});

describe("payee (D3)", () => {
  it("nome legale: trim, spazi compressi, 2–200, niente controllo", () => {
    expect(cleanLegalName("  Mario   Rossi ")).toBe("Mario Rossi");
    expect(cleanLegalName("M")).toBeNull();
    expect(cleanLegalName("x".repeat(201))).toBeNull();
    expect(cleanLegalName("Mario\u0000Rossi")).toBeNull();
    expect(cleanLegalName(42)).toBeNull();
  });
  it("paese: ISO alpha-2 di un paese vero", () => {
    expect(cleanCountry(" it ")).toBe("IT");
    expect(cleanCountry("XK")).toBe("XK");
    for (const bad of ["ZZ", "EU", "UN", "XX", "AA", "ITA", "1T", null]) expect(cleanCountry(bad)).toBeNull();
  });
});
