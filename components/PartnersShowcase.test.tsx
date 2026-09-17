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
    expect(screen.getByText("GG.BET")).toBeTruthy();
    const links = screen.getAllByRole("link").filter((a) =>
      (a as HTMLAnchorElement).href.startsWith("https://"));
    expect(links.length).toBeGreaterThanOrEqual(7);
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

  // #GEO-PARTNERS-ALWAYS-0917 / #CASEA-ALWAYS-0917 (17/09, Andrea): la vetrina non
  // nasconde più nessuno. La griglia Casino ha lo stesso numero di card con o senza
  // country; a cambiare è SOLO l'href di Casea, l'unica con un mid per paese.
  it("ha le stesse card in ogni geo: cambia solo il link di Casea", () => {
    const hrefCasea = (c: HTMLElement) =>
      (Array.from(c.querySelectorAll("a.partner-card")).find(
        (a) => a.textContent?.includes("Casea")) as HTMLAnchorElement | undefined)?.href;
    const casinoCards = (c: HTMLElement) =>
      c.querySelectorAll(".partners-grid")[1].querySelectorAll(".partner-card").length;

    const { container: senza } = render(<PartnersShowcase lang="en" />);
    // fuori dai tre paesi di Casea: la card c'è, col fallback svizzero dichiarato
    expect(hrefCasea(senza)).toBe("https://csa.lynmonkel.com/?mid=383451_2222327");

    const { container: conNo } = render(<PartnersShowcase lang="en" country="NO" />);
    expect(hrefCasea(conNo)).toBe("https://csa.lynmonkel.com/?mid=383451_2222324");
    expect(casinoCards(conNo)).toBe(casinoCards(senza));
  });

  // Il caso della richiesta di Andrea, per nome: una geo mai coperta dal deal N1
  // vede i quattro ex NO+DACH e Casea come tutte le altre.
  it("in una geo non privilegiata (IT) ci sono i quattro ex NO+DACH e Casea", () => {
    render(<PartnersShowcase lang="en" country="IT" />);
    for (const n of ["RollXO", "Hollywin", "N1 Bet", "Stonevegas", "Casea"]) {
      expect(screen.getByText(n), `${n} manca in vetrina (IT)`).toBeTruthy();
    }
  });

  it("shows the localized title in Italian", () => {
    render(<PartnersShowcase lang="it" />);
    expect(screen.getByText("I nostri partner")).toBeTruthy();
  });
});
