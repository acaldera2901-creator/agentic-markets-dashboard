import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaywallProvider, usePaywall } from "./PaywallProvider";

function Probe({ reason }: { reason?: string }) {
  const { openUpgrade } = usePaywall();
  return (
    <button onClick={() => openUpgrade(reason)}>apri upgrade</button>
  );
}

function NoProvider() {
  usePaywall();
  return null;
}

describe("PaywallProvider", () => {
  it("non mostra nessun dialog finché openUpgrade non viene chiamato", () => {
    render(
      <PaywallProvider>
        <Probe />
      </PaywallProvider>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("openUpgrade monta un dialog (UpgradeSheet)", async () => {
    const user = userEvent.setup();
    render(
      <PaywallProvider>
        <Probe reason="test-reason" />
      </PaywallProvider>
    );
    await user.click(screen.getByRole("button", { name: /apri upgrade/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("passa il reason all'UpgradeSheet montato", async () => {
    const user = userEvent.setup();
    render(
      <PaywallProvider>
        <Probe reason="test-reason" />
      </PaywallProvider>
    );
    await user.click(screen.getByRole("button", { name: /apri upgrade/i }));
    expect(screen.getByText(/test-reason/i)).toBeInTheDocument();
  });

  it("usePaywall fuori da PaywallProvider lancia un errore", () => {
    // Silenzia il log di errore atteso di React per il throw in render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<NoProvider />)).toThrow(/usePaywall/);
    spy.mockRestore();
  });
});
