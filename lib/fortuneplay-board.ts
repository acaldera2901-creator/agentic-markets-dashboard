// (#FORTUNEPLAY-LIVE-ODDS-1) Proietta la mappa FpMatch nel payload servito al FE.
// Degradazione pulita: senza slug/id validi → matchUrl = landing affiliate garantito
// (mediaroosters), prefilled=false. Nessuna card regredisce mai.
import type { FpMatch } from "./fortuneplay-live";
import { buildFortuneplayMatchUrl } from "./fortuneplay-url";
import { PRIMARY_BOOK } from "./betconstruct-books";
import type { BookBoard } from "./betconstruct-feed";

// #MULTIBOOK-1: quota di un singolo book per una selezione + suo deep-link.
export type BookOdds = {
  key: string;      // book key (es. "fortuneplay")
  name: string;     // display name
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  matchUrl: string; // deep-link a QUEL book (con il suo stag)
};

export type FpOddsEntry = {
  id: number;
  homeKey: string;
  awayKey: string;
  oddsHome: number | null;   // #MULTIBOOK-1: MIGLIORE tra i book (backward-compat)
  oddsDraw: number | null;
  oddsAway: number | null;
  totalLine: number | null;
  totalOver: number | null;
  totalUnder: number | null;
  matchUrl: string;          // book di riferimento (scheda/id); per la pick usare bestBook
  prefilled: boolean;
  // #MULTIBOOK-1 (opzionali → backward-compatible): dettaglio per-book + quale
  // book dà la quota migliore per ciascun esito.
  books?: BookOdds[];
  bestBook?: { home: string | null; draw: string | null; away: string | null };
  // #YBETS-COVERAGE-0916: book che possiede `id`. Gli id BetConstruct sono
  // PER-OPERATORE, non condivisi (misurato il 16/09 su due feed: 0 id in comune
  // su 50+50, mentre 14 slug coincidevano con id diversi) → chiedere i mercati
  // di dettaglio al book sbagliato non dà "vuoto", dà UN'ALTRA PARTITA.
  detailBook?: string;
};

export function boardToResponse(
  map: Map<string, FpMatch>,
  cfg: { baseUrl: string; locale: string; code?: string; landingUrl: string }
): Record<string, FpOddsEntry> {
  // #FORTUNEPLAY-DEEPLINK-0701: deep-link pagina-partita VERIFICATO costruibile dal
  // feed → {baseUrl}/{locale}/sports/{sport}/{slug}-m-{id} (segmento sport + token
  // fisso "-m", verificato calcio/tennis M+W). Fallback landing se manca slug/id/sport.
  const out: Record<string, FpOddsEntry> = {};
  for (const [key, m] of map) {
    const deep =
      m.slug && m.id && m.sport
        ? buildFortuneplayMatchUrl({ baseUrl: cfg.baseUrl, locale: cfg.locale, sport: m.sport, slug: m.slug, id: m.id, code: cfg.code })
        : null;
    out[key] = {
      id: m.id,
      homeKey: m.homeKey,
      awayKey: m.awayKey,
      oddsHome: m.oddsHome,
      oddsDraw: m.oddsDraw,
      oddsAway: m.oddsAway,
      totalLine: m.totalLine,
      totalOver: m.totalOver,
      totalUnder: m.totalUnder,
      matchUrl: deep ?? cfg.landingUrl,
      prefilled: Boolean(deep),
    };
  }
  return out;
}

