// (#FORTUNEPLAY-LIVE-ODDS-1) Quote live FortunePlay + deep-link partita, indicizzate
// per team_pair_key. Un solo fetch lista server-side (TTL-cache 30s in
// fetchFortuneplayBoard). Mai una chiamata per-card. Degrada a {} su errore.
import { NextResponse } from "next/server";
import { fetchFortuneplayBoard } from "@/lib/fortuneplay-live";
import { boardToResponse } from "@/lib/fortuneplay-board";
import { FORTUNEPLAY_BET_URL } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

export async function GET() {
  const map = await fetchFortuneplayBoard();
  // #FIX-DEEPLINK-BASE-0701: la base del deep-link è SEMPRE il sito FortunePlay
  // (dove vivono le pagine-partita). NON usare SPORTSBOOK_FORTUNEPLAY_URL qui: era
  // impostata sullo short-link affiliate mediaroosters → produceva URL rotte tipo
  // mediaroosters.com/<code>/it/sports/... . Lo short-link mediaroosters è SOLO il
  // landing di fallback (FORTUNEPLAY_BET_URL), non una base a cui appendere path.
  const odds = boardToResponse(map, {
    baseUrl: "https://www.fortuneplay.com",
    locale: "it",
    code: process.env.SPORTSBOOK_FORTUNEPLAY_CODE || "",
    landingUrl: FORTUNEPLAY_BET_URL,
  });
  return NextResponse.json({ odds });
}
