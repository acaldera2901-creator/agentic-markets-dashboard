// lib/v3c/board-source.ts (#REDESIGN-V3C F5)
// La sorgente dei dati della board per le pagine v3c: UN'interfaccia, due
// implementazioni possibili. Oggi esiste solo quella SAMPLE (lib/v3c/sample.ts),
// perché l'endpoint di sola lettura della board è la fase F2 e non c'è ancora.
// Quando arriva, si sostituisce `getBoardSource()` e il resto non cambia: le
// pagine chiedono matches(), lead(), asOf — mai i dati grezzi.
//
// Chi usa questa sorgente marca a schermo `kind === "sample"`: un numero finto
// non deve mai sembrare un numero di oggi.
// polish: la sorgente LIVE esiste (liveBoardSource, dalla stessa board di
// /api/v3/board); la SAMPLE resta solo come ripiego dichiarato a schermo quando
// la board non risponde o non ha una partita di calcio con un mercato.
import type { V3BoardResponse } from "./contracts";
import { matchHref } from "./match-view";
import { estimateShown } from "./fixdata2";
import { valueToolsAllowed } from "./fixdata";
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
  /** polish: il gap della board (edge_pp, un decimale) — lo stesso numero di board e pagina partita */
  gap?: number | null;
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

/** Il ripiego: i dati d'esempio, marcati SAMPLE a schermo. La sorgente vera è liveBoardSource. */
export function getBoardSource(): BoardSource {
  return SAMPLE_BOARD_SOURCE;
}

/** Una sorgente da una lista di partite già pronte (serializzabile: viaggia fino al client). */
export function sourceFrom(kind: BoardSource["kind"], pricesAsOf: string, boardHref: string, list: readonly BoardMatch[]): BoardSource {
  return {
    kind,
    pricesAsOf,
    boardHref,
    matches: () => list,
    match: (id) => list.find((m) => m.id === id),
    // polish: con il gap della board l'esito guida è lo STESSO della board (|edge_pp| più ampio)
    lead: (match) =>
      match.outcomes.every((o) => o.gap != null)
        ? match.outcomes.reduce((b, o) => (Math.abs(o.gap as number) > Math.abs(b.gap as number) ? o : b))
        : leadOutcome(match.outcomes),
  };
}

const hhmmUtc = (iso: string) => `${iso.slice(11, 16)} UTC`;
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * polish: le partite di calcio VERE della board (con un mercato), in ordine di
 * calcio d'inizio, le prime `limit`. Stessi numeri della board e della pagina
 * partita (market_p, estimate_p arrotondati allo stesso modo: interi %).
 * null = nessuna partita utilizzabile → chi chiama ripiega sul SAMPLE dichiarato.
 */
export function liveBoardMatches(board: Pick<V3BoardResponse, "matches">, now: Date, limit = 8): BoardMatch[] {
  return board.matches
    // fixdata2 N3: a match whose estimate is not shown (no market, or far from the best price) is not a tool example;
    // final6 (fixui2 N1): nor one the model guard holds back — the tool pages prefill EV/Kelly from these rows
    .filter((m) => m.margin_removed != null && estimateShown(m) && valueToolsAllowed(m) && Date.parse(m.kickoff) > now.getTime() && m.outcomes.every((o) => o.market_price != null && o.market_p != null))
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
    .slice(0, limit)
    .map((m) => {
      const k = new Date(m.kickoff);
      return {
        id: m.id,
        league: m.competition || m.league || "",
        day: DAY[k.getUTCDay()],
        time: `${m.kickoff.slice(11, 16)} UTC`, // le pagine tool sono statiche (ISR): ora del server, dichiarata
        home: { name: m.home },
        away: { name: m.away },
        outcomes: m.outcomes.map((o) => ({
          key: o.outcome,
          label: o.outcome === "home" ? m.home : o.outcome === "away" ? m.away : "Draw",
          price: o.market_price as number,
          market: Math.round((o.market_p as number) * 100),
          estimate: Math.round(o.estimate_p * 100),
          prices: Object.fromEntries(o.book_prices.map((b) => [b.bookmaker, b.price])),
          gap: o.edge_pp,
        })),
        href: matchHref(m.id),
      };
    });
}

export function liveBoardSource(board: Pick<V3BoardResponse, "matches" | "generated_at">, now: Date): BoardSource | null {
  const list = liveBoardMatches(board, now);
  return list.length ? sourceFrom("live", hhmmUtc(board.generated_at), "/predictions", list) : null;
}
