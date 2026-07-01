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
  matchUrl: string;          // book primario (scheda/id); per la pick usare bestBook
  prefilled: boolean;
  // #MULTIBOOK-1 (opzionali → backward-compatible): dettaglio per-book + quale
  // book dà la quota migliore per ciascun esito.
  books?: BookOdds[];
  bestBook?: { home: string | null; draw: string | null; away: string | null };
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
// Book primario (FortunePlay) = riferimento per id/homeKey/awayKey/totals/matchUrl
// (la scheda "More markets" resta per-book via id primario). oddsHome/Draw/Away =
// MIGLIORE tra i book (allineate al lato del primario per nome normalizzato). `books[]`
// porta il dettaglio per-book (+ deep-link col rispettivo stag) per la comparazione FE.
export function mergeBooksToResponse(
  boards: BookBoard[],
  cfg: { locale: string; landingUrl: string }
): Record<string, FpOddsEntry> {
  const primary = boards.find((b) => b.book.key === PRIMARY_BOOK.key) ?? boards[0];
  if (!primary) return {};
  const out: Record<string, FpOddsEntry> = {};

  for (const [key, pm] of primary.map) {
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
      const url =
        bm.slug && bm.id && bm.sport
          ? buildFortuneplayMatchUrl({ baseUrl: book.base, locale: cfg.locale, sport: bm.sport, slug: bm.slug, id: bm.id, code: book.stag })
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
    const primaryBook = books.find((b) => b.key === (primary.book.key)) ?? books[0];

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
      matchUrl: primaryBook?.matchUrl ?? cfg.landingUrl,
      prefilled: Boolean(primaryBook && primaryBook.matchUrl !== cfg.landingUrl),
      books,
      bestBook: { home: bh.bk, draw: bd.bk, away: ba.bk },
    };
  }
  return out;
}
