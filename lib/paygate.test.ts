import { describe, it, expect, vi, afterEach } from "vitest";
import { checkPaymentStatus, shouldSettle } from "./paygate";

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

// #PAYGATE-SELFHEAL: il reconciler concede un ordine PENDING solo se PayGate lo
// conferma 'paid' (poll server-side) e l'importo regge la soglia fee-tolerant.
describe("shouldSettle — decisione di settlement del reconciler su ordini pending", () => {
  it("settle su paid con value_coin sopra soglia (fee -50% ok)", () => {
    // $5 richiesti, PayGate accredita 5.70 netto → sopra 2.50 → settle
    expect(shouldSettle({ status: "paid", valueCoin: 5.7 }, 5)).toEqual({ settle: true, reason: "ok" });
    // anche col taglio fee massimo tollerato (esattamente 50%) → settle
    expect(shouldSettle({ status: "paid", valueCoin: 2.5 }, 5).settle).toBe(true);
  });

  it("NON settle se PayGate non dice paid", () => {
    expect(shouldSettle({ status: "unpaid", valueCoin: null }, 5)).toEqual({ settle: false, reason: "not paid" });
    expect(shouldSettle({ status: "pending", valueCoin: 0 }, 5).settle).toBe(false);
    expect(shouldSettle(null, 5)).toEqual({ settle: false, reason: "not paid" });
  });

  it("NON settle se l'importo è sotto la soglia (paid ma value_coin troppo basso)", () => {
    // paid ma value_coin 1.00 su ordine da $5 (< 2.50) → sospetto → no settle
    expect(shouldSettle({ status: "paid", valueCoin: 1 }, 5)).toEqual({ settle: false, reason: "amount below threshold" });
    // paid ma value_coin mancante/malformato → no settle
    expect(shouldSettle({ status: "paid", valueCoin: null }, 5)).toEqual({ settle: false, reason: "missing value_coin" });
  });
});
