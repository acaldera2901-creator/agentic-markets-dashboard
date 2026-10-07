// /v3c/price-check — il price check del redesign (#REDESIGN-V3C F4).
// NON è un URL pubblico: con NEXT_PUBLIC_REDESIGN acceso next.config.ts
// riscrive "/price-check" qui. Spento, /price-check non esiste (404 di
// sempre) e questa risponde 404. È sia una voce del menu («Price») sia una
// riga dentro Tools (decisione di Andrea, PIANO-COSTRUZIONE §decisioni).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import "@/components/v3c/v3c.css";
import "@/components/v3c/match/match.css";
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { MatchError, MatchSkeleton } from "@/components/v3c/match/MatchStates";
import { PriceCheck, type PcMatch } from "@/components/v3c/match/PriceCheck";
import { getBoard, partnersAllowed, v3cProductOn } from "@/lib/v3c/board-data.server";
import type { V3BoardResponse } from "@/lib/v3c/contracts";
import { landingBookLinks } from "@/lib/v3c/match-links.server";
import { readBookLinks } from "@/lib/v3c/match-view";
import { parseMode } from "@/lib/v3c/mode";

export const metadata: Metadata = {
  title: "Price check: what does this price claim? | BetRedge",
  description: "Type your book’s prices: implied probability, the book’s margin, the market with the margin removed and our estimate next to it. Free.",
  alternates: { canonical: "/price-check" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Le partite non ancora iniziate con tutte le quote di mercato, in ordine di inizio: calcio (1X2, con la
 * stima 70/30) e tennis (vincente; tennis2: la stima basata su Elo — 0,1·Elo + 0,9·mercato, non sigillata — solo
 * dove estimate_kind è 'elo_blend_unsealed', altrimenti estimate_p null = solo mercato).
 */
function pcMatches(board: V3BoardResponse, now: Date, max = 80): PcMatch[] {
  const football: PcMatch[] = board.matches
    .filter((m) => Date.parse(m.kickoff) > now.getTime() && m.outcomes.length === 3 && m.outcomes.every((o) => o.market_price != null))
    .map((m) => ({
      id: m.id,
      sport: "football",
      home: m.home,
      away: m.away,
      kickoff: m.kickoff,
      league: m.competition || m.league,
      blend: m.blend != null,
      links: readBookLinks(m),
      // fixdata B5: the model sanity guard travels with the match (no EV/Kelly when it is not «ok»)
      guard: m.model_guard?.level ?? "ok",
      outcomes: m.outcomes.map((o) => ({ outcome: o.outcome, market_price: o.market_price, estimate_p: o.estimate_p, book_prices: o.book_prices })),
    }));
  const tennis: PcMatch[] = (board.tennis ?? [])
    .filter((m) => Date.parse(m.kickoff) > now.getTime() && m.sides.every((s) => s.market_price != null))
    .map((m) => ({
      id: m.id,
      sport: "tennis",
      home: m.player1,
      away: m.player2,
      kickoff: m.kickoff,
      league: m.tournament,
      blend: false,
      links: readBookLinks(m),
      tnElo: m.estimate_kind === "elo_blend_unsealed" && m.estimate_p != null,
      gapHidden: m.estimate_kind === "elo_blend_unsealed" && m.gap_visible !== true,
      outcomes: m.sides.map((s) => ({
        outcome: s.side === "p1" ? "home" : "away",
        market_price: s.market_price,
        estimate_p: m.estimate_kind === "elo_blend_unsealed" && m.estimate_p ? m.estimate_p[s.side] : null,
        book_prices: s.book_prices,
      })),
    }));
  const byKickoff = (a: PcMatch, b: PcMatch) => Date.parse(a.kickoff) - Date.parse(b.kickoff);
  // il calcio tiene le sue `max` righe di sempre; il tennis si aggiunge, non le toglie
  return [...football.sort(byKickoff).slice(0, max), ...tennis.sort(byKickoff).slice(0, Math.round(max / 2))].sort(byKickoff);
}

async function PcBody({ wanted }: { wanted: string | null }) {
  const [b, partners, landing] = await Promise.all([getBoard(), partnersAllowed(), landingBookLinks()]);
  if (!b.ok) return <MatchError />;
  const list = pcMatches(b.data, new Date());
  // ?m= dalla pagina partita; altrimenti la prima partita di calcio con un prezzo di un book connesso
  const initial = (wanted && list.find((m) => m.id === wanted)?.id) || list.find((m) => m.sport === "football" && m.outcomes.every((o) => o.book_prices.length))?.id || list.find((m) => m.sport === "football")?.id || list[0]?.id || null;
  return <PriceCheck matches={list} initialId={initial} partners={partners} landing={landing} />;
}

export default async function V3cPriceCheck({ searchParams }: Props) {
  if (!v3cProductOn()) notFound();
  await connection();
  const sp = await searchParams;
  const wanted = typeof sp.m === "string" && sp.m.length <= 200 ? sp.m : null;
  return (
    <V3cChrome initialMode={parseMode(sp.mode)} fontClass={v3cFontClass} current="price">
      <main className="v3c-wrap" id="main">
        <Suspense fallback={<MatchSkeleton label="pc" />}>
          <PcBody wanted={wanted} />
        </Suspense>
      </main>
    </V3cChrome>
  );
}
