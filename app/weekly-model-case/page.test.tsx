import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
vi.mock("@/components/classic/ClassicChrome", () => ({ default: () => null }));
vi.mock("@/app/components/sport-glyphs", () => ({ SportGlyphSprite: () => null }));
vi.mock("@/app/components/sport-icon", () => ({ SportIcon: () => null }));
vi.mock("@/app/components/menu-icon", () => ({ MenuIcon: () => null }));
vi.mock("@/components/PredictionDetailModal", () => ({ PredictionDetailModal: () => null }));
vi.mock("@/components/CryptoDirectPanel", () => ({ CryptoDirectPanel: () => null }));
const response = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 503, json: async () => body });
const base = { enabled: true, available: true, unlocked: false, price_usd: 8, legs: 3, legs_remaining: 2, selections: [{ label: "A vs B", sport: "football", market: null, prob: null }] };
function mockData(data: unknown, history: unknown = { enabled: true, weeks: [] }) {
  vi.stubGlobal("fetch", vi.fn((url: string) => response(url.endsWith("/history") ? history : data)));
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Weekly Model Case states", () => {
  it("shows loading rather than an empty history before requests resolve", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Page />);
    expect(screen.getAllByText("Loading…")).toHaveLength(2);
    expect(screen.queryByText(/first week closes/)).toBeNull();
  });
  it("distinguishes disabled from a missing current case", async () => {
    mockData({ enabled: false }, { enabled: false }); render(<Page />);
    expect(await screen.findByText("Weekly Model Case is currently unavailable.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unlock Weekly Model Case" })).toBeNull();
  });
  it("shows missing case without a promised publication date", async () => {
    mockData({ enabled: true, available: false }); render(<Page />);
    expect(await screen.findByText("No Weekly Model Case is published for this week yet.")).toBeTruthy();
  });
  it("distinguishes failed history and offers retry", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => response(url.endsWith("/history") ? {} : base, !url.endsWith("/history")))); render(<Page />);
    expect(await screen.findByText("Couldn't load previous weeks.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
  });
  it("shows locked price and checkout, but no protected pick", async () => {
    mockData(base); render(<Page />);
    expect(await screen.findByRole("button", { name: "Unlock Weekly Model Case" })).toBeTruthy();
    expect(screen.getByText("$8.00")).toBeTruthy();
    expect(screen.getByText("Recorded kickoff times")).toBeTruthy();
    expect(screen.queryByText("Available match analysis")).toBeNull();
    expect(screen.queryByText("80%")).toBeNull();
  });
  it("does not offer checkout for closed or incomplete cases", async () => {
    for (const state of [{ closed: true }, { purchasable: false }]) {
      mockData({ ...base, ...state }); render(<Page />);
      await screen.findByText("A vs B");
      expect(screen.queryByRole("button", { name: "Unlock Weekly Model Case" })).toBeNull();
      cleanup();
    }
  });
  it("does not invent a price if the API omits it", async () => {
    mockData({ ...base, price_usd: undefined }); render(<Page />);
    await screen.findByText("A vs B");
    expect(screen.queryByText("$12.99")).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlock Weekly Model Case" })).toBeNull();
  });
  it("renders unlocked selection and independence assumption without checkout", async () => {
    mockData({ ...base, unlocked: true, combined_prob: .512, selections: [{ label: "A vs B", sport: "football", market: "Home", prob: .8 }] }); render(<Page />);
    expect(await screen.findByText("Home")).toBeTruthy();
    expect(screen.getByText(/assuming independent outcomes/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unlock Weekly Model Case" })).toBeNull();
  });
  it("shows recorded historical outcomes including unresolved weeks", async () => {
    mockData({ enabled: true, available: false }, { enabled: true, weeks: [{ week_start: "2026-10-12", combined_prob: .4, outcome: "live", legs: [{ label: "Past A vs B", market: "Away", status: "upcoming" }] }] });
    render(<Page />);
    expect(await screen.findByText(/Past A vs B/)).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("12 Oct")).toBeTruthy();
  });
  it("opens the shared checkout modal; card goes to Shopify only and a failure never falls back to PayGate", async () => {
    let finish: ((value: unknown) => void) | undefined;
    const pending = new Promise(resolve => { finish = resolve; });
    vi.stubGlobal("fetch", vi.fn((url: string) => url === "/api/shopify/checkout" ? pending : response(url.endsWith("/history") ? { enabled: true, weeks: [] } : base)));
    render(<Page />);
    fireEvent.click(await screen.findByRole("button", { name: "Unlock Weekly Model Case" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    const card = screen.getByRole("button", { name: /Pay with card · \$8\.00/ });
    expect(card).toBeDisabled(); // withdrawal consent first
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(card); fireEvent.click(card);
    const calls = () => vi.mocked(fetch).mock.calls.map(([url]) => url);
    expect(calls().filter(u => u === "/api/shopify/checkout")).toHaveLength(1);
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls.find(([u]) => u === "/api/shopify/checkout")![1] as RequestInit).body))).toEqual({ requested_plan: "weekly", lang: "en" });
    expect(screen.getByRole("button", { name: "Redirecting to secure payment…" })).toBeDisabled();
    finish?.({ ok: false, status: 503, json: async () => ({}) });
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't open the card payment");
    expect(screen.getByRole("button", { name: /Pay with card/ })).toBeEnabled();
    expect(calls().some(u => /paygate|weekly-pick\/checkout/.test(String(u)))).toBe(false);
  });

  it("shows the crypto rail only when the direct rail flag is on, and it never opens a hosted page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOPIFY_CRYPTO_ENABLED", "");
    mockData(base); render(<Page />);
    fireEvent.click(await screen.findByRole("button", { name: "Unlock Weekly Model Case" }));
    expect(screen.queryByRole("button", { name: /Pay with crypto/ })).toBeNull();
    cleanup();
    vi.stubEnv("NEXT_PUBLIC_SHOPIFY_CRYPTO_ENABLED", "true");
    mockData(base); render(<Page />);
    fireEvent.click(await screen.findByRole("button", { name: "Unlock Weekly Model Case" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Pay with crypto · \$8\.00/ }));
    expect(vi.mocked(fetch).mock.calls.map(([u]) => u).some(u => /paygate|weekly-pick\/checkout|shopify/.test(String(u)))).toBe(false);
    vi.unstubAllEnvs();
  });

  it("labels legacy cases as unverified and suppresses purchase", async () => {
    mockData({ ...base, integrity: "legacy_unverified", purchasable: false }); render(<Page />);
    expect(await screen.findByText(/Legacy case: recorded probabilities and analysis are unverified/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unlock Weekly Model Case" })).toBeNull();
  });

  it.each([['unresolved', 'Unresolved'], ['void', 'Void']])("renders %s current and historical cases without Live or Lost labels", async (outcome, label) => {
    const leg = { label: "Past C vs D", sport: "football", market: "Home", prob: .8, status: outcome };
    mockData({ ...base, unlocked: true, outcome, closed: true, selections: [{ ...leg, label: "Current C vs D" }] }, { enabled: true, weeks: [{ week_start: "2026-10-12", combined_prob: .4, outcome, legs: [leg] }] });
    render(<Page />);
    await screen.findByText("Current C vs D");
    expect(screen.getAllByText(label)).toHaveLength(4);
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.queryByText("Didn't land")).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlock Weekly Model Case" })).toBeNull();
  });

});
