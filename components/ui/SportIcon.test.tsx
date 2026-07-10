import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SportIcon } from "./SportIcon";

describe("SportIcon", () => {
  it("rende un <svg> per football", () => {
    const { container } = render(<SportIcon sport="football" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
  it("applica size e className", () => {
    const { container } = render(<SportIcon sport="tennis" size={24} className="x" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveClass("x");
  });
  it("è decorativa (aria-hidden)", () => {
    const { container } = render(<SportIcon sport="football" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
