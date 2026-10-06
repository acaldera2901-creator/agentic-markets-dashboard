// lib/v3c/board-pack.ts (#REDESIGN-V3C polish) — il payload della board, compatto per
// il viaggio server → browser. /predictions spediva ~805 KB di HTML (435 partite):
// la parte che si ripete di più sono i prezzi dei book, dove OGNI riga ripete nome
// del book, sorgente e URL affiliato (la stessa URL per i tre esiti di una partita).
// Qui quei campi diventano indici in due tabelle (book, URL); unpack() ricostruisce
// ESATTAMENTE lo stesso V3BoardResponse (test di andata e ritorno). Nessun contenuto
// cambia: stessi numeri, stessi link, stesso ordine. Funzioni pure, nessun I/O.
import type { V3BoardResponse, V3BookPrice } from "./contracts";

/** [indice book, prezzo, 1 = price_history / 0 = live_feed, indice URL, captured_at] */
type PackedPrice = [number, number, 0 | 1, number, string];

export type PackedBoard = {
  packed: 1;
  /** coppie [bookmaker, name] */
  books: [string, string][];
  urls: string[];
  /** il board con book_prices sostituiti da `bp` (PackedPrice[]) */
  board: V3BoardResponse;
};

type WithPrices = { book_prices: V3BookPrice[] };
type WithPacked = { bp?: PackedPrice[] };

export function packBoard(board: V3BoardResponse): PackedBoard {
  const books: [string, string][] = [];
  const bookIdx = new Map<string, number>();
  const urls: string[] = [];
  const urlIdx = new Map<string, number>();
  const idx = <K>(map: Map<K, number>, list: unknown[], key: K, value: unknown) => {
    let i = map.get(key);
    if (i == null) {
      i = list.push(value) - 1;
      map.set(key, i);
    }
    return i;
  };
  const packList = (list: V3BookPrice[]): PackedPrice[] =>
    list.map((b) => [
      idx(bookIdx, books, `${b.bookmaker}\u0000${b.name}`, [b.bookmaker, b.name]),
      b.price,
      b.source === "price_history" ? 1 : 0,
      idx(urlIdx, urls, b.url, b.url),
      b.captured_at,
    ]);
  const strip = <T extends WithPrices>(x: T): Omit<T, "book_prices"> & WithPacked => {
    const { book_prices, ...rest } = x;
    return { ...rest, bp: packList(book_prices) };
  };
  const out = {
    ...board,
    matches: board.matches.map((m) => ({ ...m, outcomes: m.outcomes.map(strip) })),
    tennis: board.tennis?.map((m) => ({ ...m, sides: m.sides.map(strip) })),
  } as unknown as V3BoardResponse;
  if (board.tennis === undefined) delete (out as { tennis?: unknown }).tennis;
  return { packed: 1, books, urls, board: out };
}

export function isPacked(x: unknown): x is PackedBoard {
  return !!x && typeof x === "object" && (x as { packed?: unknown }).packed === 1;
}

export function unpackBoard(p: PackedBoard): V3BoardResponse {
  const unpackList = (bp: PackedPrice[] = []): V3BookPrice[] =>
    bp.map(([bi, price, h, ui, captured_at]) => ({
      bookmaker: p.books[bi][0],
      name: p.books[bi][1],
      price,
      captured_at,
      source: h ? "price_history" : "live_feed",
      url: p.urls[ui],
    }));
  const restore = <T extends WithPacked>(x: T) => {
    const { bp, ...rest } = x;
    return { ...rest, book_prices: unpackList(bp) };
  };
  const b = p.board as unknown as { matches: { outcomes: WithPacked[] }[]; tennis?: { sides: WithPacked[] }[] };
  const out = {
    ...p.board,
    matches: b.matches.map((m) => ({ ...m, outcomes: m.outcomes.map(restore) })),
    tennis: b.tennis?.map((m) => ({ ...m, sides: m.sides.map(restore) })),
  } as unknown as V3BoardResponse;
  if (p.board.tennis === undefined) delete (out as { tennis?: unknown }).tennis;
  return out;
}
