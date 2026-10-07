// components/v3c/pages/BooksPage.tsx (#REDESIGN-V3C F9 · filone pages) — /partners a flag acceso.
// Server: decide il gate geo (stessa lista e stessi header di /api/geo-books e
// della board), risolve i link affiliati del catalogo per il paese
// (lib/partners.ts → partnersFor: i link di tracciamento di sempre, nessuno
// inventato) e legge il confronto prezzi dalla STESSA funzione della board
// (getBoard). Dinamica per forza: dipende dal paese della richiesta.
import { connection } from "next/server";
import { headers } from "next/headers";
import { JsonLd, faqJsonLd } from "@/components/seo/json-ld";
import { BOOKS } from "@/lib/betconstruct-books";
import { PARTNERS, partnersFor } from "@/lib/partners";
import { getBoard, partnersAllowed } from "@/lib/v3c/board-data.server";
import { booksData } from "@/lib/v3c/books";
import { PARTNERS_SEO_FAQ } from "@/app/partners/seo";
import { V3cFrame } from "./Frame";
import { V3cBooks, type BookCard } from "./Books";

// Dal catalogo: chi non ha un `url` di default (oggi BetWinner) esiste solo nei paesi di geoUrls.
const PARTNER_NO_NEUTRAL = new Set(
  PARTNERS.filter((p) => !p.url).map((p) => p.id),
);

export async function V3cBooksPage() {
  await connection();
  // FAQPage JSON-LD dal server; la prosa la rende V3cBooks (stesso array) dentro la cornice.
  const ld = <JsonLd data={faqJsonLd(PARTNERS_SEO_FAQ, "en")} />;

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
  // ui2: TUTTI i partner del catalogo con la stessa card, in ordine alfabetico (neutro e dichiarato).
  // `live` = il book ha un feed di quote letto (lib/betconstruct-books BOOKS): solo questo cambia nella card.
  const feedKeys = new Set(BOOKS.map((b) => b.key));
  const cards: BookCard[] = partners
    .map((p) => {
      const localIn = p.geoUrls ? Object.keys(p.geoUrls) : null;
      const noNeutral = PARTNER_NO_NEUTRAL.has(p.id) && localIn;
      return {
        id: p.id,
        name: p.name,
        url: p.url,
        category: p.category,
        live: feedKeys.has(p.id),
        onlyIn: noNeutral ? localIn : null,
        localIn: noNeutral ? null : localIn,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const connected = cards.filter((c) => c.live);

  const b = await getBoard();
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
