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
    // fidelity: mercato e stima in due colonne (prototipo), il tape senza storico lo dice
    expect(row.querySelector(".v3c-r-mk")?.textContent).toBe("44%");
    expect(row.querySelector(".v3c-r-es")?.textContent).toBe("48%");
    expect(row.querySelector(".v3c-r-tape")?.textContent).toBe("no history");
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
    // fixui M2: l'ora del sigillo è nel fuso della vista (la sigla la dichiara la nota del fuso), non più «UTC»
    expect(pn.textContent).toMatch(/This match entered the public ledger on 9 Oct, \d{2}:02, before kick-off/);
    expect(container.querySelectorAll(".v3c-btn-cta")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Best price on Genoa: 2\.15 at FortunePlay/ })).toHaveAttribute("href", "https://www.fortuneplay.example/m?stag=185731");
  });

  // tennis2 (Andrea, 07/10): senza stima nel contratto la riga dice «Market only» — nessuna colonna vuota, nessun gap.
  it("tennis Market only: un'etichetta al posto di stima e gap, niente «market comparison coming»", () => {
    const { container } = render(<Board {...props} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.dataset.estimate).toBe("market");
    expect(row.querySelector(".v3c-r-mk")?.textContent).toBe("66%");
    expect(row.querySelector(".v3c-r-es")?.textContent).toBe("Market only");
    expect(row.textContent).not.toMatch(/71|market comparison coming|pp/);
    fireEvent.click(screen.getByRole("button", { name: /Jannik Sinner – Ben Shelton/ }));
    const pn = container.querySelector('.v3c-row[data-sport="tennis"] .v3c-pn') as HTMLElement;
    expect(within(pn).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Winner", "Price", "Market"]);
    expect(pn.textContent).toContain("66%");
    expect(pn.textContent).toContain("No estimate of ours for this match");
    expect(pn.textContent).not.toMatch(/71%|73%|raw Elo|Estimate|Gap|Not sealed yet/);
  });

  // tennis2: con estimate_kind 'elo_blend_unsealed' Market → Estimate → Gap, gap attenuato e mai verde/rosso
  it("tennis Elo-based: mercato, stima senza evidenziatore, gap grigio, etichetta e avvertenza", () => {
    const m = { ...tennisMatch(), estimate_kind: "elo_blend_unsealed" as const, estimate_p: { p1: 0.6634, p2: 0.3366 }, gap_pp: { p1: 0.34, p2: -0.34 }, gap_visible: true, elo_p_raw: { p1: 0.69, p2: 0.31 }, elo_age_min: 40, elo_as_of: "2026-10-10T08:20:00.000Z" };
    const { container } = render(<Board {...props} board={{ ...BOARD, tennis: [m] }} initialFilters={{ sport: "tennis" }} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.dataset.estimate).toBe("elo");
    expect(row.querySelector(".v3c-r-mk")?.textContent).toBe("66%");
    expect(row.querySelector(".v3c-r-es")?.textContent).toBe("66%");
    expect(row.querySelector(".v3c-r-es mark")).toBeNull();
    const gap = row.querySelector(".v3c-r-gap") as HTMLElement;
    expect(gap.className).toContain("v3c-g-tn");
    expect(gap.textContent).toContain("+0.3");
    expect(row.textContent).toContain("Elo-based, not sealed");
    expect(container.querySelector(".v3c-tn-caveat")?.textContent).toBe("In tennis our estimate is 90% market, 10% our Elo. Not sealed: the gap is information, not advice.");
    const head = container.querySelector(".v3c-board-h") as HTMLElement;
    expect(head.textContent).toContain("90% market · Elo");
    fireEvent.click(screen.getByRole("button", { name: /Jannik Sinner – Ben Shelton/ }));
    const pn = container.querySelector('.v3c-row[data-sport="tennis"] .v3c-pn') as HTMLElement;
    expect(within(pn).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Winner", "Price", "Market", "Estimate", "Gap"]);
    expect(pn.textContent).toContain("estimate = 90% market + 10% our Elo, not sealed");
    // mai la temperatura né l'Elo grezzo come numero di valore
    expect(pn.textContent).not.toMatch(/69%|value|edge/i);
  });

  it("tennis Elo-based con |Elo − mercato| > 25 pp: stima sì, gap nascosto", () => {
    const m = { ...tennisMatch(), estimate_kind: "elo_blend_unsealed" as const, estimate_p: { p1: 0.69, p2: 0.31 }, gap_pp: { p1: 3, p2: -3 }, gap_visible: false, elo_p_raw: { p1: 0.96, p2: 0.04 }, elo_age_min: 40, elo_as_of: "2026-10-10T08:20:00.000Z" };
    const { container } = render(<Board {...props} board={{ ...BOARD, tennis: [m] }} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-es")?.textContent).toBe("69%");
    expect(row.querySelector(".v3c-r-gap")?.textContent).not.toMatch(/\+3|pp/);
    expect(row.querySelector(".v3c-r-gap")?.getAttribute("title")).toBe("Gap not shown: our Elo is too far from the market");
  });

  it("home: il tennis non mostra il gap (resta il mercato con la stima accanto)", () => {
    const m = { ...tennisMatch(), estimate_kind: "elo_blend_unsealed" as const, estimate_p: { p1: 0.6634, p2: 0.3366 }, gap_pp: { p1: 0.34, p2: -0.34 }, gap_visible: true };
    const { container } = render(<Board {...props} surface="home" board={{ ...BOARD, tennis: [m] }} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-gap")?.textContent).not.toMatch(/\+0\.3|pp/);
  });

  it("tennis con un gap nel contratto: non si disegna comunque (il campo resta nell'API)", () => {
    const { container } = render(<Board {...props} board={{ ...BOARD, tennis: [tennisMatch({ gap: true })] }} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-mk")?.textContent).toBe("66%");
    expect(row.textContent).not.toMatch(/\+5\.0|71%|pp/);
    fireEvent.click(screen.getByRole("button", { name: /Jannik Sinner – Ben Shelton/ }));
    const pn = container.querySelector('.v3c-row[data-sport="tennis"] .v3c-pn') as HTMLElement;
    // fixq Q6: a sealed model_tempered row is our Elo — the seal no longer calls it «market-based»
    expect(pn.textContent).toContain("The sealed number is our Elo model.");
    expect(pn.textContent).not.toMatch(/\+5\.0|Gap = our sealed estimate/);
  });

  it("tennis: in evidenza il favorito del mercato, non quello della stima", () => {
    const m = tennisMatch();
    // la stima preferisce Sinner (focus p1), il mercato Shelton: la riga segue il mercato
    const flipped = { ...m, sides: [{ ...m.sides[0], market_p: 0.4 }, { ...m.sides[1], market_p: 0.6 }] as typeof m.sides };
    const { container } = render(<Board {...props} board={{ ...BOARD, tennis: [flipped] }} />);
    const row = container.querySelector('.v3c-row[data-sport="tennis"]') as HTMLElement;
    expect(row.querySelector(".v3c-r-name small b")?.textContent).toBe("Ben Shelton");
    expect(row.querySelector(".v3c-r-mk")?.textContent).toBe("60%");
  });

  it("tennis: la legenda col solo tennis dice la regola 90/10 e non quella del calcio", () => {
    const { container } = render(<Board {...props} initialFilters={{ sport: "tennis" }} />);
    const legend = container.querySelector(".v3c-legend") as HTMLElement;
    expect(legend.textContent).toContain("Tennis: 90% market + 10% our Elo where fresh, not sealed; else market only");
    expect(legend.textContent).not.toMatch(/30% model/);
  });

  it("fidelity: il tape «open → now» dai dati veri, a gradini, con l'etichetta accessibile", () => {
    const tape = { pts: [[0, 2.02], [50, 2.1], [100, 2.15]] as [number, number][], fair: 2.08, fairT: 80, from: 2.02, to: 2.15, n: 9 };
    const { container } = render(<Board {...props} tapes={{ [BOARD.matches[0].id]: tape }} />);
    const row = container.querySelector('.v3c-row[data-sport="football"]') as HTMLElement;
    expect(within(row).getByRole("img", { name: /price at a connected book moved from 2\.02 to 2\.15, 9 captures/ })).toBeInTheDocument();
    expect(row.querySelector(".v3c-tape path")?.getAttribute("d")).toMatch(/^M[\d.]+ [\d.]+ H[\d.]+ V[\d.]+ H/); // gradini, mai diagonali
    expect(row.querySelector(".v3c-r-tape small")?.textContent).toBe("2.02 → 2.15");
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
