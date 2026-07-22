import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartnersShowcase } from "@/components/PartnersShowcase";

describe("PartnersShowcase", () => {
  it("renders every partner name and an affiliate link with the safe rel", () => {
    render(<PartnersShowcase lang="en" />);
    expect(screen.getByText("FortunePlay")).toBeTruthy();
    expect(screen.getByText("YBets")).toBeTruthy();
    expect(screen.getByText("BetScore")).toBeTruthy();
    const links = screen.getAllByRole("link").filter((a) =>
      (a as HTMLAnchorElement).href.startsWith("https://"));
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const a of links) {
      const rel = (a as HTMLAnchorElement).getAttribute("rel") || "";
      expect(rel).toContain("nofollow");
      expect(rel).toContain("sponsored");
      expect(rel).toContain("noopener");
    }
  });

  it("shows the localized title in Italian", () => {
    render(<PartnersShowcase lang="it" />);
    expect(screen.getByText("I nostri partner")).toBeTruthy();
  });
});
