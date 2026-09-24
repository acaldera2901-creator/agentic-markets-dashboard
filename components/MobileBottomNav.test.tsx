import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileBottomNav } from "./MobileBottomNav";

describe("MobileBottomNav", () => {
  it("rende le 5 destinazioni con gli href giusti", () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/predictions");
    expect(screen.getByRole("link", { name: /live/i })).toHaveAttribute("href", "/predictions?view=live");
    expect(screen.getByRole("link", { name: /watchlist/i })).toHaveAttribute("href", "/predictions?view=watchlist");
    expect(screen.getByRole("link", { name: /tools/i })).toHaveAttribute("href", "/tools");
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("href", "/plans");
  });

  it("marca solo la voce `active` con aria-current", () => {
    render(<MobileBottomNav active="tools" />);
    expect(screen.getByRole("link", { name: /tools/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /home/i })).not.toHaveAttribute("aria-current");
  });

  it("nessuna voce attiva quando `active` è omesso (es. /how-it-works)", () => {
    render(<MobileBottomNav />);
    for (const name of [/home/i, /live/i, /watchlist/i, /tools/i, /profile/i]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-current");
    }
  });

  it("cade su EN se la lingua non è fra le 5 gestite", () => {
    // @ts-expect-error — test deliberato di un valore fuori dall'union
    render(<MobileBottomNav lang="de" />);
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("etichette in italiano quando lang=it", () => {
    render(<MobileBottomNav lang="it" />);
    expect(screen.getByText("Strumenti")).toBeInTheDocument();
    expect(screen.getByText("Profilo")).toBeInTheDocument();
  });
});
