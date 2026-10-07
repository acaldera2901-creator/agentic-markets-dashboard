"use client";
// components/v3c/board/Board.tsx (#REDESIGN-V3C F3)
// La board: filtri (sport · campionato · giorno), righe raggruppate per giorno,
// stato vuoto a cascata. Riceve il payload di /api/v3/board già pronto dal
// server (stessa funzione dell'endpoint) e decide solo cosa si vede.
//
// Home: le prossime righe e il link alla board intera; filtro sport soltanto.
// /predictions: tutte le righe e i tre filtri.
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { V3BoardResponse, V3DaySummary } from "@/lib/v3c/contracts";
import {
  DEFAULT_FILTERS,
  applyFilters,
  countdown,
  dayKey,
  dayShort,
  daysOf,
  emptyCascade,
  footballRows,
  gapText,
  groupByDay,
  dayLong,
  leaguesOf,
  leagueOf,
  liveState,
  matchTitle,
  sidesOf,
  outcomeLabel,
  tennisRows,
  type BoardFilters,
  type BoardRowVM,
  type TennisRowVM,
} from "@/lib/v3c/board-view";
import { useLocalTimeZone, useV3cCopy } from "@/lib/v3c/lang.client";
import type { OddsOnSitePartner } from "@/lib/price-books";
import { isPacked, unpackBoard, type PackedBoard } from "@/lib/v3c/board-pack";
import { KitIcon } from "../Monogramma";
import { StateArt } from "../States";
import { FootballRow, TennisRow } from "./BoardRow";
import type { RowTape } from "@/lib/v3c/tape";
import { TAPE_HOURS } from "@/lib/v3c/tape";
import "../fidelity.css";
import { v3cLang, v3cLocale } from "@/lib/v3c/copy";
import { liveCopyFor } from "@/lib/v3c/live-copy";
import { wantsLive } from "@/lib/v3c/live-view";
import type { V3LiveResponse } from "@/lib/v3c/live-contract";
import { useLiveScores } from "../live/useLiveScores";
import { LiveAnnouncer, LiveNow } from "../live/LiveBits";

type Props = {
  /** polish: il server spedisce la board compatta (lib/v3c/board-pack), qui torna identica */
  board: V3BoardResponse | PackedBoard;
  surface: "home" | "predictions";
  partners: boolean;
  /** F7: partner senza quota letta (logo + «Odds on partner site»), uguali per ogni partita */
  siteOnly?: OddsOnSitePartner[];
  /** l'ora del server: il primo render usa questa, poi il client avanza ogni minuto */
  nowIso: string;
  /** home: quante righe mostrare prima del link alla board intera */
  limit?: number;
  /** home: i conteggi per sport di tutta la finestra (la home spedisce solo le prime righe di ciascuno) */
  counts?: { all: number; football: number; tennis: number };
  /** home: quante partite ha la board intera (il link lo dice; la home riceve solo le prime righe) */
  total?: number;
  /** solo /dev/ds: parte da un filtro dato per mostrare lo stato vuoto */
  initialFilters?: Partial<BoardFilters>;
  /** solo /dev/ds: l'ora resta quella del payload d'esempio */
  frozenNow?: boolean;
  /** final2: the server's first live read (lib/v3c/live-service.server.ts liveSeed): no shift when the first poll lands */
  liveSeed?: V3LiveResponse | null;
  /** la revisione di ieri, ultimo gradino della cascata */
  yesterday: { day: string; football: V3DaySummary; tennis: V3DaySummary } | null;
  /** fidelity: il tape «open → now» per id partita (solo le righe con ≥ 2 catture vere) */
  tapes?: Record<string, RowTape>;
};

type Row = BoardRowVM | TennisRowVM;

/**
 * /predictions mostra tutte le partite, ma ne monta un blocco alla volta: ~3,6 KB di
 * HTML per riga × ~400 righe vere farebbero ~1,4 MB solo di board. Le altre sono a un
 * tocco («Mostra altre N»), i chip giorno dicono quante sono per giorno.
 */
export const BOARD_PAGE_ROWS = 60;

// L'ora della board, al minuto: il server scrive la sua, il client avanza da solo
// (store esterno = il tempo, nessun setState dentro un effetto). frozen = /dev/ds.
function useNow(initialIso: string, frozen = false): Date {
  const serverMin = Math.floor(Date.parse(initialIso) / 60_000);
  const min = useSyncExternalStore(
    (cb) => {
      if (frozen) return () => {};
      const id = window.setInterval(cb, 30_000);
      return () => window.clearInterval(id);
    },
    () => (frozen ? serverMin : Math.floor(Date.now() / 60_000)),
    () => serverMin,
  );
  return useMemo(() => new Date(min * 60_000), [min]);
}

