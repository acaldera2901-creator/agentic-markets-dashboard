import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartnersShowcase } from "@/components/PartnersShowcase";

describe("PartnersShowcase", () => {
  it("renders every partner name and an affiliate link with the safe rel", () => {
    render(<PartnersShowcase lang="en" />);
    expect(screen.getByText("FortunePlay")).toBeTruthy();
    expect(screen.getByText("YBets")).toBeTruthy();
    expect(screen.getByText("BetScore")).toBeTruthy();
    expect(screen.getByText("FeliceBet")).toBeTruthy();
    expect(screen.getByText("VeloBet")).toBeTruthy();
    const links = screen.getAllByRole("link").filter((a) =>
      (a as HTMLAnchorElement).href.startsWith("https://"));
    expect(links.length).toBeGreaterThanOrEqual(6);
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
    // gli sportsbook stanno tutti nella stessa griglia, FortunePlay incluso
    expect(container.querySelectorAll(".partners-grid").length).toBe(2);
  });

  // #PARTNERS-VELOBET-CASEA: Casea ha un link solo per NO/CH/FI → senza country
  // (o in una geo non coperta) la sua card non deve esistere.
  it("mostra Casea solo quando il country ce l'ha un link, mai senza country", () => {
    const { container: senza } = render(<PartnersShowcase lang="en" />);
    expect(screen.queryByText("Casea")).toBeNull();
    const casinoSenza = senza.querySelectorAll(".partners-grid")[1].querySelectorAll(".partner-card").length;

    const { container: conNo } = render(<PartnersShowcase lang="en" country="NO" />);
    expect(screen.getByText("Casea")).toBeTruthy();
    const caseaLink = Array.from(conNo.querySelectorAll("a.partner-card")).find(
      (a) => a.textContent?.includes("Casea")) as HTMLAnchorElement | undefined;
    expect(caseaLink?.href).toBe("https://csa.lynmonkel.com/?mid=383451_2222324");
    // una card in più nella sezione Casino, e non altrove
    expect(conNo.querySelectorAll(".partners-grid")[1].querySelectorAll(".partner-card").length)
      .toBe(casinoSenza + 1);
  });

  it("non mostra Casea in una geo senza link dedicato", () => {
    render(<PartnersShowcase lang="en" country="AT" />);
    expect(screen.queryByText("Casea")).toBeNull();
  });

  it("shows the localized title in Italian", () => {
    render(<PartnersShowcase lang="it" />);
    expect(screen.getByText("I nostri partner")).toBeTruthy();
  });
});
