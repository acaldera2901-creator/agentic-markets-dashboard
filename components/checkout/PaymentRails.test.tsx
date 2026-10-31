import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentRails, startShopifyCheckout } from "./PaymentRails";
vi.mock("@/components/CryptoDirectPanel", () => ({ CryptoDirectPanel: () => <div>crypto-panel</div> }));

const res = (status: number, body: unknown = {}) => Promise.resolve({ ok: status < 300, status, json: async () => body });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("startShopifyCheckout", () => {
  it.each([
    [200, { url: "https://shop/x" }, { kind: "redirect", url: "https://shop/x" }],
    [401, {}, { kind: "unauthenticated" }],
    [409, { code: "shopify_subscription_active" }, { kind: "subscription_active" }],
    [409, { code: "other" }, { kind: "error", status: 409 }],
    [503, {}, { kind: "error", status: 503 }],
  ])("status %s -> result", async (status, body, expected) => {
    vi.stubGlobal("fetch", vi.fn(() => res(status, body)));
    expect(await startShopifyCheckout({ requested_plan: "premium" })).toEqual(expected);
    expect(vi.mocked(fetch).mock.calls.map(([u]) => u)).toEqual(["/api/shopify/checkout"]);
  });
  it("network failure is an error, not a fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    expect(await startShopifyCheckout({})).toEqual({ kind: "error" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("PaymentRails (plan)", () => {
  const props = { lang: "en" as const, shopifyBody: { requested_plan: "premium", period: "monthly", lang: "en" }, cryptoTarget: { kind: "plan" as const, plan: "premium" as const, period: "monthly" as const }, cardPrice: "29.99 USD", cryptoPrice: "29.99 USD", disabled: false, onCryptoPaid: () => {} };
  it("card failure shows a retryable error and calls nothing but Shopify", async () => {
    vi.stubGlobal("fetch", vi.fn(() => res(503)));
    render(<PaymentRails {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay with card/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Pay with card/ })).toBeEnabled();
    expect(vi.mocked(fetch).mock.calls.map(([u]) => u)).toEqual(["/api/shopify/checkout"]);
  });
  it("active subscription gets its own message", async () => {
    vi.stubGlobal("fetch", vi.fn(() => res(409, { code: "shopify_subscription_active" })));
    render(<PaymentRails {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay with card/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already have an active subscription");
  });
  it("crypto opens the direct panel in place, no network call, only with the flag", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<PaymentRails {...props} />);
    expect(screen.queryByRole("button", { name: /Pay with crypto/ })).toBeNull();
    cleanup();
    vi.stubEnv("NEXT_PUBLIC_SHOPIFY_CRYPTO_ENABLED", "true");
    render(<PaymentRails {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay with crypto/ }));
    expect(screen.getByText("crypto-panel")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
