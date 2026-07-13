import { describe, it, expect, vi, afterEach } from "vitest";
import { checkPaymentStatus, evaluateCallback, resolveFeeTolerance, blocksLowerTierPurchase } from "./paygate";

// #PAYGATE-ENCODE-FIX-STATUS: l'ipn_token restituito da wallet.php è GIÀ url-encoded
// (contiene %2B/%2F/%3D). Va concatenato COSÌ COM'È nella query di payment-status.php,
// esattamente come l'address_in in buildPayUrl. encodeURIComponent lo doppio-encodava
// (%3D→%253D) → PayGate rispondeva "unpaid" → nessun grant. Questo test blinda il fix.
describe("checkPaymentStatus — ipn_token già-encoded non va doppio-encodato", () => {
  afterEach(() => vi.restoreAllMocks());

  it("concatena l'ipn_token as-is (nessun %3D→%253D)", async () => {
    const token = "abc-DEF_ghi123%3D"; // come da wallet.php (trailing '=' già encodato)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "paid", value_coin: "5.70", txid_out: "0xabc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await checkPaymentStatus(token);

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain(`ipn_token=${token}`); // token preservato integro
    expect(calledUrl).not.toContain("%253D"); // MAI doppio-encoding
  });
});

// #GOLIVE-HIGH-E: revenue-leak fee tolerance. Il vecchio floor 0.5 (50%) lasciava
// concedere il piano con value_coin ≥ amount×0.5 → auto-sconto fino a ~50%. Con il
// nuovo default 0.15 (soglia amount×0.85) un ordine legittimo passa (fee reali ~14%,
// il netto misurato è >100%) ma un pagamento a metà prezzo viene rifiutato.
describe("evaluateCallback — fee tolerance 15%", () => {
  const order = { status: "pending", amount_usd: 5 };

  it("4.30 su 5 PASSA (fee ~14%, sopra la soglia 4.25)", () => {
    const d = evaluateCallback({ order, valueCoin: 4.3 });
    expect(d.grant).toBe(true);
    expect(d.reason).toBe("ok");
  });

  it("2.60 su 5 NON passa (col vecchio floor 50% sarebbe passato)", () => {
    const d = evaluateCallback({ order, valueCoin: 2.6 });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("amount below threshold");
  });

  it("override esplicito feeTolerance ha precedenza sul default", () => {
    // 2.60 su 5 con tol 0.5 → soglia 2.5 → passa (comportamento vecchio, on-demand)
    expect(evaluateCallback({ order, valueCoin: 2.6, feeTolerance: 0.5 }).grant).toBe(true);
  });
});

describe("resolveFeeTolerance — env override con clamp 0–0.5", () => {
  afterEach(() => {
    delete process.env.PAYGATE_FEE_TOLERANCE;
  });

  it("fallback 0.15 se env assente", () => {
    delete process.env.PAYGATE_FEE_TOLERANCE;
    expect(resolveFeeTolerance()).toBe(0.15);
  });

  it("legge e parsa un valore valido", () => {
    process.env.PAYGATE_FEE_TOLERANCE = "0.25";
    expect(resolveFeeTolerance()).toBe(0.25);
  });

  it("clampa oltre 0.5 e sotto 0", () => {
    process.env.PAYGATE_FEE_TOLERANCE = "0.9";
    expect(resolveFeeTolerance()).toBe(0.5);
    process.env.PAYGATE_FEE_TOLERANCE = "-0.2";
    expect(resolveFeeTolerance()).toBe(0);
  });

  it("fallback su valore non numerico o vuoto", () => {
    process.env.PAYGATE_FEE_TOLERANCE = "abc";
    expect(resolveFeeTolerance()).toBe(0.15);
    process.env.PAYGATE_FEE_TOLERANCE = "";
    expect(resolveFeeTolerance()).toBe(0.15);
  });
});

// #GOLIVE-HIGH-E: tier-guard al checkout (paygate + paypal). Blocca solo il
// downgrade a pagamento (premium-attivo → base); upgrade e rinnovi pari-tier passano.
describe("blocksLowerTierPurchase — tier-guard", () => {
  it("premium attivo + acquisto base = BLOCCATO", () => {
    expect(blocksLowerTierPurchase("premium", "base")).toBe(true);
  });
  it("premium attivo + acquisto premium (rinnovo) = consentito", () => {
    expect(blocksLowerTierPurchase("premium", "premium")).toBe(false);
  });
  it("base attivo + acquisto premium (upgrade) = consentito", () => {
    expect(blocksLowerTierPurchase("base", "premium")).toBe(false);
  });
  it("free/pending + acquisto base = consentito", () => {
    expect(blocksLowerTierPurchase("free", "base")).toBe(false);
    expect(blocksLowerTierPurchase("pending_payment", "base")).toBe(false);
  });
});
