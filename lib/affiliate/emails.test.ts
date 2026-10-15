import { describe, expect, it } from "vitest";
import { walletChangedEmail } from "./emails";

describe("walletChangedEmail", () => {
  it("5 lingue, indirizzo solo mascherato, avviso «non sei stato tu»", () => {
    for (const lang of ["it", "en", "es", "fr", "ru"]) {
      const m = walletChangedEmail({
        lang,
        removed: false,
        addressMasked: "0x5aAe…eAed",
        usableAfterISO: "2026-10-18T12:32:00Z",
        payoutCancelled: false,
      });
      expect(m.subject.length).toBeGreaterThan(5);
      expect(m.text).toContain("0x5aAe…eAed");
      expect(m.html).toContain("0x5aAe…eAed");
      expect(m.text).toMatch(/@/); // contatto
    }
  });
  it("lingua sconosciuta → italiano (resolveMailLang)", () => {
    const m = walletChangedEmail({ lang: "de", removed: true, addressMasked: null, usableAfterISO: null, payoutCancelled: false });
    expect(m.subject).toBe("Il wallet per i pagamenti è stato rimosso");
  });
  it("payout annullato: riga in più", () => {
    const a = walletChangedEmail({ lang: "en", removed: false, addressMasked: "x", usableAfterISO: null, payoutCancelled: true });
    expect(a.text).toContain("cancelled before sending");
    const b = walletChangedEmail({ lang: "en", removed: false, addressMasked: "x", usableAfterISO: null, payoutCancelled: false });
    expect(b.text).not.toContain("cancelled before sending");
  });
});
