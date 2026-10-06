// F3 · la board renderizzata: ordine di lettura, gap con segno, partner solo
// da feed e solo con link veri, tennis onesto, un solo bottone primario.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { V3BoardResponse, V3BoardTennisMatch, V3BoardTennisSide, V3BookPrice } from "@/lib/v3c/contracts";
import { BOARD_PAGE_ROWS, Board } from "./Board";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/track-event", () => ({ trackEvent: vi.fn() }));

const NOW = "2026-10-10T12:00:00.000Z";
const book = (price: number, bookmaker = "fortuneplay", name = "FortunePlay"): V3BookPrice => ({
  bookmaker,
  name,
  price,
  captured_at: NOW,
  source: "live_feed",
  url: `https://www.${bookmaker}.example/m?stag=185731`,
});

function tennisMatch(over: { gap?: boolean; kind?: "model" | "model_tempered" | "market_tempered" } = {}): V3BoardTennisMatch {
  const kind = over.kind ?? "model_tempered";
  const side = (s: "p1" | "p2", player: string, est: number, mkt: number, sealed: number | null, atSeal: number | null): V3BoardTennisSide => ({
    side: s,
    player,
    market_price: 1 / mkt,
    market_p: mkt,
    model_p: kind === "market_tempered" ? null : est + 0.02,
    estimate_p: est,
    sealed_p: sealed,
    market_p_at_seal: atSeal,
    gap_pp: sealed != null && atSeal != null ? Math.round((sealed - atSeal) * 10_000) / 100 : null,
    book_prices: [],
    best_price: null,
  });
  return {
    id: "tennis:t1",
    sport: "tennis",
    tournament: "ATP Shanghai",
    kickoff: "2026-10-10T16:00:00.000Z",
    player1: "Jannik Sinner",
    player2: "Ben Shelton",
    market: "ML",
    model_version: kind === "market_tempered" ? "partner-market-v1" : "elo_surface_v4",
    probability_kind: kind,
    is_our_model: kind !== "market_tempered",
    temperature: 1.68,
    margin_removed: 0.05,
    market_source: { bookmaker: "fortuneplay", as_of: "2026-10-10T09:00:00.000Z" },
    model_as_of: null,
    estimate_as_of: "2026-10-10T09:00:00.000Z",
    sealed_at: over.gap ? "2026-10-10T09:02:00.000Z" : null,
    focus: "p1",
    surfaced_pick: "p1",
    gap_market: over.gap ? { bookmaker: "fortuneplay", captured_at: "2026-10-10T08:01:00.000Z" } : null,
    gap_null_reason: over.gap ? null : "not sealed yet",
    sides: over.gap
      ? [side("p1", "Jannik Sinner", 0.71, 0.66, 0.71, 0.66), side("p2", "Ben Shelton", 0.29, 0.34, 0.29, 0.34)]
      : [side("p1", "Jannik Sinner", 0.71, 0.66, null, null), side("p2", "Ben Shelton", 0.29, 0.34, null, null)],
  };
}

const BOARD: V3BoardResponse = {
  contract: "v3.board.2",
  generated_at: NOW,
  window_days: 10,
  matches: [
    {
      id: "m1",
      sport: "football",
      league: "ITA",
      competition: "Serie A",
      kickoff: "2026-10-10T15:00:00.000Z",
      home: "Genoa",
      away: "Fiorentina",
      market: "1X2",
      margin_removed: 0.063,
      blend: { model: 0.3, market: 0.7 },
      estimate_as_of: "2026-10-10T11:40:00.000Z",
      sealed_at: "2026-10-09T09:02:00.000Z",
      focus: "home",
      outcomes: [
        { outcome: "home", market_price: 2.15, market_p: 0.44, model_p: 0.57, estimate_p: 0.48, edge_pp: 4, book_prices: [book(2.15), book(2.1, "ybets", "YBets")], best_price: book(2.15) },
        { outcome: "draw", market_price: 3.2, market_p: 0.29, model_p: 0.26, estimate_p: 0.28, edge_pp: -1, book_prices: [], best_price: null },
        { outcome: "away", market_price: 3.5, market_p: 0.27, model_p: 0.17, estimate_p: 0.24, edge_pp: -3, book_prices: [], best_price: null },
      ],
    },
  ],
  tennis: [tennisMatch()],
  coverage: { tennis: { matches: 1, by_kind: { model: 0, model_tempered: 1, market_tempered: 0 }, with_market: 1, with_model_p: 1, sealed: 0, with_gap: 0, with_book_price: {} }, matches: 1, with_market: 1, sealed: 1, with_book_price: {}, excluded: [], book_price_max_age_min: 150, books_from_history: [] },
  notes: [],
};

const props = { board: BOARD, surface: "predictions" as const, partners: true, nowIso: NOW, yesterday: null, frozenNow: true, initialFilters: { day: "all" } };

