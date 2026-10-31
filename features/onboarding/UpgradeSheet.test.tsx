import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpgradeSheet } from "./UpgradeSheet";
import { planPriceCopy } from "@/lib/commercial-plan";

const premiumPrice = planPriceCopy("premium", "it"); // "$29.99/mese"

const FORBIDDEN_WORDS = [/vincita/i, /vincite/i, /garantit/i, /battiamo il mercato/i];

describe("UpgradeSheet", () => {
  it("non rende nulla se chiuso", () => {
    const { container } = render(
      <UpgradeSheet open={false} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // #RETIRE-BASE-1031: un solo piano pagato in vendita, Pro. Base non compare.
  it("mostra il prezzo reale di Pro importato da commercial-plan, e niente Base", () => {
    render(<UpgradeSheet open onClose={() => {}} />);
    expect(screen.getByText(premiumPrice)).toBeInTheDocument();
    expect(screen.queryByText(/BetRedge Base|14\.99/)).toBeNull();
  });

  it("mostra la CTA di Pro che punta al checkout esistente /plans", () => {
    render(<UpgradeSheet open onClose={() => {}} />);
    const links = screen.getAllByRole("link", { name: /passa a|scegli|sblocca/i });
    expect(links).toHaveLength(1);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/plans");
    }
  });

  it("mostra il reason quando fornito", () => {
    render(<UpgradeSheet open onClose={() => {}} reason="pick bloccato" />);
    expect(screen.getByText(/pick bloccato/i)).toBeInTheDocument();
  });

  it("il copy non contiene claim FTC-unsafe (vincita/garantito)", () => {
    render(<UpgradeSheet open onClose={() => {}} reason="pick bloccato" />);
    const text = document.body.textContent ?? "";
    for (const re of FORBIDDEN_WORDS) {
      expect(text).not.toMatch(re);
    }
  });
});
