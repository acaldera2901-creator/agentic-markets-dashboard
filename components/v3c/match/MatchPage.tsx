// components/v3c/match/MatchPage.tsx (#REDESIGN-V3C F4)
// La pagina partita lato server: la stessa board di /api/v3/board
// (getBoard, deduplicata per richiesta) e lo stesso storico di
// /api/v3/match/[id]/line-movement (buildLineMovement), senza giri HTTP. La
// cornice arriva subito; i passi in streaming dietro uno scheletro con la
// geometria della pagina. Montata SOLO a flag acceso (app/v3c/match/[id]).
import { Suspense } from "react";
import "@/components/v3c/v3c.css";
import "./match.css";
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { getBoard, partnersAllowed } from "@/lib/v3c/board-data.server";
import type { V3BoardResponse, V3LineSeries } from "@/lib/v3c/contracts";
import { buildLineMovement, isTennisId, type Fixture } from "@/lib/v3c/line-movement-service";
import { landingBookLinks } from "@/lib/v3c/match-links.server";
import { findMatch, leadOutcome, readLineEvents } from "@/lib/v3c/match-view";
import type { V3cMode } from "@/lib/v3c/mode";
import { MatchError, MatchSkeleton } from "./MatchStates";
import { MatchView, type MoreRow } from "./MatchView";
import { boardTapes } from "@/lib/v3c/tape-data.server";
import { newsEnabled, newsForMatch, type NewsCard } from "@/lib/v3c/news/news.server";

/** Le prossime partite di calcio (non questa), per «More on today’s board». */
async function moreRows(board: V3BoardResponse, id: string, now: Date, n = 3): Promise<MoreRow[]> {
  const list = board.matches
    .filter((m) => m.id !== id && Date.parse(m.kickoff) > now.getTime())
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
    .slice(0, n);
  // fidelity: le righe come sulla board (prototipo): esito guida, prezzo, mercato, stima e il tape vero
  const tapes = await boardTapes(list, []);
  return list.map((m) => {
    const lead = leadOutcome(m);
    return {
      id: m.id, home: m.home, away: m.away, kickoff: m.kickoff, league: m.competition || m.league, gap: lead.edge_pp,
      lead: lead.outcome, price: lead.market_price, market: lead.market_p, estimate: lead.estimate_p, tape: tapes[m.id],
    };
  });
}

async function MatchBody({ id, fixture }: { id: string; fixture: Fixture | null }) {
  const now = new Date();
  const [b, partners, links] = await Promise.all([getBoard(), partnersAllowed(), landingBookLinks()]);
  let series: V3LineSeries[] | null = null;
  let events: ReturnType<typeof readLineEvents> = [];
  try {
    const lm = await buildLineMovement(id, now, fixture);
    // la pagina disegna 1X2 e ML; le serie AH restano nell'endpoint
    series = lm ? lm.series.filter((s) => s.market !== "AH") : [];
    events = readLineEvents(lm);
  } catch (e) {
    console.error("[v3c/match line-movement]", String(e));
    series = null;
  }
  if (!b.ok) return <MatchError />;
  const found = findMatch(b.data, id);
  const more = await moreRows(b.data, id, now);
  // #REDESIGN-V3C news: notes naming either team (football only; NEWS_FOTMOB_ENABLED). On the
  // chart they are a «news at hh:mm» mark labelled with the source; never a cause.
  let news: NewsCard[] = [];
  if (found?.sport === "football" && newsEnabled()) {
    news = await newsForMatch(found.m.home, found.m.away);
    events = [...events, ...news.map((n) => ({ t: n.t, label: n.source, url: n.url }))].sort((a, b) => a.t - b.t);
  }
  if (found?.sport === "football") return <MatchView kind="football" m={found.m} series={series} events={events} partners={partners} links={links} more={more} news={news} />;
  if (found?.sport === "tennis") return <MatchView kind="tennis" m={found.m} series={series} events={events} partners={partners} links={links} more={more} />;
  if (!fixture) return <MatchError />;
  return <MatchView kind="off" id={id} sport={isTennisId(id) ? "tennis" : "football"} home={fixture.home} away={fixture.away} kickoff={new Date(fixture.kickoff).toISOString()} series={series} events={events} more={more} />;
}

export function V3cMatchPage({ id, fixture, mode }: { id: string; fixture: Fixture | null; mode: V3cMode }) {
  return (
    <V3cChrome initialMode={mode} fontClass={v3cFontClass} current="board">
      <main className="v3c-wrap" id="main">
        <Suspense fallback={<MatchSkeleton sport={isTennisId(id) ? "tennis" : "football"} />}>
          <MatchBody id={id} fixture={fixture} />
        </Suspense>
      </main>
    </V3cChrome>
  );
}
