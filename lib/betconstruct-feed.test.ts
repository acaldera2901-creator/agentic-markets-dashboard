// lib/betconstruct-feed.test.ts
// #TENNIS-FP-COVERAGE-1: il feed è ordinato per bets_count:desc e il tennis
// main-tour sta oltre MAX_PAGES — la sweep mirata sport_key=tennis deve
// portare in mappa i match che la sweep principale non raggiunge, e un suo
// fallimento non deve scartare la mappa principale.
import { describe, it, expect } from "vitest";
import { fetchBookBoard, __setBookFetcherForTest } from "./betconstruct-feed";
import type { BookConfig } from "./betconstruct-books";

const book: BookConfig = {
  key: "fortuneplay",
  name: "FortunePlay",
  base: "https://www.fortuneplay.com",
  apiPrefix: "/_sb_api/api/v2",
  siteBase: "https://www.fortuneplay.com",
  stag: "x",
} as unknown as BookConfig;

function fpMatch(sportKey: string, home: string, away: string, id: number) {
  return {
    id,
    urn_id: `bc:match:${id}`,
    start_time: "2026-07-18T12:30:00Z",
    slug: `${home}-${away}`.toLowerCase(),
    competitors: { home: { name: home }, away: { name: away } },
    tournament: { sport: { key: sportKey } },
    // odds del feed = interi ÷ 1000 (parse in fortuneplay-live.ts)
    main_market: { outcomes: [{ odds: 1500 }, { odds: 2500 }] },
  };
}

describe("betconstruct-feed — sweep tennis (#TENNIS-FP-COVERAGE-1)", () => {
  it("i match tennis oltre MAX_PAGES arrivano in mappa via sport_key", async () => {
    // main sweep: 30 pagine di solo calcio (il tennis "vive" oltre il cap 20);
    // tennis sweep: 1 pagina con Rublev-Tabilo.
    __setBookFetcherForTest(async (_b, page, sportKey) => {
      if (sportKey === "tennis") {
        return {
          data: [fpMatch("tennis", "Andrey Rublev", "Alejandro Tabilo", 900)],
          pagination: { last_page: 1 },
        };
      }
      return {
        data: [fpMatch("soccer", `Home${page}`, `Away${page}`, page)],
        pagination: { last_page: 30 },
      };
    });
    const map = await fetchBookBoard(book, Date.now());
    const tennis = [...map.values()].filter((m) => m.sport === "tennis");
    expect(tennis).toHaveLength(1);
    expect(tennis[0].teamPairKey).toBe("2026-07-18:alejandro tabilo|andrey rublev");
    // la sweep principale resta intatta (20 pagine = cap)
    expect([...map.values()].filter((m) => m.sport === "soccer")).toHaveLength(20);
  });

  it("tennis sweep in errore → degrada alla mappa principale, non scarta tutto", async () => {
    __setBookFetcherForTest(async (_b, page, sportKey) => {
      if (sportKey === "tennis") throw new Error("boom");
      return {
        data: [fpMatch("soccer", `Casa${page}`, `Fuori${page}`, 100 + page)],
        pagination: { last_page: 1 },
      };
    });
    // book key diverso: la cache per-book del test precedente (serve-stale)
    // altrimenti risponderebbe al posto della fetch fresca.
    const map = await fetchBookBoard({ ...book, key: "ybets" } as BookConfig, Date.now());
    expect(map.size).toBe(1);
    expect([...map.values()][0].sport).toBe("soccer");
  });
});