export function Board({ board: boardIn, surface, partners, siteOnly, nowIso, limit, total, counts, yesterday, initialFilters, frozenNow, tapes, liveSeed = null }: Props) {
  const { lang, t } = useV3cCopy();
  const board = useMemo(() => (isPacked(boardIn) ? unpackBoard(boardIn) : boardIn), [boardIn]);
  const locale = v3cLocale(lang);
  const tz = useLocalTimeZone();
  const now = useNow(nowIso, frozenNow);
  // live: /predictions apre su «Tutti i giorni» — tutte le partite, le imminenti prima, raggruppate per
  // giorno (prima apriva sul primo giorno con partite: in un martedì senza calcio erano 7 su 213).
  // Il filtro giorno resta a un tocco. La home mostra le prossime righe, senza filtro giorno.
  const initial: BoardFilters = { ...DEFAULT_FILTERS, ...initialFilters };
  const [filters, setFilters] = useState<BoardFilters>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pages, setPages] = useState(1);

  // Le righe: le partite già finite (oltre la finestra live) restano fuori anche se il payload le porta ancora.
  const all: Row[] = useMemo(() => {
    const rows: Row[] = [...footballRows(board.matches, tz), ...tennisRows(board.tennis ?? [], tz)];
    return rows.sort((a, b) => Date.parse(a.m.kickoff) - Date.parse(b.m.kickoff) || a.m.id.localeCompare(b.m.id));
  }, [board, tz]);

  // livescores: GET /api/v3/live solo se c'è una partita intorno al calcio d'inizio (e mai su /dev/ds)
  const lc = liveCopyFor(lang);
  const liveOn = !frozenNow && all.some((r) => wantsLive(r.m.kickoff, now));
  const names = useMemo(() => new Map(all.map((r) => [r.m.id, sidesOf(r.m)] as const)), [all]);
  const live = useLiveScores(liveOn, (id) => names.get(id) ?? null, lc, liveSeed);

  const today = dayKey(now.toISOString(), tz);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000).toISOString(), tz);
  const bySport = useMemo(() => applyFilters(all, { ...DEFAULT_FILTERS, sport: filters.sport }), [all, filters.sport]);
  // «next» = il primo giorno che ha righe nello sport scelto, risolto qui perché il fuso arriva dopo il mount
  const effective: BoardFilters = useMemo(
    () => {
      if (filters.day !== "next") return filters;
      const ds = daysOf(bySport);
      return { ...filters, day: (ds.find((d) => d.day >= today) ?? ds[0])?.day ?? "all" };
    },
    [filters, bySport, today],
  );
  // «Oggi» comprende le partite ancora in corso iniziate ieri sera (ora locale)
  const filtered = useMemo(() => {
    const rows = applyFilters(all, effective);
    if (effective.day !== today) return rows;
    const live = applyFilters(all, { ...effective, day: "all" }).filter((r) => r.day < today && liveState(r.m.kickoff, now).live);
    return [...live, ...rows];
  }, [all, effective, today, now]);
  const visible = limit ?? pages * BOARD_PAGE_ROWS;
  const shown = filtered.slice(0, visible);
  const more = Math.min(BOARD_PAGE_ROWS, filtered.length - shown.length);
  // le partite in corso stanno in testa, in un gruppo loro: «ieri sera» non è un giorno della board
  const liveRows = shown.filter((r) => liveState(r.m.kickoff, now).live);
  const groups = [
    ...(liveRows.length ? [{ day: "live", rows: liveRows }] : []),
    ...groupByDay(shown.filter((r) => !liveState(r.m.kickoff, now).live)),
  ];
  const nFootball = all.filter((r) => r.kind === "football").length;
  const nTennis = all.length - nFootball;

  const set = (patch: Partial<BoardFilters>) => {
    setOpenId(null);
    setPages(1);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const dayName = (d: string) => (d === "live" ? t.board.liveGroup : d === today ? t.toolbar.today : d === tomorrow ? t.toolbar.tomorrow : dayShort(`${d}T12:00:00Z`, "UTC", locale));

  return (
    <div className="v3c-board-w" data-surface={surface}>
      {surface === "home" && live.loaded ? (
        <LiveNow
          c={lc}
          feed={live}
          rows={all.map((r) => ({ id: r.m.id, sport: r.kind, home: sidesOf(r.m)[0], away: sidesOf(r.m)[1], league: r.kind === "football" ? leagueOf(r.m) : r.m.tournament }))}
        />
      ) : null}
      <LiveAnnouncer text={live.announce} />
      <div className="v3c-toolbar">
        <div className="v3c-chips" role="group" aria-label={t.toolbar.sport}>
          {(
            [
              ["all", t.toolbar.all, counts?.all ?? all.length],
              ["football", t.toolbar.football, counts?.football ?? nFootball],
              ["tennis", t.toolbar.tennis, counts?.tennis ?? nTennis],
            ] as const
          ).map(([k, label, n]) => (
            <button key={k} type="button" className="v3c-chip" aria-pressed={filters.sport === k} onClick={() => set({ sport: k, league: null, day: "all" })}>
              {k !== "all" ? <KitIcon name={k} className="v3c-ico-chip" /> : null}
              {label} <small>{n}</small>
            </button>
          ))}
        </div>
        {surface === "predictions" ? (
          <div className="v3c-filters-2">
            <div className="v3c-chips v3c-days" role="group" aria-label={t.toolbar.day}>
              <button type="button" className="v3c-chip" aria-pressed={effective.day === "all"} onClick={() => set({ day: "all" })}>
                {t.toolbar.allDays}
              </button>
              {daysOf(bySport).map(({ day, n }) => (
                <button key={day} type="button" className="v3c-chip" aria-pressed={effective.day === day} onClick={() => set({ day })}>
                  {dayName(day)} <small>{n}</small>
                </button>
              ))}
            </div>
            <label className="v3c-select">
              <span className="v3c-lab">{t.toolbar.league}</span>
              <select value={filters.league ?? ""} onChange={(e) => set({ league: e.target.value || null })}>
                <option value="">{t.toolbar.allLeagues}</option>
                {leaguesOf(bySport).map(({ league, n }) => (
                  <option key={league} value={league}>
                    {league} ({n})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {/* ui3: nel tennis non diamo la stima — la legenda parla di stima e gap solo dove c'è il calcio */}
        <p className="v3c-explain v3c-legend">
          <span>
            <i className="v3c-key v3c-key-m" aria-hidden="true" />
            {t.toolbar.legendMarket}
          </span>
          {filters.sport !== "tennis" ? (
            <>
              <span>
                <i className="v3c-key v3c-key-e" aria-hidden="true" />
                {t.toolbar.legendEstimate}
              </span>
              <span>{t.toolbar.legendGap}</span>
            </>
          ) : null}
          {filters.sport !== "football" ? <span>{t.toolbar.legendTennis}</span> : null}
        </p>
      </div>

      <section className="v3c-board" aria-label={t.board.label}>
        <div className="v3c-board-h" aria-hidden="true" lang={v3cLang(lang)}>
          <span className="v3c-lab">{t.board.kickoff}</span>
          <span className="v3c-lab">{t.board.match}</span>
          <span className="v3c-lab">
            {t.board.tapeHead}
            <small>{t.board.tapeSub(TAPE_HOURS)}</small>
          </span>
          <span className="v3c-lab v3c-ra">
            {t.board.price}
            <small>{t.board.priceSub}</small>
          </span>
          <span className="v3c-lab v3c-ra">
            {t.board.market}
            <small>{t.board.marketSub}</small>
          </span>
          {/* ui3: con il solo tennis le colonne Estimate e Gap restano vuote anche nell'intestazione */}
          {filters.sport === "tennis" ? (
            <>
              <span />
              <span />
            </>
          ) : (
            <>
              <span className="v3c-lab v3c-ra">
                {t.board.estimate}
                <small>{t.board.estimateSub}</small>
              </span>
              <span className="v3c-lab v3c-ra">
                {t.board.gap}
                <small>{t.board.gapSub}</small>
              </span>
            </>
          )}
          <span className="v3c-lab v3c-ra">
            {t.board.best}
            <small>{t.board.bestSub}</small>
          </span>
          <span />
        </div>
        {shown.length === 0 ? (
          <EmptyCascade all={all} now={now} tz={tz} yesterday={yesterday} filtered={effective.sport !== "all" || effective.day !== "all" || effective.league != null} onShow={(id) => {
              setFilters(DEFAULT_FILTERS);
              // la riga può stare oltre il primo blocco: si montano i blocchi fino a lei
              setPages(Math.max(1, Math.ceil((all.findIndex((r) => r.m.id === id) + 1) / BOARD_PAGE_ROWS)));
              setOpenId(id);
            }} onReset={() => set(DEFAULT_FILTERS)} surface={surface} />
        ) : (
          groups.map((g) => (
            <div key={g.day} className="v3c-group" role="group" aria-label={g.day === "live" ? t.board.liveGroup : dayLong(`${g.day}T12:00:00Z`, "UTC", locale)}>
              {groups.length > 1 || surface === "predictions" ? (
                <div className="v3c-group-h">
                  <h2 className="v3c-t-day">{dayName(g.day)}</h2>
                  <span className="v3c-small">{t.board.group(g.rows.length)}</span>
                </div>
              ) : null}
              {g.rows.map((r) =>
                r.kind === "football" ? (
                  <FootballRow key={r.m.id} live={live.items[r.m.id]} liveLoaded={live.loaded} lc={lc} tape={tapes?.[r.m.id]} r={r} t={t} tz={tz} locale={locale} now={now} open={openId === r.m.id} onToggle={() => setOpenId((o) => (o === r.m.id ? null : r.m.id))} partners={partners} siteOnly={siteOnly} surface={surface} />
                ) : (
                  <TennisRow key={`tn-${r.m.id}`} live={live.items[r.m.id]} liveLoaded={live.loaded} lc={lc} tape={tapes?.[r.m.id]} r={r} t={t} tz={tz} locale={locale} now={now} open={openId === r.m.id} onToggle={() => setOpenId((o) => (o === r.m.id ? null : r.m.id))} partners={partners} siteOnly={siteOnly} surface={surface} />
                ),
              )}
            </div>
          ))
        )}
      </section>
      <div className="v3c-board-f">
        {/* ui3: la nota parla del gap, che il tennis non ha */}
        {filters.sport !== "tennis" ? <p className="v3c-fine">{t.board.rowNote}</p> : null}
        {!limit && more > 0 ? (
          <span className="v3c-board-showmore">
            <span className="v3c-small">{t.board.shownOf(shown.length, filtered.length)}</span>
            <button type="button" className="v3c-btn v3c-btn-line v3c-btn-s" onClick={() => setPages((n) => n + 1)}>
              {t.board.showMore(more)}
            </button>
          </span>
        ) : null}
        {limit ? (
          <Link className="v3c-ghost" href="/predictions">
            {t.board.seeAll(total ?? filtered.length)}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function EmptyCascade({
  all,
  now,
  tz,
  yesterday,
  filtered,
  onShow,
  onReset,
  surface,
}: {
  all: Row[];
  now: Date;
  tz: string | undefined;
  yesterday: Props["yesterday"];
  filtered: boolean;
  onShow: (id: string) => void;
  onReset: () => void;
  surface: "home" | "predictions";
}) {
  const { t } = useV3cCopy();
  const c = emptyCascade(all, now, tz);
  const anyLive = all.some((r) => liveState(r.m.kickoff, now).live);
  const yWon = yesterday ? yesterday.football.won + yesterday.tennis.won : 0;
  const yLost = yesterday ? yesterday.football.lost + yesterday.tennis.lost : 0;
  const cascade = (
      <ol className="v3c-cascade">
        {!anyLive ? <li className="v3c-small">{t.empty.noLive}</li> : null}
        {c.biggestGap ? (
          <li>
            <span className="v3c-lab">{t.empty.biggestGap}</span>
            <button type="button" className="v3c-linkbtn" onClick={() => onShow(c.biggestGap!.m.id)}>
              {t.empty.biggestGapLine(`${c.biggestGap.m.home} – ${c.biggestGap.m.away}`, outcomeLabel(c.biggestGap.m, c.biggestGap.lead.outcome, t.board.draw), gapText(c.biggestGap.lead.edge_pp))}
            </button>
          </li>
        ) : null}
        {c.next ? (
          <li>
            <span className="v3c-lab">{t.empty.nextUp}</span>
            <button type="button" className="v3c-linkbtn" onClick={() => onShow(c.next!.row.m.id)}>
              {matchTitle(c.next.row.m)}
            </button>{" "}
            <span className="v3c-small">{t.empty.startsIn(countdown(c.next.inMs, t.empty))}</span>
          </li>
        ) : null}
        {yesterday && yWon + yLost > 0 ? (
          <li>
            <span className="v3c-lab">{t.empty.yesterday}</span>
            <a className="v3c-linkbtn" href={surface === "home" ? "#v3c-yday" : "/record"}>
              {t.empty.yesterdayLine(yWon, yLost)}
            </a>
          </li>
        ) : null}
      </ol>
  );
  // polish: la board vuota per davvero porta l'illustrazione del kit («Bench is empty»); il filtro vuoto resta compatto
  if (all.length === 0)
    return (
      <div role="status">
        <StateArt kind="empty" title={t.empty.nothing} body={<>{t.empty.nothingHint}{cascade}</>} />
      </div>
    );
  return (
    <div className="v3c-empty" role="status">
      <p className="v3c-t-row">{t.empty.filter}</p>
      <p className="v3c-small">{t.empty.filterHint}</p>
      {cascade}
      {filtered && all.length > 0 ? (
        <button type="button" className="v3c-btn v3c-btn-line v3c-btn-s" onClick={onReset}>
          {t.empty.seeAll}
        </button>
      ) : null}
    </div>
  );
}
