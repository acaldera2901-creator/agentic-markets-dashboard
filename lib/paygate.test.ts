import { describe, it, expect, vi, afterEach } from "vitest";
import { checkPaymentStatus } from "./paygate";

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
