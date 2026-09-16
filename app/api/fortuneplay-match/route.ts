// #FORTUNEPLAY-LIVE-ODDS-2 — GET /api/fortuneplay-match?id=<matchId>&book=<key>
// Tutti i mercati di una partita presso UN book BetConstruct, chiamato SOLO
// all'apertura della scheda (non per-card). TTL-cache per (book, match) lato lib.
// Degrada a [] su errore. `book` omesso/ignoto → book primario (retrocompatibile).
import { NextRequest, NextResponse } from "next/server";
import { fetchFortuneplayMatchMarkets, curateMarkets } from "@/lib/fortuneplay-match";
import { bookByKey, PRIMARY_BOOK } from "@/lib/betconstruct-books";
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";

export const dynamic = "force-dynamic";

// Stessa blocklist centrale e reversibile di /api/geo-books: oggi è vuota,
// in futuro un solo aggiornamento riallinea ogni consumer sportsbook.
function resolveCountry(req: NextRequest): string {
  return (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
}

export async function GET(req: NextRequest) {
  const idRaw = req.nextUrl.searchParams.get("id");
  const id = Number(idRaw);
  if (!idRaw || !Number.isFinite(id)) {
    return NextResponse.json({ markets: [] });
  }
  if (GEO_BLOCKED_COUNTRIES.has(resolveCountry(req))) {
    return NextResponse.json({ markets: [] });
  }
  // #YBETS-COVERAGE-0916: l'id vale solo dentro il feed che l'ha emesso. Una key
  // sconosciuta cade sul primario invece di rispondere 400: il peggio che può
  // fare è non trovare mercati, mentre un 400 romperebbe una scheda che oggi funziona.
  const book = bookByKey(req.nextUrl.searchParams.get("book") ?? "") ?? PRIMARY_BOOK;
  const all = await fetchFortuneplayMatchMarkets(id, book);
  return NextResponse.json({ markets: curateMarkets(all) });
}
