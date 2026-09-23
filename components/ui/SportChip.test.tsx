import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SportChip, sportLabel } from "./SportChip";

describe("SportChip", () => {
  it("rende la label dello sport con data-kind sport", () => {
    render(<SportChip sport="football" />);
    expect(screen.getByText("Football")).toHaveAttribute("data-kind", "sport");
  });
  it("sport sconosciuto → capitalizzato", () => {
    expect(sportLabel("padel")).toBe("Padel");
    expect(sportLabel("worldcup")).toBe("World Cup");
  });
});
