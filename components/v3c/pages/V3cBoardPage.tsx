// components/v3c/pages/V3cBoardPage.tsx (#REDESIGN-V3C F3)
// Le due pagine di prodotto del redesign, lato server:
//   home "/"         = fascia + board (le prossime righe) + banco tool + «Ieri» + FAQ
//   "/predictions"   = fascia + board intera con i filtri sport · campionato · giorno
// I dati sono quelli di GET /api/v3/board e /api/v3/yesterday, dalla stessa
// funzione (board-data.server.ts). Il titolo della fascia non aspetta il DB
// (LCP); righe, meta e «Ieri» arrivano in streaming dietro uno scheletro.
// La pagina viene montata SOLO a flag acceso (app/page.tsx, app/predictions).
import { Suspense } from "react";
import { connection } from "next/server";
import "@/components/v3c/v3c.css";
import "@/components/v3c/fixui.css";
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { Board } from "@/components/v3c/board/Board";
import { BoardFascia, FasciaMeta, FasciaMetaPending } from "@/components/v3c/board/BoardFascia";
import { BoardError, BoardSkeleton } from "@/components/v3c/board/BoardStates";
import { Bench } from "@/components/v3c/home/Bench";
import { Faq } from "@/components/v3c/home/Faq";
import { Yesterday } from "@/components/v3c/home/Yesterday";
import { liveSeed } from "@/lib/v3c/live-service.server";
import { getBoard, getYesterday, partnersAllowed } from "@/lib/v3c/board-data.server";
import type { V3BoardResponse, V3BookPrice } from "@/lib/v3c/contracts";
import { parseMode } from "@/lib/v3c/mode";
import { oddsOnSitePartners } from "@/lib/price-books";
import { packBoard } from "@/lib/v3c/board-pack";
import { boardTapes } from "@/lib/v3c/tape-data.server";
import "@/components/v3c/partners.css";
import { ColourBanner } from "@/components/v3c/banners/ColourBanner";
import { leadOutcome, liveState, pctInt } from "@/lib/v3c/board-view";
import { byRelevance, hasStarted, valueToolsAllowed } from "@/lib/v3c/fixdata";
import { wantsLive } from "@/lib/v3c/live-view";
import { exampleEligible } from "@/lib/v3c/fixui2";
import { estimateShown } from "@/lib/v3c/fixdata2";
import { matchHref } from "@/lib/v3c/match-view";
import { HeroExample, type HeroExampleData } from "@/components/v3c/guide/HeroExample";

type Surface = "home" | "predictions";

/**
 * Home: le prime righe di ciascun filtro sport, su TUTTA la finestra della board.
 * live: prima c'era un orizzonte di 36 ore, e nei giorni senza calcio (martedì,
 * pause per le nazionali) il chip «Football» diceva 7 su 213 — Andrea, 06/10:
 * il redesign mostra tutte le partite a tutti finché F8 non decide cosa compra Pro.
 */
const HOME_ROWS = 12;
/** Una partita resta sulla board fino a 150 minuti dopo il calcio d'inizio (finestra live). */
const OPEN_AFTER_KICKOFF_MS = 150 * 60_000;

/**
 * Il payload che va al browser: lo stesso contratto, senza ciò che la pagina non
 * mostra (model_p, notes, coverage.excluded, best_price duplicato — è il primo
 * di book_prices, già ordinati). Misurato: la board intera passava da ~800 KB di
 * HTML; la home riceve solo le prime righe di ciascun filtro sport.
 */
function forSurface(board: V3BoardResponse, surface: Surface, now: Date): V3BoardResponse {
  // home: per ogni filtro sport bastano le prime HOME_ROWS righe (+ il gap più ampio di oggi per la cascata)
  const homeIds = surface === "home" ? homeCut(board, now) : null;
  const keep = (id: string) => surface === "predictions" || (homeIds?.has(id) ?? true);
  // fixdata B2: the capture time travels with the first (best) price of each list — the row and its CTA say «price at hh:mm»
  const book = (b: V3BookPrice, i: number): V3BookPrice => (i === 0 ? b : { ...b, captured_at: "" });
  // F7: `books` (per-partner status) and `partners` are API-only until the UI
  // renders them — 15 entries × every row would add ~300 KB of HTML here.
  const { partners: _partners, ...rest } = board;
  void _partners;
  const noBooks = <T extends { books?: unknown }>(x: T): Omit<T, "books"> => {
    const { books: _b, ...r } = x;
    void _b;
    return r;
  };
  return {
    ...rest,
    notes: [],
    coverage: { ...board.coverage, excluded: [] },
    matches: board.matches.filter((m) => keep(m.id)).map(noBooks).map((m) => ({ ...m, outcomes: m.outcomes.map((o) => ({ ...o, model_p: null, best_price: null, book_prices: o.book_prices.map(book) })) })),
    tennis: (board.tennis ?? []).filter((m) => keep(`tn:${m.id}`)).map(noBooks).map((m) => ({ ...m, sides: m.sides.map((x) => ({ ...x, best_price: null, book_prices: x.book_prices.map(book) })) as typeof m.sides })),
  };
}

