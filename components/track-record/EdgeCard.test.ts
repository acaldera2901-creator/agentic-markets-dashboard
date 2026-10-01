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