describe("Board v3c (F3)", () => {
  it("riga calcio: prezzo, mercato→stima sulla scala, gap col meno tipografico, chip del book con link affiliato vero", () => {
    const { container } = render(<Board {...props} />);
    const row = container.querySelector('.v3c-row[data-sport="football"]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(within(row).getByText("2.15", { selector: ".v3c-r-price" })).toBeInTheDocument();
    expect(within(row).getByRole("img", { name: /Market 44 percent, estimate 48 percent, gap \+4\.0 points/ })).toBeInTheDocument();
    expect(row.querySelector(".v3c-r-gap")?.textContent).toContain("+4.0");
    expect(row.textContent).toContain("Fiorentina −3.0"); // gli altri esiti, segno U+2212
    const chip = row.querySelector(".v3c-r-book a") as HTMLAnchorElement;
    expect(chip.href).toBe("https://www.fortuneplay.example/m?stag=185731");
    expect(chip.rel).toContain("sponsored");
    expect(chip.target).toBe("_blank");
    // l'ordine di lettura: il chip partner viene DOPO il gap
    const order = [...row.children].map((c) => c.className);
    expect(order.findIndex((c) => c.includes("v3c-r-book"))).toBeGreaterThan(order.findIndex((c) => c.includes("v3c-r-gap")));
  });

  it("il pannello: tre esiti, blend dichiarato, sigillo spiegato, UN solo bottone primario dopo i numeri", () => {
    const { container } = render(<Board {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Genoa – Fiorentina/ }));
    const pn = container.querySelector(".v3c-pn") as HTMLElement;
    expect(within(pn).getAllByRole("row")).toHaveLength(4); // intestazione + 3 esiti
    expect(pn.textContent).toContain("estimate = 70% market + 30% model");
    expect(pn.textContent).toContain("This match entered the public ledger on 9 Oct, 09:02 UTC, before kick-off");
    expect(container.querySelectorAll(".v3c-btn-cta")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Best price on Genoa: 2\.15 at FortunePlay/ })).toHaveAttribute("href", "https://www.fortuneplay.example/m?stag=185731");
  });

  it("tennis senza gap nel contratto: stima del modello, nessun punto mercato, «market comparison coming»", () => {
    const { container } = render(<Board {...props} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-gap")?.textContent).toBe("market comparison coming");
    expect(row.querySelector(".v3c-rs-m")).toBeNull(); // nessun punto mercato: niente gap implicito
    expect(row.querySelector(".v3c-rs-e")?.textContent).toBe("71%");
    fireEvent.click(screen.getByRole("button", { name: /Jannik Sinner – Ben Shelton/ }));
    const pn = container.querySelector('.v3c-row[data-sport="tennis"] .v3c-pn') as HTMLElement;
    expect(pn.textContent).toContain("66%"); // il mercato c'è, nel pannello, come dato
    expect(pn.textContent).toContain("Not sealed yet");
    expect(pn.textContent).toContain("raw Elo 73% (not sealed)");
  });

  it("tennis con gap al sigillo: la scala mostra sigillata vs mercato al sigillo, il gap coincide", () => {
    const { container } = render(<Board {...props} board={{ ...BOARD, tennis: [tennisMatch({ gap: true })] }} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-gap")?.textContent).toContain("+5.0 pp");
    expect(row.querySelector(".v3c-rs-m")?.textContent).toBe("66%");
    expect(row.querySelector(".v3c-rs-e")?.textContent).toBe("71%");
  });

  it("tennis senza un nostro modello: solo prezzo di mercato", () => {
    const { container } = render(<Board {...props} board={{ ...BOARD, tennis: [tennisMatch({ kind: "market_tempered" })] }} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-gap")?.textContent).toBe("market price only");
    expect(row.querySelector(".v3c-rs-e")).toBeNull();
  });

  it("paesi bloccati: nessun link ai book", () => {
    const { container } = render(<Board {...props} partners={false} />);
    expect(container.querySelectorAll("a[data-partner]")).toHaveLength(0);
  });

  it("filtro sport e stato vuoto a cascata", () => {
    render(<Board {...props} initialFilters={{ day: "2026-10-12" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("No match for this filter.");
    expect(screen.getByText("Next up")).toBeInTheDocument();
    expect(screen.getByText(/starts in 3 h 0 min/)).toBeInTheDocument();
  });
  // live (06/10): Andrea vedeva 7 partite di calcio — /predictions apriva sul primo giorno con righe.
  it("/predictions apre su tutti i giorni, le imminenti prima, a blocchi di 60 con «Show N more»", () => {
    const base = BOARD.matches[0];
    // 130 partite su 5 giorni, in ordine sparso: la board le ordina per calcio d'inizio
    const matches = Array.from({ length: 130 }, (_, i) => ({
      ...base,
      id: `m${i}`,
      home: `Home ${i}`,
      away: `Away ${i}`,
      kickoff: new Date(Date.parse("2026-10-10T13:00:00.000Z") + ((i * 37) % 130) * 3_600_000).toISOString(),
    }));
    const { container } = render(<Board {...props} initialFilters={undefined} board={{ ...BOARD, matches, tennis: [] }} />);
    const rows = () => [...container.querySelectorAll('.v3c-row[data-sport="football"]')];
    expect(rows()).toHaveLength(BOARD_PAGE_ROWS);
    expect(screen.getByRole("button", { name: "All days" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".v3c-group").length).toBeGreaterThan(1); // più giorni, non solo il primo
    expect(rows()[0].textContent).toContain("Home 0"); // la più vicina (13:00 del 10/10) per prima
    expect(screen.getByText("60 of 130 matches")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 60 more" }));
    expect(rows()).toHaveLength(120);
    fireEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    expect(rows()).toHaveLength(130);
    expect(screen.queryByRole("button", { name: /more$/ })).toBeNull();
    // il chip sport resta su tutti i giorni e riparte dal primo blocco
    fireEvent.click(screen.getByRole("button", { name: /Football/ }));
    expect(screen.getByRole("button", { name: "All days" })).toHaveAttribute("aria-pressed", "true");
    expect(rows()).toHaveLength(BOARD_PAGE_ROWS);
  });
});
