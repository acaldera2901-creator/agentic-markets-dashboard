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
      expect(a.getAttribute("target")).toBe("_blank");
    }
  });

  // #PARTNERS-NO-FEATURED: nessuno sportsbook in evidenza sopra gli altri.
  it("renders no featured card and no 'Featured' label", () => {
    const { container } = render(<PartnersShowcase lang="en" />);
    expect(container.querySelectorAll(".partner-card-featured").length).toBe(0);
    expect(screen.queryByText("Featured")).toBeNull();
    // i 3 sportsbook stanno nella stessa griglia, FortunePlay incluso
    expect(container.querySelectorAll(".partners-grid").length).toBe(2);
  });

  it("shows the localized title in Italian", () => {
    render(<PartnersShowcase lang="it" />);
    expect(screen.getByText("I nostri partner")).toBeTruthy();
  });
});
