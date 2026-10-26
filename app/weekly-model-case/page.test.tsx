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
    expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
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
    expect(await screen.findByRole("button", { name: "Pay by card" })).toBeTruthy();
    expect(screen.getByText("$8.00")).toBeTruthy();
    expect(screen.getByText("Recorded kickoff times")).toBeTruthy();
    expect(screen.queryByText("Available match analysis")).toBeNull();
    expect(screen.queryByText("80%")).toBeNull();
  });
  it("does not offer checkout for closed or incomplete cases", async () => {
    for (const state of [{ closed: true }, { purchasable: false }]) {
      mockData({ ...base, ...state }); render(<Page />);
      await screen.findByText("A vs B");
      expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
      cleanup();
    }
  });
  it("does not invent a price if the API omits it", async () => {
    mockData({ ...base, price_usd: undefined }); render(<Page />);
    await screen.findByText("A vs B");
    expect(screen.queryByText("$12.99")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
  });
  it("renders unlocked selection and independence assumption without checkout", async () => {
    mockData({ ...base, unlocked: true, combined_prob: .512, selections: [{ label: "A vs B", sport: "football", market: "Home", prob: .8 }] }); render(<Page />);
    expect(await screen.findByText("Home")).toBeTruthy();
    expect(screen.getByText(/assuming independent outcomes/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
  });
  it("shows recorded historical outcomes including unresolved weeks", async () => {
    mockData({ enabled: true, available: false }, { enabled: true, weeks: [{ week_start: "2026-10-12", combined_prob: .4, outcome: "live", legs: [{ label: "Past A vs B", market: "Away", status: "upcoming" }] }] });
    render(<Page />);
    expect(await screen.findByText(/Past A vs B/)).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
  });
  it("prevents duplicate checkout and restores controls on checkout failure", async () => {
    let finish: ((value: unknown) => void) | undefined;
    const pending = new Promise(resolve => { finish = resolve; });
    vi.stubGlobal("fetch", vi.fn((url: string) => url === "/api/shopify/checkout" ? pending : response(url === "/api/weekly-pick/checkout" ? {} : url.endsWith("/history") ? { enabled: true, weeks: [] } : base, url !== "/api/weekly-pick/checkout")));
    render(<Page />);
    const button = await screen.findByRole("button", { name: "Pay by card" });
    fireEvent.click(button); fireEvent.click(button);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/shopify/checkout")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Please wait…" })).toBeDisabled();
    finish?.({ ok: false, status: 503 });
    expect(await screen.findByText("Couldn't start the payment. Please try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pay by card" })).toBeEnabled();
  });

  it("labels legacy cases as unverified and suppresses purchase", async () => {
    mockData({ ...base, integrity: "legacy_unverified", purchasable: false }); render(<Page />);
    expect(await screen.findByText(/Legacy case: recorded probabilities and analysis are unverified/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
  });

  it.each([['unresolved', 'Unresolved'], ['void', 'Void']])("renders %s current and historical cases without Live or Lost labels", async (outcome, label) => {
    const leg = { label: "Past C vs D", sport: "football", market: "Home", prob: .8, status: outcome };
    mockData({ ...base, unlocked: true, outcome, closed: true, selections: [{ ...leg, label: "Current C vs D" }] }, { enabled: true, weeks: [{ week_start: "2026-10-12", combined_prob: .4, outcome, legs: [leg] }] });
    render(<Page />);
    await screen.findByText("Current C vs D");
    expect(screen.getAllByText(label)).toHaveLength(4);
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.queryByText("Didn't land")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
  });

});
