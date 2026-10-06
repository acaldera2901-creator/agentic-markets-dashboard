// #V3C-PARTNERS (F7) — un solo registro dei book che possono portare una quota
// nel «best price», qualunque sia la piattaforma, più lo stato di OGNI partner
// (anche di chi una quota non ce l'ha, e perché).
//
// Tre livelli, in ordine di prudenza:
//   1. BOOKS (FortunePlay, YBets) — accesi da sempre, alimentano anche il sito
//      attuale e il collector. Questo file non li tocca.
//   2. Feed verificati ma GATED (RollXO, N1 Bet su BetConstruct; Wildz, Beazt su
//      Altenar) — il codice c'è, ma non leggono niente finché la loro chiave non
//      sta in `BETREDGE_PARTNER_FEEDS` (lista separata da virgole). La variabile
//      si imposta solo dopo l'APPROVE di docs/v3c-partners-collector-proposal.md.
//      Variabile assente = comportamento identico a oggi.
//   3. Partner senza feed lecito/visto — compaiono nel confronto con logo e
//      bottone, senza quota («Odds on site»), col motivo.
//
// Regola che resta: una quota entra nel confronto solo se il book ha un link
// affiliato reale (`landing`) — si confrontano solo book cliccabili con
// attribuzione.
import { BOOKS, EXTRA_BOOKS, type BookConfig } from "./betconstruct-books";
import { fetchAllBooks, fetchBookBoard } from "./betconstruct-feed";
import { ALTENAR_BOOKS, type AltenarBook } from "./altenar-books";
import { fetchAltenarBoard } from "./altenar-feed";
import type { FpMatch } from "./fortuneplay-live";
import { PARTNERS } from "./partners";

export const PARTNER_FEEDS_ENV = "BETREDGE_PARTNER_FEEDS";

export type PriceBook = {
  key: string;
  name: string;
  landing: string;
  platform: "betconstruct" | "altenar";
  /** BetConstruct only: host of the per-match page (deep-link) */
  matchUrlBase?: string;
  stag?: string;
};

export type PriceBoard = { book: PriceBook; map: Map<string, FpMatch> };

/** Why a partner has (or has not) a price on a fixture. */
export type BookReason =
  | "live_feed" // price read now from the book's feed
  | "price_history" // feed down, last stored capture (≤ 150 min)
  | "not_listed" // feed up, the book does not offer this fixture (or names did not match)
  | "feed_down" // feed configured but unreachable, no recent capture
  | "pending_approval" // feed verified, waiting for APPROVE of the collector proposal
  | "awaiting_partner_feed" // no public feed seen/allowed: asked to the partner
  | "region_restricted" // the book's feed does not answer from our region
  | "no_sportsbook"; // partner is not a bookmaker

const fromBetconstruct = (b: BookConfig): PriceBook => ({
  key: b.key, name: b.name, landing: b.landing, platform: "betconstruct", matchUrlBase: b.matchUrlBase, stag: b.stag,
});
const fromAltenar = (b: AltenarBook): PriceBook => ({ key: b.key, name: b.name, landing: b.landing, platform: "altenar" });

/** Partner id (lib/partners) → static state when no feed is wired. */
const NO_FEED: Record<string, Exclude<BookReason, "live_feed" | "price_history" | "not_listed" | "feed_down" | "pending_approval">> = {
  // Sportsbook vendor not determined (Altenar/Kambi/Latrobe per brand, config at runtime).
  betscore: "awaiting_partner_feed",
  casea: "awaiting_partner_feed",
  stonevegas: "awaiting_partner_feed",
  // No public odds endpoint seen; Andrea asked the partners (no scraping).
  velobet: "awaiting_partner_feed",
  ggbet: "awaiting_partner_feed",
  betwinner: "awaiting_partner_feed",
  felicebet: "awaiting_partner_feed",
  // Same platform as FortunePlay, but /_sb_api answers with the SPA from DE and
  // the site says «Restricted region» from US: not read, no workaround.
  hollywin: "region_restricted",
  slotsbonus: "no_sportsbook",
};

/** Partner id for a price-book key (keys and partner ids coincide by design). */
const PARTNER_ID_OF_BOOK: Record<string, string> = {
  fortuneplay: "fortuneplay", ybets: "ybets", rollxo: "rollxo", n1bet: "n1bet", wildz: "wildz", beazt: "beazt",
};

