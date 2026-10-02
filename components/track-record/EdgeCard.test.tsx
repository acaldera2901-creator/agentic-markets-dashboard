// #COERENZA-1001 (a) — la riga della copertura dichiara ogni esclusione che c'è.
import { it, expect } from "vitest";
import { coverageLine } from "./EdgeCard";

it("elenca senza esito, non confermate e sotto floor; tace quelle a zero", () => {
  const s = {
    coverage: 0.565, surfaced_total: 5514, unresolved_excluded: 2345, unverified_excluded: 53,
    post_cutover_excluded: { n: 24, won: 12, lost: 12, win_rate: 50 },
  };
  expect(coverageLine(s, true)).toBe(
    "Verificate 56.5% delle 5514 pick mostrate e concluse · 2345 senza un esito confermato · 53 con un esito che nessuna fonte conferma · 24 sotto il floor di lega (dal 25/09), fuori dal numero.",
  );
  expect(coverageLine({ coverage: 1, surfaced_total: 10 }, false)).toBe("100.0% of the 10 shown, finished picks verified.");
});

// #SPLIT-0201 — in testa la cifra del modello; il totale col partner, sotto.
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { EdgeCard } from "./EdgeCard";
import type { YearData } from "./useYearData";

const yearData = vi.hoisted(() => ({ current: null as YearData | null }));
vi.mock("./useYearData", () => ({ useYearData: () => yearData.current }));

const base = { won: 50, lost: 25, n: 75, win_rate: "66.7%" };

it("con by_source: il modello è la cifra principale e c'è la riga del partner", () => {
  yearData.current = { stats: { ...base, by_source: {
    model: { n: 40, won: 30, lost: 10, win_rate: "75.0%", interval_95: null },
    market_partner: { n: 35, won: 20, lost: 15, win_rate: "57.1%" },
  } } };
  const { container } = render(<EdgeCard lang="it" />);
  expect(container.querySelector(".tr-big")?.textContent).toBe("75.0%");
  expect(screen.getByText("40")).toBeTruthy();
  expect(screen.getByText("Incluse le quote di mercato del partner: 66.7% su 75 pick")).toBeTruthy();
});

it("senza by_source (risposta vecchia): il totale come oggi, nessuna riga del partner", () => {
  yearData.current = { stats: base };
  const { container } = render(<EdgeCard lang="en" />);
  expect(container.querySelector(".tr-big")?.textContent).toBe("66.7%");
  expect(container.textContent).not.toContain("partner");
});