// #MULTIBOOK-1 — Unisce N book BetConstruct in best-odds per team_pair_key.
// Book di RIFERIMENTO = il primo book (primario per primo) che ha quella partita:
// da lui vengono id/homeKey/awayKey/totals/matchUrl, e `detailBook` dice quale è
// così la scheda "More markets" interroga il feed giusto. oddsHome/Draw/Away =
// MIGLIORE tra i book (allineate al lato del riferimento per nome normalizzato).
// `books[]` porta il dettaglio per-book (+ deep-link col rispettivo stag) per la
// comparazione FE.
//
// #YBETS-COVERAGE-0916: prima si iterava SOLO la mappa del book primario, quindi
// una partita che solo il secondario prezzava non generava alcuna entry e la card
// restava "solo modello" pur avendo il dato in casa. Misurato il 16/09 sui feed
// vivi: 827 partite in comune, 14 solo FortunePlay, **22 solo YBets** (21 calcio,
// fra cui Brighton–Manchester United).
export function mergeBooksToResponse(
  boards: BookBoard[],
  cfg: { locale: string; landingUrl: string }
): Record<string, FpOddsEntry> {
  if (!boards.length) return {};
  // Ordine di preferenza del riferimento: primario, poi gli altri nell'ordine in
  // cui arrivano (= ordine del registro BOOKS).
  const ordered = [
    ...boards.filter((b) => b.book.key === PRIMARY_BOOK.key),
    ...boards.filter((b) => b.book.key !== PRIMARY_BOOK.key),
  ];
  const out: Record<string, FpOddsEntry> = {};

  const keys = new Set<string>();
  for (const b of ordered) for (const k of b.map.keys()) keys.add(k);

  for (const key of keys) {
    const ref = ordered.find((b) => b.map.has(key))!;
    const pm = ref.map.get(key)!;
    // odds di un book allineate al lato HOME/AWAY del primario (teams uguali per key,
    // ma un book può avere home/away invertiti → allinea per homeKey/awayKey).
    const aligned = (bm: FpMatch): { home: number | null; draw: number | null; away: number | null } | null => {
      if (bm.homeKey === pm.homeKey) return { home: bm.oddsHome, draw: bm.oddsDraw, away: bm.oddsAway };
      if (bm.awayKey === pm.homeKey) return { home: bm.oddsAway, draw: bm.oddsDraw, away: bm.oddsHome };
      return null;
    };
    const books: BookOdds[] = [];
    for (const { book, map } of boards) {
      const bm = map.get(key);
      if (!bm) continue;
      const a = aligned(bm);
      if (!a) continue;
      // Deep-link solo per i book col sito utente noto (matchUrlBase); altrimenti
      // landing affiliate garantita. #YBETS-DEEPLINK-404: `book.base` è l'host del
      // feed e NON serve le pagine-partita di ogni book (YBets → 404).
      const url =
        book.matchUrlBase && bm.slug && bm.id && bm.sport
          ? buildFortuneplayMatchUrl({ baseUrl: book.matchUrlBase, locale: cfg.locale, sport: bm.sport, slug: bm.slug, id: bm.id, code: book.stag })
          : book.landing;
      books.push({ key: book.key, name: book.name, oddsHome: a.home, oddsDraw: a.draw, oddsAway: a.away, matchUrl: url });
    }

    const best = (sel: "oddsHome" | "oddsDraw" | "oddsAway") => {
      let bk: string | null = null, val: number | null = null;
      for (const b of books) {
        const v = b[sel];
        if (v != null && (val == null || v > val)) { val = v; bk = b.key; }
      }
      return { val, bk };
    };
    const bh = best("oddsHome"), bd = best("oddsDraw"), ba = best("oddsAway");
    const refBook = books.find((b) => b.key === ref.book.key) ?? books[0];

    out[key] = {
      id: pm.id,
      homeKey: pm.homeKey,
      awayKey: pm.awayKey,
      oddsHome: bh.val,
      oddsDraw: bd.val,
      oddsAway: ba.val,
      totalLine: pm.totalLine,
      totalOver: pm.totalOver,
      totalUnder: pm.totalUnder,
      matchUrl: refBook?.matchUrl ?? cfg.landingUrl,
      // `prefilled` = «il link apre la PAGINA di questa partita». Si confronta
      // con la landing del book di riferimento, non con quella del primario:
      // per una partita solo-YBets il link è la landing YBets, che è diversa da
      // `cfg.landingUrl` e col vecchio confronto sarebbe passata per deep-link.
      prefilled: Boolean(refBook && refBook.matchUrl !== ref.book.landing && refBook.matchUrl !== cfg.landingUrl),
      books,
      bestBook: { home: bh.bk, draw: bd.bk, away: ba.bk },
      detailBook: ref.book.key,
    };
  }
  return out;
}
