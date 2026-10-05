// lib/v3c/board-source.ts (#REDESIGN-V3C F5)
// La sorgente dei dati della board per le pagine v3c: UN'interfaccia, due
// implementazioni possibili. Oggi esiste solo quella SAMPLE (lib/v3c/sample.ts),
// perché l'endpoint di sola lettura della board è la fase F2 e non c'è ancora.
// Quando arriva, si sostituisce `getBoardSource()` e il resto non cambia: le
// pagine chiedono matches(), lead(), asOf — mai i dati grezzi.
//
// Chi usa questa sorgente marca a schermo `kind === "sample"`: un numero finto
// non deve mai sembrare un numero di oggi.
import type { TeamIdentity } from "./monogram";
import { SAMPLE_BOARD, leadOutcome, type SampleOutcome } from "./sample";

export type BoardOutcome = {
  key: string;
  label: string;
  /** Prezzo decimale di riferimento. */
  price: number;
  /** % di mercato, margine rimosso. */
  market: number;
  /** % della nostra stima. */
  estimate: number;
  /** Prezzi per book connesso (codice → quota); vuoto se non disponibili. */
  prices: Record<string, number>;
};

export type BoardMatch = {
  id: string;
  league: string;
  /** «Sat», «Sun»… e l'orario locale, come li mostra la board. */
  day: string;
  time: string;
  home: TeamIdentity;
  away: TeamIdentity;
  outcomes: readonly BoardOutcome[];
  /** Dove porta la riga: oggi /predictions, da F4 /match/[id]. */
  href: string;
  /** Prezzo di apertura dell'esito guida, se noto (per «open → now»). */
  openPrice?: number;
};

export type BoardSource = {
  kind: "sample" | "live";
  /** Ora dei prezzi, già formattata («11:40 UTC»). */
  pricesAsOf: string;
  /** Dove vive la board intera. */
  boardHref: string;
  matches(): readonly BoardMatch[];
  match(id: string): BoardMatch | undefined;
  lead(match: BoardMatch): BoardOutcome;
};

export function matchTitle(m: Pick<BoardMatch, "home" | "away">): string {
  return `${m.home.name} — ${m.away.name}`;
}

function toBoardOutcome(o: SampleOutcome): BoardOutcome {
  return { key: o.key, label: o.label, price: o.price, market: o.market, estimate: o.estimate, prices: o.prices };
}

/** L'implementazione SAMPLE: legge i dati del prototipo da lib/v3c/sample.ts. */
export const SAMPLE_BOARD_SOURCE: BoardSource = {
  kind: "sample",
  pricesAsOf: "11:40 UTC",
  boardHref: "/predictions",
  matches() {
    return SAMPLE_BOARD.map((m) => ({
      id: m.id,
      league: m.league,
      day: m.day,
      time: m.time,
      home: m.home,
      away: m.away,
      outcomes: m.outcomes.map(toBoardOutcome),
      href: "/predictions",
      openPrice: m.openPrice,
    }));
  },
  match(id) {
    return this.matches().find((m) => m.id === id);
  },
  lead(match) {
    return leadOutcome(match.outcomes);
  },
};

/** L'unico punto da cambiare quando F2 consegna l'endpoint reale. */
export function getBoardSource(): BoardSource {
  return SAMPLE_BOARD_SOURCE;
}