export function gatedFeedKeys(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set(
    (env[PARTNER_FEEDS_ENV] ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}

const ALL_GATED: PriceBook[] = [...EXTRA_BOOKS.map(fromBetconstruct), ...ALTENAR_BOOKS.map(fromAltenar)];

/** Books allowed to carry a price right now: BOOKS + gated books switched on, with a real affiliate link. */
export function enabledPriceBooks(env: Record<string, string | undefined> = process.env): PriceBook[] {
  const on = gatedFeedKeys(env);
  return [...BOOKS.map(fromBetconstruct), ...ALL_GATED.filter((b) => on.has(b.key))].filter((b) => b.landing);
}

export function priceBookByKey(key: string, env: Record<string, string | undefined> = process.env): PriceBook | undefined {
  return enabledPriceBooks(env).find((b) => b.key === key);
}

/**
 * Every enabled price book, in parallel, best-effort (a failing book → empty
 * map). BOOKS go through fetchAllBooks so their cache is shared with the
 * current site; gated books are fetched only when switched on.
 */
export async function fetchAllPriceBooks(
  now = Date.now(),
  env: Record<string, string | undefined> = process.env,
): Promise<PriceBoard[]> {
  const on = gatedFeedKeys(env);
  const empty = () => new Map<string, FpMatch>();
  const [base, extra, altenar] = await Promise.all([
    fetchAllBooks(now),
    Promise.all(
      EXTRA_BOOKS.filter((b) => on.has(b.key) && b.landing).map(async (b) => ({
        book: fromBetconstruct(b),
        map: await fetchBookBoard(b, now).catch(empty),
      })),
    ),
    Promise.all(
      ALTENAR_BOOKS.filter((b) => on.has(b.key) && b.landing).map(async (b) => ({
        book: fromAltenar(b),
        map: await fetchAltenarBoard(b, now).catch(empty),
      })),
    ),
  ]);
  return [...base.map(({ book, map }) => ({ book: fromBetconstruct(book), map })), ...extra, ...altenar];
}

/** Per-fixture status of one partner (compact: name/logo/url live once in partnerDirectory()). */
export type BookStatus = {
  partner_id: string;
  oddsAvailable: boolean;
  reason: BookReason;
};

/** Static partner data, sent once per response (not per fixture). */
export type PartnerDirEntry = {
  partner_id: string;
  name: string;
  logo: string;
  /** affiliate landing; null only where the partner has no geo-neutral link (BetWinner: resolve by geo) */
  url: string | null;
};

export function partnerDirectory(): PartnerDirEntry[] {
  return PARTNERS.map((p) => ({ partner_id: p.id, name: p.name, logo: p.logo, url: p.url ?? null }));
}

/** A partner shown with logo + «Odds on site» and no price (same on every fixture). */
export type OddsOnSitePartner = { partner_id: string; name: string; logo: string; url: string; reason: BookReason };

/**
 * Partners listed in the comparison without a price: no lawful feed (asked to
 * the partner) or region-restricted feed. Gated books (pending_approval) stay
 * out until the APPROVE; a partner without a geo-neutral link is dropped.
 */
export function oddsOnSitePartners(): OddsOnSitePartner[] {
  return PARTNERS.flatMap((p) => {
    const reason = NO_FEED[p.id];
    if (!p.url || (reason !== "awaiting_partner_feed" && reason !== "region_restricted")) return [];
    return [{ partner_id: p.id, name: p.name, logo: p.logo, url: p.url, reason }];
  });
}

/**
 * One entry per partner for a fixture — nobody hides a missing price.
 * `priced`: book key → source of the price shown on this fixture.
 * `down`: enabled books whose feed returned nothing and had no recent capture.
 * Order: books with a price first, then the rest; PARTNERS order inside each group.
 */
export function bookStatusFor(
  priced: Map<string, "live_feed" | "price_history">,
  down: Set<string>,
  env: Record<string, string | undefined> = process.env,
): BookStatus[] {
  const enabled = new Set(enabledPriceBooks(env).map((b) => PARTNER_ID_OF_BOOK[b.key] ?? b.key));
  const gated = new Set(ALL_GATED.map((b) => PARTNER_ID_OF_BOOK[b.key] ?? b.key));
  const out: BookStatus[] = PARTNERS.map((p) => {
    const bookKey = Object.keys(PARTNER_ID_OF_BOOK).find((k) => PARTNER_ID_OF_BOOK[k] === p.id);
    const src = bookKey ? priced.get(bookKey) : undefined;
    let reason: BookReason;
    if (src) reason = src;
    else if (bookKey && enabled.has(p.id)) reason = down.has(bookKey) ? "feed_down" : "not_listed";
    else if (gated.has(p.id)) reason = "pending_approval";
    else reason = NO_FEED[p.id] ?? "awaiting_partner_feed";
    return { partner_id: p.id, oddsAvailable: src != null, reason };
  });
  return [...out.filter((b) => b.oddsAvailable), ...out.filter((b) => !b.oddsAvailable)];
}
