// #AFFILIATE-TERMS-V3-1022 — il paragrafo privacy sugli HMAC antifrode si pubblica solo quando
// il trattamento esiste (AFFILIATE_HASH_SECRET impostato), mai prima.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/classic/ClassicChrome", () => ({ default: () => null }));
vi.mock("@/components/CookiePreferences", () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Privacy §11 — HMAC antifrode", () => {
  it("senza segreto: niente paragrafo; la voce am_ref e i referiti ci sono", async () => {
    vi.stubEnv("AFFILIATE_HASH_SECRET", "");
    const { default: PrivacyPage } = await import("./page");
    render(<PrivacyPage />);
    expect(screen.queryByTestId("privacy-affiliate-hmac")).toBeNull();
    expect(document.body.textContent).toMatch(/am_ref/);
    expect(document.body.textContent).toMatch(/If you were invited by an affiliate/);
  });
  it("con segreto: il paragrafo copre anche le visite a /r/CODE (IP+giorno e user-agent), 90 giorni", async () => {
    vi.stubEnv("AFFILIATE_HASH_SECRET", "s".repeat(32));
    const { default: PrivacyPage } = await import("./page");
    render(<PrivacyPage />);
    const p = screen.getByTestId("privacy-affiliate-hmac").textContent ?? "";
    expect(p).toMatch(/betredge\.com\/r\/CODE/);
    expect(p).toMatch(/user-agent/);
    expect(p).toMatch(/90 days/);
    expect(p).not.toMatch(/s{32}/);
  });
});
