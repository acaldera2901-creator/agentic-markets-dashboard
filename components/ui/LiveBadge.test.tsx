import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveBadge } from "./LiveBadge";

describe("LiveBadge", () => {
  it("rende LIVE con il minuto e il primo tipografico", () => {
    render(<LiveBadge minute={63} />);
    expect(screen.getByRole("status")).toHaveTextContent("Live");
    expect(screen.getByText("63′")).toBeInTheDocument();
  });
  it("senza minuto rende solo la parola", () => {
    render(<LiveBadge />);
    expect(screen.getByRole("status").textContent).toBe("Live");
  });
});
