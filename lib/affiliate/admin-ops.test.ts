// #AFFILIATE-COMPLETE-1023 — no full wallet address in the admin-op log line.
import { describe, expect, it } from "vitest";
import { maskAddressesIn } from "./admin-ops";

describe("maskAddressesIn", () => {
  it("masks every 40-hex address, leaves 64-hex tx hashes and other text alone", () => {
    const addr = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
    const hash = `0x${"ab".repeat(32)}`;
    const line = JSON.stringify({ ok: true, to_address: addr, tx_hash: hash, amount_usd: 60 });
    const out = maskAddressesIn(line);
    expect(out).not.toContain(addr);
    expect(out).toContain('"to_address":"0x5aAe…eAed"');
    expect(out).toContain(hash);
    expect(out).toContain('"amount_usd":60');
  });
});
