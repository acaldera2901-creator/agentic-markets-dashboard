import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Crest } from "./Crest";
import { crestUrl } from "@/lib/ui/crest-assets";

describe("crestUrl", () => {
  it("SP0: sconosciuto → null", () => {
    expect(crestUrl("Inter", "football")).toBeNull();
    expect(crestUrl(null, "football")).toBeNull();
  });
});

describe("Crest", () => {
  it("senza asset rende uno scudo SVG (nessun testo/monogramma)", () => {
    const { container } = render(<Crest team="Inter" sport="football" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe(""); // niente lettere dentro il crest
  });
  it("tinta deterministica: stesso nome → stesso fill", () => {
    const a = render(<Crest team="Inter" sport="football" />).container.querySelector("path")!.getAttribute("fill");
    const b = render(<Crest team="Inter" sport="football" />).container.querySelector("path")!.getAttribute("fill");
    expect(a).toBe(b);
  });
});
