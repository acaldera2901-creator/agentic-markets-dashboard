// (#FORTUNEPLAY-LIVE-ODDS-1) Quote live FortunePlay + deep-link partita, indicizzate
// per team_pair_key. Un solo fetch lista server-side (TTL-cache 30s in
// fetchFortuneplayBoard). Mai una chiamata per-card. Degrada a {} su errore.
import { NextRequest, NextResponse } from "next/server";
import { mergeBooksToResponse, type FpOddsEntry } from "@/lib/fortuneplay-board";
import { fetchAllBooks } from "@/lib/betconstruct-feed";
import { FORTUNEPLAY_BET_URL } from "@/lib/affiliate";

export const dynamic = "force-dynamic"; // la funzione gira sempre fresca (no build-time fetch cache)

// #PERF-ODDS-0702: le quote sono GLOBALI (non per-utente) → cacheabili sull'edge.
// La CDN Vercel rispetta s-maxage anche su route dinamiche: serve SUBITO l'ultima
// risposta buona a tutti gli utenti (~edge, non 5-10s) e rivalida in background
// (stale-while-revalidate). Niente attesa del fetch upstream BetConstruct lato utente.
const ODDS_CACHE = "public, s-maxage=25, stale-while-revalidate=300";

// #A2-B2 (Decreto Dignità, D.L. 87/2018 art.9): stessa risoluzione geo di
// /api/geo-books (header Vercel/Cloudflare, non falsificabile dal client). Hard-block
// a livello di SOURCE così ogni consumer (WcBoard, MatchDetailSheet, football board)
// non riceve MAI URL/quote FortunePlay per un viewer IT — non solo non le renderizza.
const GEO_BLOCKED_COUNTRIES = new Set(["IT"]);
function resolveCountry(req: NextRequest): string {
  return (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
}

// Svuota URL/quote per un viewer geo-bloccato. id/homeKey/awayKey restano (sono
// identificativi di match, non link/quote) così i consumer non crashano — stessa
// forma, valori azzerati.
function redactEntry(e: FpOddsEntry): FpOddsEntry {
  return {
    ...e,
    oddsHome: null,
    oddsDraw: null,
    oddsAway: null,
    totalLine: null,
    totalOver: null,
    totalUnder: null,
    matchUrl: "",
    prefilled: false,
    books: [],
    bestBook: { home: null, draw: null, away: null },
  };
}

// #MULTIBOOK-1: quote live da TUTTI i book BetConstruct (FortunePlay + YBets…),
// unite in best-odds per team_pair_key. Deep-link/attribuzione per-book (stag dal
// registry). Best-effort: un book down non rompe il resto (fetchAllBooks degrada).
export async function GET(req: NextRequest) {
  const boards = await fetchAllBooks();
  const odds = mergeBooksToResponse(boards, {
    locale: "it",
    landingUrl: FORTUNEPLAY_BET_URL,
  });
  const blocked = GEO_BLOCKED_COUNTRIES.has(resolveCountry(req));
  const payload = blocked
    ? Object.fromEntries(Object.entries(odds).map(([k, v]) => [k, redactEntry(v)]))
    : odds;
  const res = NextResponse.json({ odds: payload });
  res.headers.set("Cache-Control", ODDS_CACHE);
  // La risposta differisce per country → la cache CDN deve variare sullo stesso
  // header usato per risolverla, altrimenti un viewer IT potrebbe ricevere una
  // risposta cachata per un altro paese (bypass della redazione via cache condivisa).
  res.headers.set("Vary", "x-vercel-ip-country, cf-ipcountry");
  return res;
}
