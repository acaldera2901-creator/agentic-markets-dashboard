import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceIndicator } from "./ConfidenceIndicator";

describe("ConfidenceIndicator", () => {
  it("score alto → bucket alta, 5 segmenti accesi, parola High", () => {
    render(<ConfidenceIndicator score={0.82} />);
    const root = screen.getByRole("img", { name: /model confidence high/i });
    expect(root).toHaveAttribute("data-bucket", "alta");
    expect(root.querySelectorAll('[data-on="true"]')).toHaveLength(5);
  });
  it("score basso → 2 segmenti, Low, opzionale percentuale", () => {
    render(<ConfidenceIndicator score={35} showPercent layout="stack" />);
    const root = screen.getByRole("img", { name: /low, 35%/i });
    expect(root).toHaveAttribute("data-layout", "stack");
    expect(root.querySelectorAll('[data-on="true"]')).toHaveLength(2);
  });
});
