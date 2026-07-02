// (#FORTUNEPLAY-LIVE-ODDS-1) Quote live FortunePlay + deep-link partita, indicizzate
// per team_pair_key. Un solo fetch lista server-side (TTL-cache 30s in
// fetchFortuneplayBoard). Mai una chiamata per-card. Degrada a {} su errore.
import { NextResponse } from "next/server";
import { mergeBooksToResponse } from "@/lib/fortuneplay-board";
import { fetchAllBooks } from "@/lib/betconstruct-feed";
import { FORTUNEPLAY_BET_URL } from "@/lib/affiliate";

export const dynamic = "force-dynamic"; // la funzione gira sempre fresca (no build-time fetch cache)

// #PERF-ODDS-0702: le quote sono GLOBALI (non per-utente) → cacheabili sull'edge.
// La CDN Vercel rispetta s-maxage anche su route dinamiche: serve SUBITO l'ultima
// risposta buona a tutti gli utenti (~edge, non 5-10s) e rivalida in background
// (stale-while-revalidate). Niente attesa del fetch upstream BetConstruct lato utente.
const ODDS_CACHE = "public, s-maxage=25, stale-while-revalidate=300";

// #MULTIBOOK-1: quote live da TUTTI i book BetConstruct (FortunePlay + YBets…),
// unite in best-odds per team_pair_key. Deep-link/attribuzione per-book (stag dal
// registry). Best-effort: un book down non rompe il resto (fetchAllBooks degrada).
export async function GET() {
  const boards = await fetchAllBooks();
  const odds = mergeBooksToResponse(boards, {
    locale: "it",
    landingUrl: FORTUNEPLAY_BET_URL,
  });
  return NextResponse.json({ odds }, { headers: { "Cache-Control": ODDS_CACHE } });
}
