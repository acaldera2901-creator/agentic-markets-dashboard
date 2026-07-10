import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceMeter } from "./ConfidenceMeter";

describe("ConfidenceMeter", () => {
  it("mostra l'etichetta bucket", () => {
    render(<ConfidenceMeter score={78} />);
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });
  it("mostra la percentuale solo se richiesto", () => {
    const { rerender } = render(<ConfidenceMeter score={78} />);
    expect(screen.queryByText(/78%/)).toBeNull();
    rerender(<ConfidenceMeter score={78} showPercent />);
    expect(screen.getByText(/78%/)).toBeInTheDocument();
  });
  it("accende 5 segmenti su confidenza alta", () => {
    const { container } = render(<ConfidenceMeter score={90} />);
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(5);
  });
  it("accende 2 segmenti su confidenza bassa", () => {
    const { container } = render(<ConfidenceMeter score={30} />);
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(2);
  });
  it("accende 3 segmenti su confidenza media", () => {
    const { container } = render(<ConfidenceMeter score={60} />);
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(3);
  });
});
