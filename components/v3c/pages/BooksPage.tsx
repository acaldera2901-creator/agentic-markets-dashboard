// components/v3c/pages/BooksPage.tsx (#REDESIGN-V3C F9 · filone pages) — /partners a flag acceso.
// Server: decide il gate geo (stessa lista e stessi header di /api/geo-books e
// della board), risolve i link affiliati del catalogo per il paese
// (lib/partners.ts → partnersFor: i link di tracciamento di sempre, nessuno
// inventato) e legge il confronto prezzi dalla STESSA funzione della board
// (getBoard). Dinamica per forza: dipende dal paese della richiesta.
import { connection } from "next/server";
import { headers } from "next/headers";
import { JsonLd, faqJsonLd } from "@/components/seo/json-ld";
import { PARTNERS, partnersFor } from "@/lib/partners";
import { enabledPriceBooks } from "@/lib/price-books";
import type { V3BoardResponse } from "@/lib/v3c/contracts";
import { getBoard, partnersAllowed } from "@/lib/v3c/board-data.server";
import { booksData } from "@/lib/v3c/books";
import { V3C_PARTNERS_FAQ } from "@/lib/v3c/partners-seo";
import { V3cFrame } from "./Frame";
import { V3cBooks, type BookCard } from "./Books";

// Dal catalogo: chi non ha un `url` di default (oggi BetWinner) esiste solo nei paesi di geoUrls.
const PARTNER_NO_NEUTRAL = new Set(
  PARTNERS.filter((p) => !p.url).map((p) => p.id),
);

/**
 * fixui A5: «Live prices on the board» vale per chi ha DAVVERO un prezzo sulla board
 * (books[].oddsAvailable su almeno una partita, la stessa copertura che la board mostra),
 * non per chi sta nella lista dei feed BetConstruct: Beazt, Wildz, RollXO e N1 hanno
 * prezzi live e la card diceva «Odds on partner site». Senza board (errore) si ripiega
 * sui book abilitati. `notes`: lo stato fisso di chi non può avere prezzi (hollywin
 * region_restricted, slotsbonus no_sportsbook), segnalato sulla card — la lista non cambia.
 */
function coverage(board: V3BoardResponse | null): { live: Set<string>; notes: Map<string, "region_restricted" | "no_sportsbook"> } {
  const live = new Set<string>();
  const notes = new Map<string, "region_restricted" | "no_sportsbook">();
  if (!board) {
    for (const b of enabledPriceBooks()) live.add(b.key);
    return { live, notes };
  }
  for (const m of [...board.matches, ...(board.tennis ?? [])]) {
    for (const b of m.books ?? []) {
      if (b.oddsAvailable) live.add(b.partner_id);
      else if (b.reason === "region_restricted" || b.reason === "no_sportsbook") notes.set(b.partner_id, b.reason);
    }
  }
  return { live, notes };
}

export async function V3cBooksPage() {
  await connection();
  // FAQPage JSON-LD dal server; la prosa la rende V3cBooks (stesso array) dentro la cornice.
  const ld = <JsonLd data={faqJsonLd(V3C_PARTNERS_FAQ, "en")} />;

  if (!(await partnersAllowed())) {
    return (
      <>
        {ld}
        <V3cFrame current="books">
          <V3cBooks
            blocked
            cards={[]}
            connected={[]}
            rows={[]}
            checkedAt={null}
          />
        </V3cFrame>
      </>
    );
  }

  const h = await headers();
  const country = (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
  const partners = partnersFor(country);
  const b = await getBoard();
  const cov = coverage(b.ok ? b.data : null);
  // ui2: TUTTI i partner del catalogo con la stessa card, in ordine alfabetico (neutro e dichiarato).
  // `live` = il partner ha un prezzo sulla board (fixui A5, sopra): solo questo cambia nella card.
  const cards: BookCard[] = partners
    .map((p) => {
      const localIn = p.geoUrls ? Object.keys(p.geoUrls) : null;
      const noNeutral = PARTNER_NO_NEUTRAL.has(p.id) && localIn;
      return {
        id: p.id,
        name: p.name,
        url: p.url,
        category: p.category,
        live: cov.live.has(p.id),
        note: cov.notes.get(p.id) ?? null,
        onlyIn: noNeutral ? localIn : null,
        localIn: noNeutral ? null : localIn,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const connected = cards.filter((c) => c.live);

  const data = b.ok ? booksData(b.data, new Date()) : null;

  return (
    <>
      {ld}
      <V3cFrame current="books">
        <V3cBooks
          blocked={false}
          cards={cards}
          connected={connected}
          rows={data?.rows ?? []}
          checkedAt={data?.checkedAt ?? null}
        />
      </V3cFrame>
    </>
  );
}
