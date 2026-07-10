import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("rende il contenuto", () => {
    render(<Chip variant="high">Alta</Chip>);
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });
  it("espone la variante come data-attr", () => {
    render(<Chip variant="pro">PRO</Chip>);
    expect(screen.getByText("PRO")).toHaveAttribute("data-variant", "pro");
  });
});
