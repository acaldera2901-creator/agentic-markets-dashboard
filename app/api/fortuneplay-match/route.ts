// #FORTUNEPLAY-LIVE-ODDS-2 — GET /api/fortuneplay-match?id=<matchId>
// Tutti i mercati FortunePlay di una partita, chiamato SOLO all'apertura della
// scheda (non per-card). TTL-cache per match lato lib. Degrada a [] su errore.
import { NextRequest, NextResponse } from "next/server";
import { fetchFortuneplayMatchMarkets, curateMarkets } from "@/lib/fortuneplay-match";
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";

export const dynamic = "force-dynamic";

// #A2-B2 (Decreto Dignità, D.L. 87/2018 art.9): stessa risoluzione geo di
// /api/geo-books (header Vercel/Cloudflare, non falsificabile dal client). Hard-block
// a livello di SOURCE così ogni consumer (es. MatchDetailSheet) non riceve MAI le
// quote FortunePlay per un viewer bloccato.
//
// #CH01-P0-ADSPOLICY-0814: era un set LOCALE con dentro solo "IT" (vedi la nota
// gemella in /api/fortuneplay-odds). Ora arriva dalla costante condivisa, importata
// in testa al file.
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
  const all = await fetchFortuneplayMatchMarkets(id);
  return NextResponse.json({ markets: curateMarkets(all) });
}
