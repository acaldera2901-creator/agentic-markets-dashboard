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

// #SPLIT-0201 — in testa il TOTALE (decisione di Andrea, 02/10).
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { EdgeCard } from "./EdgeCard";
import type { YearData } from "./useYearData";

const yearData = vi.hoisted(() => ({ current: null as YearData | null }));
vi.mock("./useYearData", () => ({ useYearData: () => yearData.current }));

const base = { won: 50, lost: 25, n: 75, win_rate: "66.7%" };

it("con by_source: la cifra principale resta il totale, con la sua n", () => {
  yearData.current = { stats: { ...base, by_source: {
    model: { n: 40, won: 30, lost: 10, win_rate: "75.0%", interval_95: null },
    market_partner: { n: 35, won: 20, lost: 15, win_rate: "57.1%" },
  } } };
  const { container } = render(<EdgeCard lang="it" />);
  expect(container.querySelector(".tr-big")?.textContent).toBe("66.7%");
  expect(screen.getByText("75")).toBeTruthy();
  expect(screen.getByText("Modello: 75.0% su 40 · Quote di mercato del partner: 57.1% su 35")).toBeTruthy();
});

it("senza by_source (risposta vecchia): il totale come oggi, nessuna riga del partner", () => {
  yearData.current = { stats: base };
  const { container } = render(<EdgeCard lang="en" />);
  expect(container.querySelector(".tr-big")?.textContent).toBe("66.7%");
  expect(container.textContent).not.toContain("partner");
});

// #COPY-LEDGER-1007 — la nota sul cambio di popolazione segue il server.
it("flag spento: markup identico, nessuna nota", () => {
  yearData.current = { stats: base };
  const off = render(<EdgeCard lang="it" />).container.innerHTML;
  expect(off).not.toContain("tr-sealed-note");
  expect(off).not.toContain("calcio d'inizio");
  // `sealed_grading` assente o null producono lo stesso markup
  yearData.current = { stats: { ...base, sealed_grading: null } };
  expect(render(<EdgeCard lang="it" />).container.innerHTML).toBe(off);
});

it("flag acceso: nota nella lingua con la data del server", () => {
  yearData.current = { stats: { ...base, sealed_grading: { from: "2026-10-26T00:00:00.000Z" } } };
  const it_ = render(<EdgeCard lang="it" />).container;
  expect(it_.querySelector(".tr-sealed-note")?.textContent).toMatch(/^Dal 26\/10\/2026 il track record conta solo/);
  const en = render(<EdgeCard lang="en" />).container;
  expect(en.querySelector(".tr-sealed-note")?.textContent).toMatch(/^From 26 October 2026, the track record/);
});
