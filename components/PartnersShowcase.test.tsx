import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  // #PARTNER-BETWINNER-0924 — il primo partner che la vetrina deve NASCONDERE da
  // quando (17/09) non nascondeva più nessuno: 3 tracker per 9 mercati, nessun link
  // neutro, quindi fuori dalle sue geo non c'è niente da aprire. Il test presidia
  // entrambe le metà sul componente vero, non solo su `partnersFor`.
  it("BetWinner: c'è in IN col suo link, non c'è in IT né a geo ignota", () => {
    const { container: conIn } = render(<PartnersShowcase lang="en" country="IN" />);
    const card = Array.from(conIn.querySelectorAll("a.partner-card")).find(
      (a) => a.textContent?.includes("BetWinner")) as HTMLAnchorElement | undefined;
    expect(card, "BetWinner manca in vetrina (IN)").toBeTruthy();
    expect(card?.href).toBe("https://bwref-dfsm2e1i.com/3aME?p=%2Fregistration%2F");
    expect(card?.querySelector("img")?.getAttribute("src")).toContain("betwinner.svg");

    const has = (c: HTMLElement) => Array.from(c.querySelectorAll("a.partner-card"))
      .some((a) => a.textContent?.includes("BetWinner"));
    const { container: conIt } = render(<PartnersShowcase lang="en" country="IT" />);
    expect(has(conIt), "BetWinner non dovrebbe comparire in IT").toBe(false);
    const { container: senza } = render(<PartnersShowcase lang="en" />);
    expect(has(senza), "BetWinner non dovrebbe comparire a geo ignota").toBe(false);
  });

  it("i 7 mercati che condividono il tracker aprono lo stesso link", () => {
    const href = (cc: string) => {
      const { container } = render(<PartnersShowcase lang="en" country={cc} />);
      return (Array.from(container.querySelectorAll("a.partner-card")).find(
        (a) => a.textContent?.includes("BetWinner")) as HTMLAnchorElement | undefined)?.href;
    };
    const atteso = "https://bwredir.com/3aME?p=%2Fregistration%2F";
    for (const cc of ["NG", "KE", "AR", "MX", "CO", "ID", "MY"]) {
      expect(href(cc), `link sbagliato in ${cc}`).toBe(atteso);
    }
    expect(href("BR")).toBe("https://gbaodm2hp.com/3aME?p=%2Fregistration%2F");
  });

  it("shows the localized title in Italian", () => {
    render(<PartnersShowcase lang="it" />);
    expect(screen.getByText("I nostri partner")).toBeTruthy();
  });
});

// #MIS-B — la vetrina mandava gli utenti ai partner senza lasciare traccia:
// l'unico click affiliato misurato era quello della scheda partita, quindi
// "/partners non converte" e "/partners non e' misurata" erano la stessa riga
// di dashboard. Stessa forma di payload della scheda partita, cosi'
// l'aggregazione admin per partner_id continua a funzionare.
describe("PartnersShowcase — tracking del click affiliato", () => {
  let calls: Array<{ url: string; body: Record<string, unknown> }>;

  beforeEach(() => {
    calls = [];
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const clickPartner = (name: string) => {
    render(<PartnersShowcase lang="en" country="IT" />);
    const card = Array.from(document.querySelectorAll("a.partner-card")).find(
      (a) => a.textContent?.includes(name));
    fireEvent.click(card as HTMLElement);
    return calls.filter((c) => c.url === "/api/track");
  };

  it("registra quale partner e' stato scelto, dalla vetrina", () => {
    const ev = clickPartner("FortunePlay");
    expect(ev).toHaveLength(1);
    expect(ev[0].body.event_type).toBe("partner_click");
    expect(ev[0].body.partner_id).toBe("FortunePlay");
    expect((ev[0].body.meta as Record<string, unknown>).surface).toBe("partners_page");
  });

  it("distingue i partner fra loro", () => {
    expect(clickPartner("YBets")[0].body.partner_id).toBe("YBets");
  });

  it("senza consenso GDPR l'evento parte comunque, ma anonimo", () => {
    const ev = clickPartner("BetScore");
    expect(ev[0].body.session_id).toBeUndefined();
    expect(sessionStorage.getItem("am_sid")).toBeNull();
  });

  // Il vincolo del gate: gli href sono i link affiliati con i parametri delle
  // reti dentro. Il beacon non li tocca e non passa da nessun hop server-side.
  it("non cambia l'href del partner ne' lo fa passare da un nostro endpoint", () => {
    render(<PartnersShowcase lang="en" country="IT" />);
    const card = Array.from(document.querySelectorAll("a.partner-card")).find(
      (a) => a.textContent?.includes("YBets")) as HTMLAnchorElement;
    const before = card.getAttribute("href");
    fireEvent.click(card);
    expect(card.getAttribute("href")).toBe(before);
    expect(before).toMatch(/^https:\/\//);
    expect(before).not.toContain("/api/");
  });

  it("il link resta cliccabile anche se il beacon fallisce", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<PartnersShowcase lang="en" country="IT" />);
    const card = document.querySelector("a.partner-card") as HTMLElement;
    expect(() => fireEvent.click(card)).not.toThrow();
  });
});
