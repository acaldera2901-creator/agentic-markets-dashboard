import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpgradeSheet } from "./UpgradeSheet";
import { planPriceCopy } from "@/lib/commercial-plan";

const basePrice = planPriceCopy("base", "it"); // "$14.99/mese"
const premiumPrice = planPriceCopy("premium", "it"); // "$29.99/mese"

const FORBIDDEN_WORDS = [/vincita/i, /vincite/i, /garantit/i, /battiamo il mercato/i];

describe("UpgradeSheet", () => {
  it("non rende nulla se chiuso", () => {
    const { container } = render(
      <UpgradeSheet open={false} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra i due prezzi reali importati da commercial-plan", () => {
    render(<UpgradeSheet open onClose={() => {}} />);
    expect(screen.getByText(basePrice)).toBeInTheDocument();
    expect(screen.getByText(premiumPrice)).toBeInTheDocument();
  });

  it("mostra una CTA per piano che punta al checkout esistente /app", () => {
    render(<UpgradeSheet open onClose={() => {}} />);
    const links = screen.getAllByRole("link", { name: /passa a|scegli|sblocca/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/app");
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
