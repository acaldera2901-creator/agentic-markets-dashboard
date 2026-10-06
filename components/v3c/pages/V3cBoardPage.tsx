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
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { Board } from "@/components/v3c/board/Board";
import { BoardFascia, FasciaMeta, FasciaMetaPending } from "@/components/v3c/board/BoardFascia";
import { BoardError, BoardSkeleton } from "@/components/v3c/board/BoardStates";
import { Bench } from "@/components/v3c/home/Bench";
import { Faq } from "@/components/v3c/home/Faq";
import { Yesterday } from "@/components/v3c/home/Yesterday";
import { getBoard, getYesterday, partnersAllowed } from "@/lib/v3c/board-data.server";
import type { V3BoardResponse, V3BookPrice } from "@/lib/v3c/contracts";
import { parseMode } from "@/lib/v3c/mode";
import { oddsOnSitePartners } from "@/lib/price-books";
import { packBoard } from "@/lib/v3c/board-pack";
import "@/components/v3c/partners.css";

type Surface = "home" | "predictions";

/** Home: le partite live e quelle delle prossime 36 ore bastano a righe, cascata e banco. */
const HOME_HORIZON_MS = 36 * 3_600_000;
const HOME_ROWS = 12;

/**
 * Il payload che va al browser: lo stesso contratto, senza ciò che la pagina non
 * mostra (model_p, notes, coverage.excluded, best_price duplicato — è il primo
 * di book_prices, già ordinati). Misurato: la board intera passava da ~800 KB di
 * HTML; la home riceve solo le partite live e delle prossime 36 ore.
 */
function forSurface(board: V3BoardResponse, surface: Surface, now: Date): V3BoardResponse {
  const until = now.getTime() + HOME_HORIZON_MS;
  // home: per ogni filtro sport bastano le prime HOME_ROWS righe (+ il gap più ampio di oggi per la cascata)
  const homeIds = surface === "home" ? homeCut(board, now) : null;
  const keep = (k: string, id: string) => surface === "predictions" || (Date.parse(k) <= until && (homeIds?.has(id) ?? true));
  const book = (b: V3BookPrice): V3BookPrice => ({ ...b, captured_at: "" });
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
    matches: board.matches.filter((m) => keep(m.kickoff, m.id)).map(noBooks).map((m) => ({ ...m, outcomes: m.outcomes.map((o) => ({ ...o, model_p: null, best_price: null, book_prices: o.book_prices.map(book) })) })),
    tennis: (board.tennis ?? []).filter((m) => keep(m.kickoff, `tn:${m.id}`)).map(noBooks).map((m) => ({ ...m, sides: m.sides.map((x) => ({ ...x, best_price: null, book_prices: x.book_prices.map(book) })) as typeof m.sides })),
  };
}

/** Gli id che la home spedisce: le prime righe di «tutti», «calcio», «tennis» e il gap più ampio di oggi (UTC). */
function homeCut(board: V3BoardResponse, now: Date): Set<string> {
  const open = (k: string) => Date.parse(k) > now.getTime() - 150 * 60_000;
  const fb = board.matches.filter((m) => open(m.kickoff)).map((m) => ({ id: m.id, k: m.kickoff }));
  const tn = (board.tennis ?? []).filter((m) => open(m.kickoff)).map((m) => ({ id: `tn:${m.id}`, k: m.kickoff }));
  const byTime = (a: { k: string }, b: { k: string }) => Date.parse(a.k) - Date.parse(b.k);
  const ids = new Set<string>();
  for (const list of [[...fb, ...tn].sort(byTime), fb.sort(byTime), tn.sort(byTime)]) for (const x of list.slice(0, HOME_ROWS)) ids.add(x.id);
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

function sportCounts(board: V3BoardResponse, now: Date) {
  const until = now.getTime() + HOME_HORIZON_MS;
  const open = (k: string) => Date.parse(k) > now.getTime() - 150 * 60_000 && Date.parse(k) <= until;
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

async function BoardBlock({ surface, nowIso }: { surface: Surface; nowIso: string }) {
  const [b, y, partners] = await Promise.all([getBoard(), getYesterday(), partnersAllowed()]);
  if (!b.ok) return <BoardError />;
  const board = forSurface(b.data, surface, new Date(nowIso));
  const yesterday = y.ok ? { day: y.data.day, football: y.data.football, tennis: y.data.tennis } : null;
  return <Board board={packBoard(board)} surface={surface} partners={partners} siteOnly={partners ? oddsOnSitePartners() : []} nowIso={nowIso} limit={surface === "home" ? HOME_ROWS : undefined} total={b.data.matches.length + (b.data.tennis?.length ?? 0)} counts={surface === "home" ? sportCounts(b.data, new Date(nowIso)) : undefined} yesterday={yesterday} />;
}

async function BenchBlock({ nowIso }: { nowIso: string }) {
  const b = await getBoard();
  // il banco usa una partita di calcio con mercato: solo quelle viaggiano fino al browser
  const matches = b.ok ? forSurface(b.data, "home", new Date(nowIso)).matches.filter((m) => m.margin_removed != null) : [];
  return <Bench matches={matches} nowIso={nowIso} />;
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
        <Suspense fallback={<BoardSkeleton rows={surface === "home" ? HOME_ROWS : 10} />}>
          <BoardBlock surface={surface} nowIso={nowIso} />
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
          </>
        ) : null}
      </main>
    </V3cChrome>
  );
}
