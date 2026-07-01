// #FORTUNEPLAY-LIVE-ODDS-2 — GET /api/fortuneplay-match?id=<matchId>
// Tutti i mercati FortunePlay di una partita, chiamato SOLO all'apertura della
// scheda (non per-card). TTL-cache per match lato lib. Degrada a [] su errore.
import { NextRequest, NextResponse } from "next/server";
import { fetchFortuneplayMatchMarkets, curateMarkets } from "@/lib/fortuneplay-match";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const idRaw = req.nextUrl.searchParams.get("id");
  const id = Number(idRaw);
  if (!idRaw || !Number.isFinite(id)) {
    return NextResponse.json({ markets: [] });
  }
  const all = await fetchFortuneplayMatchMarkets(id);
  return NextResponse.json({ markets: curateMarkets(all) });
}
