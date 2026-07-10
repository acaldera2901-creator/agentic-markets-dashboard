import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("rende le 3 destinazioni", () => {
    render(<BottomNav active="oggi" />);
    expect(screen.getByText("Oggi")).toBeInTheDocument();
    expect(screen.getByText("Risultati")).toBeInTheDocument();
    expect(screen.getByText("Profilo")).toBeInTheDocument();
  });
  it("marca la voce attiva con aria-current", () => {
    render(<BottomNav active="risultati" />);
    expect(screen.getByRole("link", { name: /risultati/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /oggi/i })).not.toHaveAttribute("aria-current");
  });
});