/**
 * Gli id che la home spedisce: le prime righe di «tutti», «calcio», «tennis» e il gap più ampio di oggi (UTC).
 * fixdata B1: solo partite non ancora iniziate (quelle iniziate stanno in «Live now»), scelte col criterio
 * dichiarato in pagina — livello di rilevanza (top campionati, ATP/WTA, altro calcio, altro tennis), poi orario:
 * lo stesso ordinamento del client (Board.tsx), quindi la home mostra esattamente le righe spedite.
 */
function homeCut(board: V3BoardResponse, now: Date): Set<string> {
  const open = (k: string) => Date.parse(k) > now.getTime() - OPEN_AFTER_KICKOFF_MS;
  const upcoming = (k: string) => !hasStarted(k, now);
  const fb = board.matches.filter((m) => upcoming(m.kickoff)).map((m) => ({ id: m.id, rid: m.id, kickoff: m.kickoff, relevance: m.relevance }));
  const tn = (board.tennis ?? []).filter((m) => upcoming(m.kickoff)).map((m) => ({ id: m.id, rid: `tn:${m.id}`, kickoff: m.kickoff, relevance: m.relevance }));
  const ids = new Set<string>();
  for (const list of [[...fb, ...tn].sort(byRelevance), fb.sort(byRelevance), tn.sort(byRelevance)]) for (const x of list.slice(0, HOME_ROWS)) ids.add(x.rid);
  const today = now.toISOString().slice(0, 10);
  let best: { id: string; g: number } | null = null;
  for (const m of board.matches) {
    if (m.kickoff.slice(0, 10) !== today || !open(m.kickoff)) continue;
    const g = Math.max(0, ...m.outcomes.map((o) => Math.abs(o.edge_pp ?? 0)));
    if (g > 0 && (!best || g > best.g)) best = { id: m.id, g };
  }
  if (best) ids.add(best.id);
  return ids;
}

/** I chip della home contano tutta la finestra (le stesse righe di /predictions), escluse le partite già finite. */
function sportCounts(board: V3BoardResponse, now: Date) {
  const open = (k: string) => Date.parse(k) > now.getTime() - OPEN_AFTER_KICKOFF_MS;
  const football = board.matches.filter((m) => open(m.kickoff)).length;
  const tennis = (board.tennis ?? []).filter((m) => open(m.kickoff)).length;
  return { all: football + tennis, football, tennis };
}

async function MetaBlock() {
  const b = await getBoard();
  if (!b.ok) return <FasciaMeta facts={null} />;
  const all = [...b.data.matches, ...(b.data.tennis ?? [])];
  return <FasciaMeta facts={{ n: all.length, sealed: all.filter((m) => m.sealed_at).length, generatedAt: b.data.generated_at, windowDays: b.data.window_days }} />;
}

/** final3: /predictions?sport=tennis|football apre la board su quello sport (i banner Tennis/Calcio); ogni altro valore = tutti. */
function parseSport(v: string | string[] | undefined): "football" | "tennis" | undefined {
  return v === "tennis" || v === "football" ? v : undefined;
}

async function BoardBlock({ surface, nowIso, sport }: { surface: Surface; nowIso: string; sport?: "football" | "tennis" }) {
  const [b, y, partners] = await Promise.all([getBoard(), getYesterday(), partnersAllowed()]);
  if (!b.ok) return <BoardError />;
  const board = forSurface(b.data, surface, new Date(nowIso));
  // final2: the first live read on the server (only around kick-off, ≤ SEED_WAIT_MS): «Live now» and the row scores are in the HTML, no CLS
  // fixdata A3: the WHOLE board decides whether to read live scores (the home ships only its next rows, none started)
  const kickoffs = [...b.data.matches.map((m) => m.kickoff), ...(b.data.tennis ?? []).map((m) => m.kickoff)];
  const liveFirst = await liveSeed(kickoffs, new Date(nowIso));
  const liveHint = kickoffs.some((k) => wantsLive(k, new Date(nowIso)));
  const yesterday = y.ok ? { day: y.data.day, football: y.data.football, tennis: y.data.tennis } : null;
  // fidelity: il tape «open → now» di ogni riga, dai dati veri (partner_price_history)
  const tapes = await boardTapes(board.matches, board.tennis ?? []);
  return <Board tapes={tapes} board={packBoard(board)} surface={surface} partners={partners} siteOnly={partners ? oddsOnSitePartners() : []} nowIso={nowIso} limit={surface === "home" ? HOME_ROWS : undefined} total={b.data.matches.length + (b.data.tennis?.length ?? 0)} counts={surface === "home" ? sportCounts(b.data, new Date(nowIso)) : undefined} yesterday={yesterday} liveSeed={liveFirst} initialFilters={sport ? { sport } : undefined} liveHint={liveHint} />;
}

