// lib/v3c/books.ts (#REDESIGN-V3C F9 · filone pages) — i dati della pagina Books, puri.
// Consuma il contratto della board (/api/v3/board, v3.board.2) leggendo SOLO i
// campi che c'erano già: bookmaker, name, price, captured_at. Il filone
// `partners` sta estendendo V3BookPrice con campi opzionali: qui non servono e
// non si assumono, così questa pagina non si rompe quando arrivano.
// Una quota si mostra solo per i book con feed (come sulla board), mai inventata.
import type { V3BoardResponse, V3BookPrice } from "./contracts";
import { leadOutcome } from "./board-view";

export type CompareRow = {
  id: string;
  match: string;
  /** l'esito guida: la squadra/il giocatore, o «Draw» */
  outcome: string;
  kickoff: string;
  /** prezzo per chiave book (solo i book con feed) */
  prices: Record<string, number>;
  /** chiave del prezzo più alto, se unico; null con un solo prezzo o a parità */
  best: string | null;
};

export type BooksData = {
  rows: CompareRow[];
  /** su quanti esiti guida (con almeno un prezzo) ogni book è il migliore */
  bestCount: Record<string, number>;
  /** esiti guida con almeno un prezzo */
  priced: number;
  /** la cattura più recente fra i prezzi mostrati (ISO), null se nessuna */
  checkedAt: string | null;
};

const DRAW = "Draw";

function priceMap(books: V3BookPrice[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of books) if (Number.isFinite(b.price) && b.price > 1) out[b.bookmaker] = Math.max(out[b.bookmaker] ?? 0, b.price);
  return out;
}

/** Il book col prezzo più alto, SOLO se lo è da solo: a parità (o con un solo prezzo) nessuno è «best». */
function bestKey(prices: Record<string, number>): string | null {
  const e = Object.entries(prices).sort((a, b) => b[1] - a[1]);
  if (e.length < 2 || e[0][1] === e[1][1]) return null;
  return e[0][0];
}

/** Le righe del confronto: partite non ancora iniziate, esito guida, solo dove almeno un book ha un prezzo. */
export function booksData(board: V3BoardResponse, now: Date, limit = 8): BooksData {
  const all: (CompareRow & { captured: string[] })[] = [];
  const upcoming = (k: string) => Date.parse(k) > now.getTime();

  for (const m of board.matches) {
    if (!upcoming(m.kickoff)) continue;
    // polish: lo STESSO esito guida della board (gap assoluto più ampio), non il focus del contratto
    const o = leadOutcome(m);
    if (!o) continue;
    const prices = priceMap(o.book_prices);
    if (!Object.keys(prices).length) continue;
    const outcome = o.outcome === "home" ? m.home : o.outcome === "away" ? m.away : DRAW;
    all.push({ id: m.id, match: `${m.home} — ${m.away}`, outcome, kickoff: m.kickoff, prices, best: bestKey(prices), captured: o.book_prices.map((b) => b.captured_at) });
  }
  for (const m of board.tennis ?? []) {
    if (!upcoming(m.kickoff)) continue;
    const s = m.sides.find((x) => x.side === m.focus);
    if (!s) continue;
    const prices = priceMap(s.book_prices);
    if (!Object.keys(prices).length) continue;
    all.push({ id: `tn:${m.id}`, match: `${m.player1} — ${m.player2}`, outcome: s.player, kickoff: m.kickoff, prices, best: bestKey(prices), captured: s.book_prices.map((b) => b.captured_at) });
  }

  all.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const bestCount: Record<string, number> = {};
  for (const r of all) if (r.best) bestCount[r.best] = (bestCount[r.best] ?? 0) + 1;
  const shown = all.slice(0, limit);
  const caps = shown.flatMap((r) => r.captured).filter((c) => c && !Number.isNaN(Date.parse(c)));
  const checkedAt = caps.length ? caps.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
  return {
    rows: shown.map(({ captured: _c, ...r }) => r),
    bestCount,
    priced: all.length,
    checkedAt,
  };
}

/** «14:05 UTC» — l'ora dei prezzi è scritta in UTC, come il sigillo. */
export function hhmmUtc(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}
