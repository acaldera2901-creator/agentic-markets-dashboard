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
import "@/components/v3c/fixui.css";
import "@/components/v3c/match/match.css";
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { MatchError, MatchSkeleton } from "@/components/v3c/match/MatchStates";
import { PriceCheck, type PcMatch } from "@/components/v3c/match/PriceCheck";
import { getBoard, partnersAllowed, v3cProductOn } from "@/lib/v3c/board-data.server";
import type { V3BoardResponse } from "@/lib/v3c/contracts";
import { landingBookLinks } from "@/lib/v3c/match-links.server";
import { readBookLinks } from "@/lib/v3c/match-view";
import { estimateShown, resolveAlias } from "@/lib/v3c/fixdata2";
import { parseMode } from "@/lib/v3c/mode";
import { priceCheckInitial } from "@/lib/v3c/fixui2";

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
      // fixdata2 N3: no estimate travels when the board does not show one (no market, or its fair price far from the best)
      outcomes: m.outcomes.map((o) => ({ outcome: o.outcome, market_price: o.market_price, estimate_p: estimateShown(m) ? o.estimate_p : null, book_prices: o.book_prices })),
    }));
  const tennis: PcMatch[] = (board.tennis ?? [])
    // fixdata3 R3: a price that may be outdated (stored > 6 h ago, no book prices it now) is not checked against
    .filter((m) => Date.parse(m.kickoff) > now.getTime() && m.market_from !== "stale" && m.sides.every((s) => s.market_price != null))
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
  const now = new Date();
  const short = pcMatches(b.data, now);
  // fixdata2 N2: ?m= of a twin the board dropped opens the row the board kept
  const want = wanted ? resolveAlias(b.data.aliases, wanted) : null;
  // fixui2 N6: the match asked by ?m= is always in the list when the board can open it (a Saturday match sat
  // beyond the first 80 and the page opened another one in silence); otherwise the page opens empty and says so
  const all = want && !short.some((m) => m.id === want) ? pcMatches(b.data, now, Number.MAX_SAFE_INTEGER) : null;
  const extra = all?.find((m) => m.id === want);
  const list = extra ? [...short, extra].sort((a, c) => Date.parse(a.kickoff) - Date.parse(c.kickoff)) : short;
  // senza ?m=: la prima partita di calcio con un prezzo di un book connesso — fixui2 (N1): e non trattenuta dalla
  // protezione del modello (final6: né senza stima mostrata, fixdata2 N3), così l'esempio di apertura non è mai una partita senza EV/Kelly
  const ok = (m: PcMatch) => m.sport === "football" && (m.guard ?? "ok") === "ok" && m.outcomes.every((o) => o.estimate_p != null);
  const fallback = list.find((m) => ok(m) && m.outcomes.every((o) => o.book_prices.length))?.id || list.find((m) => m.sport === "football" && m.outcomes.every((o) => o.book_prices.length))?.id || list.find((m) => m.sport === "football")?.id || list[0]?.id || null;
  const init = priceCheckInitial(want, list.map((m) => m.id), fallback);
  return <PriceCheck matches={list} initialId={init.id} notListed={init.notListed} partners={partners} landing={landing} />;
}

export default async function V3cPriceCheck({ searchParams }: Props) {
  if (!v3cProductOn()) notFound();
  await connection();
  const sp = await searchParams;
  const wanted = typeof sp.m === "string" && sp.m.length <= 200 ? sp.m : null;
  return (
    <V3cChrome initialMode={parseMode(sp.mode)} fontClass={v3cFontClass} current="price">
      <main className="v3c-wrap" id="main">
        {/* fixui A8 (CLS 0,862 sulla preview): lo slot tiene almeno uno schermo mentre i dati arrivano,
            così lo scheletro → contenuto non sposta il piè dentro la finestra (fixui.css) */}
        <div className="v3c-pc-slot">
          <Suspense fallback={<MatchSkeleton label="pc" />}>
            <PcBody wanted={wanted} />
          </Suspense>
        </div>
      </main>
    </V3cChrome>
  );
}
