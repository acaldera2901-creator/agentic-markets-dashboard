import { describe, expect, it } from "vitest";
import { addressScreener, ScreeningUnavailableError, screenPayoutAddress, type AddressScreener } from "./screening";

const ADDR = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const fake = (screen: AddressScreener["screen"]): AddressScreener => ({ name: "fake", screen });

describe("screening (fail-closed, nessun provider integrato)", () => {
  it("oggi non c'è nessun provider: dichiarato, non nascosto", () => {
    expect(addressScreener()).toBeNull();
  });
  it("senza provider → not_screened (il wallet si salva ma non è pagabile)", async () => {
    await expect(screenPayoutAddress("polygon", ADDR, null)).resolves.toEqual({ kind: "not_screened" });
  });
  it("clear / blocked dal provider", async () => {
    await expect(screenPayoutAddress("polygon", ADDR, fake(async () => "clear"))).resolves.toEqual({
      kind: "clear",
      provider: "fake",
    });
    await expect(screenPayoutAddress("polygon", ADDR, fake(async () => "blocked"))).resolves.toEqual({
      kind: "blocked",
      provider: "fake",
    });
  });
  it("provider che non risponde o risponde storto → ScreeningUnavailableError", async () => {
    await expect(
      screenPayoutAddress("polygon", ADDR, fake(async () => { throw new Error("timeout"); })),
    ).rejects.toBeInstanceOf(ScreeningUnavailableError);
    await expect(
      screenPayoutAddress("polygon", ADDR, fake(async () => "maybe" as never)),
    ).rejects.toBeInstanceOf(ScreeningUnavailableError);
  });
});
