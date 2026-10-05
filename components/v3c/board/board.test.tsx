// F3 · la board renderizzata: ordine di lettura, gap con segno, partner solo
// da feed e solo con link veri, tennis onesto, un solo bottone primario.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { V3BoardResponse, V3BookPrice } from "@/lib/v3c/contracts";
import { Board } from "./Board";

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

const BOARD: V3BoardResponse = {
  contract: "v3.board.1",
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
  tennis: [
    {
      id: "t1",
      sport: "tennis",
      tournament: "ATP Shanghai",
      surface: "HARD",
      kickoff: "2026-10-10T16:00:00.000Z",
      home: "Jannik Sinner",
      away: "Ben Shelton",
      market: "winner",
      estimate_source: "model",
      model_version: "tennis-elo-v4",
      estimate_as_of: "2026-10-10T09:00:00.000Z",
      sealed_at: null,
      focus: "home",
      outcomes: [
        { outcome: "home", estimate_p: 0.71, market_price: null, book_prices: [], best_price: null },
        { outcome: "away", estimate_p: 0.29, market_price: null, book_prices: [], best_price: null },
      ],
    },
  ],
  coverage: { tennis: { matches: 1, with_book_price: {}, from_model: 1, from_market: 0 }, matches: 1, with_market: 1, sealed: 1, with_book_price: {}, excluded: [], book_price_max_age_min: 150, books_from_history: [] },
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

  it("tennis: stima del modello, nessun gap né mercato inventato, «market comparison coming»", () => {
    const { container } = render(<Board {...props} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-gap")?.textContent).toBe("market comparison coming");
    expect(row.querySelector(".v3c-rs-m")).toBeNull(); // nessun punto mercato
    expect(row.querySelector(".v3c-rs-e")?.textContent).toBe("71%");
    expect(row.querySelector(".v3c-r-price")?.textContent).toBe("—");
  });

  it("tennis: se il contratto porta mercato e gap (branch v3c-tennis), la riga li mostra come il calcio", () => {
    const withSplit: V3BoardResponse = {
      ...BOARD,
      tennis: BOARD.tennis.map((m) => ({ ...m, outcomes: m.outcomes.map((o) => ({ ...o, market_p: o.outcome === "home" ? 0.66 : 0.34, edge_pp: o.outcome === "home" ? 5 : -5 })) })),
    };
    const { container } = render(<Board {...props} board={withSplit} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-gap")?.textContent).toBe("+5.0 pp");
    expect(row.querySelector(".v3c-rs-m")?.textContent).toBe("66%");
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
});
