// #CLASSIC-PLANS-1014 — la pagina piani a flag acceso: due piani, una CTA
// primaria, e gli stati per chi è già su Free / Base / Pro / in verifica.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClassicPlans, type ClassicPlansProfile } from "./ClassicPlans";

function mount(profile: ClassicPlansProfile, lang = "en") {
  const onPaymentSubmit = vi.fn();
  const onActivateFree = vi.fn();
  const onOpenDesk = vi.fn();
  render(
    <ClassicPlans profile={profile} lang={lang} onPaymentSubmit={onPaymentSubmit} onActivateFree={onActivateFree} onOpenDesk={onOpenDesk} footnote="18+ · Not advice" />,
  );
  return { onPaymentSubmit, onActivateFree, onOpenDesk };
}

describe("ClassicPlans", () => {
  it("anonymous: one message, Pro price with period, annual price, Pro CTA → premium, Free CTA → free", () => {
    const h = mount(null);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toMatch(/Free reads three per sport a day\. Pro reads the whole board\./);
    expect(screen.getByText("$29.99")).toBeTruthy();
    expect(screen.getByText("/ month")).toBeTruthy();
    expect(screen.getByText(/Or \$329\.99 a year: 11 months paid, one free/)).toBeTruthy();
    // nessuna terza colonna: Base non si vende più da qui
    expect(screen.queryByText(/BetRedge Base/)).toBeNull();
    expect(screen.queryByText(/\$14\.99/)).toBeNull();
    const pro = screen.getByRole("button", { name: /Start with Pro · \$29\.99 \/ month/ });
    fireEvent.click(pro);
    expect(h.onPaymentSubmit).toHaveBeenCalledWith("premium");
    fireEvent.click(screen.getByRole("button", { name: "Start free" }));
    expect(h.onActivateFree).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Account and payment at the next step.")).toBeTruthy();
    // rinnovo, disdetta e crypto 30 giorni vicino alla CTA
    expect(screen.getByText(/renews every month .* until you cancel it, any day, from your account/)).toBeTruthy();
    expect(screen.getByText(/Crypto: one payment, 30 days, no renewal/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Open today’s board first/ }));
    expect(h.onOpenDesk).toHaveBeenCalledTimes(1);
  });

  it("free user: Pro CTA says Activate, Free CTA is disabled and says it's active", () => {
    mount({ plan: "free" });
    expect(screen.getByRole("button", { name: /Activate Pro/ })).toBeTruthy();
    const free = screen.getByRole("button", { name: "Free is active" }) as HTMLButtonElement;
    expect(free.disabled).toBe(true);
    expect(screen.queryByText("Account and payment at the next step.")).toBeNull();
  });

  it("base user: named, with the 7 per sport they have, and an upgrade CTA; no Free CTA", () => {
    const h = mount({ plan: "base" });
    expect(screen.getByText(/You’re on Base: up to 7 per sport a day/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Upgrade to Pro/ }));
    expect(h.onPaymentSubmit).toHaveBeenCalledWith("premium");
    expect(screen.queryByRole("button", { name: /Start free|Free is active/ })).toBeNull();
    expect(screen.getByText("Already in your plan.")).toBeTruthy();
  });

  it("pro user: no purchase CTA, status with the access date, nothing to buy", () => {
    mount({ plan: "premium", planExpiresAt: "2026-11-13T10:00:00.000Z" }, "it");
    expect(screen.queryByRole("button", { name: /Pro/ })).toBeNull();
    const status = screen.getByRole("status");
    expect(status.textContent).toMatch(/Pro è attivo su questo account\./);
    expect(status.textContent).toMatch(/Accesso fino al 13 novembre 2026\./);
    expect(screen.getByText("Già nel tuo piano.")).toBeTruthy();
  });

  it("pending payment: the Pro CTA is disabled and says the payment is under review", () => {
    mount({ plan: "pending_payment" });
    const b = screen.getByRole("button", { name: /Payment under review/ }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
  });

  it("promo slot renders what the desk passes (the launch banner, when its env is on)", () => {
    render(<ClassicPlans profile={null} lang="en" onPaymentSubmit={() => {}} onActivateFree={() => {}} onOpenDesk={() => {}} footnote="x" promo={<div data-testid="promo" />} />);
    expect(screen.getByTestId("promo")).toBeTruthy();
  });
});
