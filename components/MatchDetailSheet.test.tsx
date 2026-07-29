import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchDetailSheet, type MdsData } from "@/components/MatchDetailSheet";

// #BET-DROPDOWN-1: la bet-bar non impila più una CTA per book — una sola CTA
// apre il menu dei partner. Qui si verifica il comportamento del menu, non il
// layout: apertura/chiusura, link affiliati sicuri, e il gate a 0 selezioni.

const LABELS: MdsData["labels"] = {
  schedina: "La tua schedina",
  quotaComb: "quota combinata",
  quotaOne: "quota",
  touch: "tocca i mercati",
  apri: "Apri su FortunePlay",
  apriMulti: "Apri la multipla su FortunePlay",
  openBook: "Apri su {book}",
  placeBet: "Piazza la scommessa",
  disc: "disclaimer",
  side: "nota",
  selOne: "1 selezione",
  selMany: "{n} selezioni",
};

const BOOKS = [
  { name: "FortunePlay", matchUrl: "https://www.fortuneplay.com/it/sports/football/x-m-1?stag=abc" },
  { name: "YBets", matchUrl: "https://ybetspromo.io/dputempxc" },
  { name: "BetScore", matchUrl: "https://bsr.lynmonkel.com/?mid=381903_2215092" },
  { name: "FeliceBet", matchUrl: "https://go.bluewinpartners.com/visit/?bta=2961065&nci=5732" },
];

function makeData(over: Partial<MdsData> = {}): MdsData {
  return {
    league: "Serie A",
    when: "Fri 31 Jul, 13:35",
    home: "Henan",
    away: "Dalian Yingbo",
    hero: { flag: "La nostra prediction", pick: "Henan vince", read: "53% modello", confDots: 1, quotaLabel: "Quota FortunePlay", quota: "1.73", value: null },
    groups: [
      {
        key: "result",
        icon: "result",
        title: "Risultato",
        src: { kind: "fp", label: "FORTUNEPLAY" },
        chips: [{ id: "home", mkt: "1X2", sel: "Henan", prob: "53%", q: 1.73, rec: true }],
      },
    ],
    matchUrl: "https://www.fortuneplay.com/it/sports/football/x-m-1?stag=abc",
    books: BOOKS,
    labels: LABELS,
    ...over,
  };
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /Piazza la scommessa/ }));
}

describe("MatchDetailSheet — menu partner (#BET-DROPDOWN-1)", () => {
  it("mostra UNA sola CTA, non una per partner", () => {
    render(<MatchDetailSheet data={makeData()} />);
    expect(screen.getByRole("button", { name: /Piazza la scommessa/ })).toBeTruthy();
    // le vecchie CTA "Apri su {book}" non esistono più
    expect(screen.queryByText("Apri su YBets")).toBeNull();
    expect(screen.queryByText("Apri su BetScore")).toBeNull();
  });

  it("il menu è chiuso finché non lo si apre", () => {
    render(<MatchDetailSheet data={makeData()} />);
    expect(screen.queryByRole("menu")).toBeNull();
    openMenu();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("aperto, elenca tutti i partner con link affiliato sicuro", () => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const items = screen.getAllByRole("menuitem") as HTMLAnchorElement[];
    expect(items.map((a) => a.textContent?.trim())).toEqual(BOOKS.map((b) => b.name));
    for (const [i, a] of items.entries()) {
      expect(a.getAttribute("href")).toBe(BOOKS[i].matchUrl);
      expect(a.getAttribute("target")).toBe("_blank");
      const rel = a.getAttribute("rel") || "";
      for (const token of ["nofollow", "sponsored", "noopener", "noreferrer"]) {
        expect(rel).toContain(token);
      }
    }
  });

  it("Escape chiude il menu", () => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("senza selezioni la CTA è disabilitata e il menu non si apre", () => {
    // nessuna chip `rec` → schedina vuota all'apertura della scheda
    const data = makeData({
      groups: [
        {
          key: "result",
          icon: "result",
          title: "Risultato",
          src: { kind: "fp", label: "FORTUNEPLAY" },
          chips: [{ id: "home", mkt: "1X2", sel: "Henan", prob: "53%", q: 1.73 }],
        },
      ],
    });
    render(<MatchDetailSheet data={data} />);
    const cta = screen.getByRole("button", { name: /Piazza la scommessa/ }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    fireEvent.click(cta);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("svuotare la schedina col menu aperto lo chiude", () => {
    // il menu aperto è derivato da (stato aperto && legs > 0): togliendo l'unica
    // selezione sparisce senza bisogno di un effetto che insegua lo stato.
    // fireEvent.click non emette mousedown → non è il click-fuori a chiuderlo.
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(screen.getByText("Henan").closest("button") as HTMLButtonElement);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("con un solo partner resta il link diretto, senza menu", () => {
    render(<MatchDetailSheet data={makeData({ books: [BOOKS[0]] })} />);
    expect(screen.queryByRole("button", { name: /Piazza la scommessa/ })).toBeNull();
    const cta = screen.getByText(/Apri su FortunePlay/).closest("a") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe(BOOKS[0].matchUrl);
  });

  it("hideBookLinks (geo bloccata) nasconde CTA e menu", () => {
    render(<MatchDetailSheet data={makeData()} hideBookLinks />);
    expect(screen.queryByRole("button", { name: /Piazza la scommessa/ })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

// #PARTNER-CLICK-TRACK-1: senza questo evento non sappiamo quale partner rende.
describe("MatchDetailSheet — tracking del partner scelto", () => {
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
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    fireEvent.click(screen.getByText(name));
  };

  it("registra quale partner è stato scelto", () => {
    clickPartner("FeliceBet");
    const ev = calls.filter((c) => c.url === "/api/track");
    expect(ev).toHaveLength(1);
    expect(ev[0].body.event_type).toBe("partner_click");
    expect(ev[0].body.partner_id).toBe("FeliceBet");
    expect((ev[0].body.meta as Record<string, unknown>).surface).toBe("match_sheet");
  });

  it("distingue i partner fra loro", () => {
    clickPartner("YBets");
    expect(calls.at(-1)?.body.partner_id).toBe("YBets");
  });

  it("senza consenso GDPR non manda nessun session_id", () => {
    clickPartner("BetScore");
    const ev = calls.filter((c) => c.url === "/api/track");
    expect(ev).toHaveLength(1); // l'evento parte comunque, anonimo
    expect(ev[0].body.session_id).toBeUndefined();
    expect(sessionStorage.getItem("am_sid")).toBeNull(); // nessun id creato di nascosto
  });

  it("col consenso allega il session_id", () => {
    localStorage.setItem("gdpr_consent", "accepted");
    clickPartner("BetScore");
    const ev = calls.filter((c) => c.url === "/api/track");
    expect(ev).toHaveLength(1);
    expect(typeof ev[0].body.session_id).toBe("string");
  });

  it("il link resta navigabile anche se il beacon fallisce", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const link = screen.getByText("FortunePlay").closest("a") as HTMLAnchorElement;
    expect(() => fireEvent.click(link)).not.toThrow();
    expect(link.getAttribute("href")).toBe(BOOKS[0].matchUrl);
  });
});
