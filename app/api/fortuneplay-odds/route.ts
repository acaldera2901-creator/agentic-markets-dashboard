// (#FORTUNEPLAY-LIVE-ODDS-1) Quote live FortunePlay + deep-link partita, indicizzate
// per team_pair_key. Un solo fetch lista server-side (TTL-cache 30s in
// fetchFortuneplayBoard). Mai una chiamata per-card. Degrada a {} su errore.
import { NextResponse } from "next/server";
import { mergeBooksToResponse } from "@/lib/fortuneplay-board";
import { fetchAllBooks } from "@/lib/betconstruct-feed";
import { FORTUNEPLAY_BET_URL } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

// #MULTIBOOK-1: quote live da TUTTI i book BetConstruct (FortunePlay + YBets…),
// unite in best-odds per team_pair_key. Deep-link/attribuzione per-book (stag dal
// registry). Best-effort: un book down non rompe il resto (fetchAllBooks degrada).
export async function GET() {
  const boards = await fetchAllBooks();
  const odds = mergeBooksToResponse(boards, {
    locale: "it",
    landingUrl: FORTUNEPLAY_BET_URL,
  });
  return NextResponse.json({ odds });
}