async function BenchBlock({ nowIso }: { nowIso: string }) {
  const b = await getBoard();
  // il banco usa una partita di calcio con mercato: solo quelle viaggiano fino al browser
  // fixdata2 N1/N3 + fixui2 N1: a guarded, estimate-less or started match never travels to the bench (no EV/Kelly of a match the guard holds back)
  const matches = b.ok ? exampleEligible(forSurface(b.data, "home", new Date(nowIso)).matches, new Date(nowIso)).filter(estimateShown) : [];
  return <Bench matches={matches} nowIso={nowIso} />;
}

/**
 * final3: il solo banner colore della home (README §3b), in fondo, oltre uno schermo dalle chip partner
 * della board (misurato: 1500 px a 1440, 2100 a 390): Live se una partita è davvero in corso
 * (porta al gruppo live di /predictions, #live), altrimenti Record (il fondo Codex, unico GEN).
 * Stessa geometria nei due casi: lo scheletro è il banner Record, nessuno spostamento.
 */
async function HomeBannerBlock({ nowIso }: { nowIso: string }) {
  const b = await getBoard();
  const now = new Date(nowIso);
  const live = b.ok && [...b.data.matches, ...(b.data.tennis ?? [])].some((m) => liveState(m.kickoff, now).live);
  return live ? <ColourBanner theme="live" /> : <ColourBanner theme="record" gen />;
}

/**
 * fixui A1: la partita d'esempio sotto la frase della home. Una partita di calcio VERA della board,
 * non ancora iniziata, con mercato e stima: la prima di oggi (UTC, come il taglio della home),
 * altrimenti la prossima. Stessi numeri della riga (pctInt, edge_pp, esito guida).
 */
async function HeroExampleBlock({ nowIso }: { nowIso: string }) {
  const b = await getBoard();
  if (!b.ok) return <HeroExample d={null} />;
  const now = Date.parse(nowIso);
  const today = nowIso.slice(0, 10);
  const ok = b.data.matches
    // final5 (fixdata B1/B5): only a match not started, and never one the model guard holds back
    .filter((m) => !hasStarted(m.kickoff, new Date(now)) && valueToolsAllowed(m) && m.margin_removed != null)
    .map((m) => ({ m, o: leadOutcome(m) }))
    .filter(({ o }) => o.market_price != null && o.market_p != null)
    .sort((a, c) => Date.parse(a.m.kickoff) - Date.parse(c.m.kickoff));
  const pick = ok.find(({ m }) => m.kickoff.slice(0, 10) === today) ?? ok[0];
  if (!pick) return <HeroExample d={null} />;
  const { m, o } = pick;
  const d: HeroExampleData = {
    href: matchHref(m.id),
    home: m.home,
    away: m.away,
    outcome: o.outcome,
    price: o.market_price as number,
    market: Number(pctInt(o.market_p)),
    estimate: Number(pctInt(o.estimate_p)),
    gap: o.edge_pp,
    today: m.kickoff.slice(0, 10) === today,
  };
  return <HeroExample d={d} />;
}

async function YesterdayBlock() {
  const y = await getYesterday();
  return <Yesterday data={y.ok ? y.data : null} />;
}

export async function V3cBoardPage({ surface, searchParams }: { surface: Surface; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // per-richiesta: dati live, nessun prerender della board
  const sp = await searchParams;
  const nowIso = new Date().toISOString();
  return (
    <V3cChrome initialMode={parseMode(sp.mode)} fontClass={v3cFontClass} current="board">
      <main className="v3c-wrap" id="main">
        <BoardFascia
          surface={surface}
          nowIso={nowIso}
          meta={
            <Suspense fallback={<FasciaMetaPending />}>
              <MetaBlock />
            </Suspense>
          }
        />
        {surface === "home" ? (
          <Suspense fallback={<HeroExample d={null} />}>
            <HeroExampleBlock nowIso={nowIso} />
          </Suspense>
        ) : null}
        <Suspense fallback={<BoardSkeleton rows={surface === "home" ? HOME_ROWS : 10} />}>
          <BoardBlock surface={surface} nowIso={nowIso} sport={surface === "predictions" ? parseSport(sp.sport) : undefined} />
        </Suspense>
        {surface === "home" ? (
          <>
            <Suspense fallback={null}>
              <BenchBlock nowIso={nowIso} />
            </Suspense>
            <Suspense fallback={null}>
              <YesterdayBlock />
            </Suspense>
            <Faq />
            <Suspense fallback={<ColourBanner theme="record" gen />}>
              <HomeBannerBlock nowIso={nowIso} />
            </Suspense>
          </>
        ) : null}
      </main>
    </V3cChrome>
  );
}
