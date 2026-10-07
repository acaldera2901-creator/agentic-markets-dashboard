"use client";
// components/v3c/match/MatchView.tsx (#REDESIGN-V3C F4)
// La pagina partita in tre passi (analisi-gpt/03-teardown-ux.md):
//   1 Market → Estimate → gap, con il 70/30 e il margine SEMPRE accanto;
//   2 il perché: il nastro (solo catture vere), il registro del sigillo, i
//     tool precompilati EV · Kelly · Margin;
//   3 best price e partner, SOLO qui, dopo la lettura.
// Tennis (ui3): solo mercato, quote dei partner, best price, line movement e live —
// nessuna nostra stima, nessun gap. Nessun numero inventato, nessuna notizia inventata.
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Outcome, TennisSide, V3BoardMatch, V3BoardTennisMatch, V3BoardTennisSide, V3LineSeries } from "@/lib/v3c/contracts";
import type { V3cCopy } from "@/lib/v3c/copy";
import { bestOf, dayShort, gapText, isFlatGap, outcomeLabel, pctInt, price2, tennisLead, timeHM, dayLong } from "@/lib/v3c/board-view";
import { stampLocal } from "@/lib/v3c/time-ui";
import { GlossaryLink, InfoButton } from "../guide/Glossary";
import { TzNote } from "../guide/TzNote";
import { useLocalTimeZone, useV3cCopy } from "@/lib/v3c/lang.client";
import { matchCopyFor, type V3cMatchCopy } from "@/lib/v3c/match-copy";
import {
  bookList,
  checkedAt,
  fairPrice,
  gapDirection,
  leadOutcome,
  matchHref,
  pct0,
  pricesAsInputs,
  readBookLinks,
  tapeLines,
  tapeSummary,
  toolStrip,
  type LineEvent,
  type TapeKey,
  type V3BookLink,
} from "@/lib/v3c/match-view";
import { Fascia } from "../Fascia";
import { Monogrammi } from "../Monogramma";
import { Nastro } from "../Nastro";
import { Sigillo } from "../Sigillo";
import { V3C_ROUTES } from "../V3cChrome";
import { LineChart } from "./LineChart";
import { Tape as TapeMini } from "../Tape";
import type { RowTape } from "@/lib/v3c/tape";
import { TAPE_HOURS } from "@/lib/v3c/tape";
import "../fidelity.css";
import "../ui3.css";
import "../tennis2.css";
import { tennisEstimateOf } from "@/lib/v3c/tennis-estimate";
import { PartnerBlock } from "./PartnerBlock";
import { ToolStrip } from "./ToolStrip";
import { MatchLive } from "../live/LiveBits";
import { v3cLang, v3cLocale } from "@/lib/v3c/copy";
import { newsCopyFor } from "@/lib/v3c/news-copy";
import type { NewsCard } from "@/lib/v3c/news/news.server";
import { noteText } from "../pages/NewsLive";
import { fixdataCopyFor } from "@/lib/v3c/fixdata-copy";
import { hasStarted, valueToolsAllowed } from "@/lib/v3c/fixdata";
import { estimateShown } from "@/lib/v3c/fixdata2";
import { fixdata2CopyFor } from "@/lib/v3c/fixdata2-copy";
import { StartedNote } from "./StartedNote";

const BOOK_NAME: Record<string, string> = { fortuneplay: "FortunePlay", ybets: "YBets" };
const bookName = (k: string) => BOOK_NAME[k] ?? k;

export type MoreRow = {
  id: string; home: string; away: string; kickoff: string; league: string | null; gap: number | null;
  /** fidelity: la riga come sulla board del prototipo — esito guida, prezzo, mercato, stima, tape vero */
  lead?: Outcome; price?: number | null; market?: number | null; estimate?: number | null; tape?: RowTape;
  /** final3: le righe tennis (solo sulla pagina tennis), come la board tennis.
   *  tennis2: `estimate`/`gap` presenti solo con estimate_kind 'elo_blend_unsealed' (gap già nullo se nascosto) */
  sport?: "tennis"; leadName?: string; tnElo?: boolean;
};

export type MatchViewProps =
  | { kind: "football"; m: V3BoardMatch; series: V3LineSeries[] | null; events: LineEvent[]; partners: boolean; links: V3BookLink[]; more: MoreRow[]; news?: NewsCard[] }
  | { kind: "tennis"; m: V3BoardTennisMatch; series: V3LineSeries[] | null; events: LineEvent[]; partners: boolean; links: V3BookLink[]; more: MoreRow[] }
  | { kind: "off"; id: string; sport: "football" | "tennis"; home: string; away: string; kickoff: string; series: V3LineSeries[] | null; events: LineEvent[]; more: MoreRow[] };

type Ctx = { t: V3cCopy; c: V3cMatchCopy; lang: string; tz: string | undefined; locale: string };

function useCtx(): Ctx {
  const { lang, t } = useV3cCopy();
  const tz = useLocalTimeZone();
  return { t, c: matchCopyFor(lang), lang, tz, locale: v3cLocale(lang) };
}

// ─── Testa ─────────────────────────────────────────────────────────────────

function Head({ ctx, tab, id, home, away, kickoff, league, sport, sealedAt }: { ctx: Ctx; tab: string; id: string; home: string; away: string; kickoff: string; league: string | null; sport: "football" | "tennis"; sealedAt: string | null }) {
  const { c, t, tz, locale } = ctx;
  // Briciola: torneo/campionato se c'è, altrimenti il nome dello sport — mai un trattino.
  const crumb = league?.trim() || t.toolbar[sport];
  return (
    <>
      <p className="v3c-mt-crumbs">
        <Link href={V3C_ROUTES.board}>{c.crumbsBoard}</Link>
        <span aria-hidden="true">›</span>
        <span>{crumb}</span>
      </p>
      <Fascia
        tab={tab}
        title={
          <span className="v3c-mt-title">
            <span aria-hidden="true">
              <Monogrammi home={{ name: home }} away={{ name: away }} size="lg" />
            </span>
            <span>
              {home} <span className="v3c-vs">—</span> {away}
            </span>
          </span>
        }
        meta={
          <>
            <b>
              {dayLong(kickoff, tz, locale)} · {timeHM(kickoff, tz, locale)}
            </b>
            {/* fixui M2: un fuso per vista, dichiarato qui una volta (prima: «UTC» solo prima del mount) */}
            <TzNote />
            {league ? <span>{league}</span> : null}
            {sealedAt ? (
              <span className="v3c-fm-i">
                <Sigillo sealedAt={sealedAt} tz={tz} locale={locale} label={t.fascia.sealed} title={(sport === "tennis" ? t.tennis.sealedWhy : t.board.sealedWhy)(stampLocal(sealedAt, ctx.tz, locale))} />
                <InfoButton term="sealed" label={t.fascia.sealed} />
              </span>
            ) : null}
          </>
        }
      />
      {/* livescores: il punteggio della fonte intorno al calcio d'inizio — informazione, non tocca stime né registro */}
      <MatchLive id={id} kickoff={kickoff} home={home} away={away} />
    </>
  );
}

function StepHead({ n, id, title, children }: { n: number; id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="v3c-mt-step-h">
      <span className="v3c-mt-step-n" aria-hidden="true">
        {n}
      </span>
      <h2 className="v3c-t-sec" id={id}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Passo 2: il nastro ──────────────────────────────────────────────────────

type TapeChoice = { key: TapeKey; label: string; fair: number | null };

function Tape({ ctx, series, events, choices, initial, estimateAsOf, why, strip, sealedAt = null }: { ctx: Ctx; series: V3LineSeries[] | null; events: LineEvent[]; choices: TapeChoice[]; initial: TapeKey; estimateAsOf: string | null; why: (summary: ReturnType<typeof tapeSummary>) => React.ReactNode; strip?: React.ReactNode; sealedAt?: string | null }) {
  const { c, tz, locale } = ctx;
  const [key, setKey] = useState<TapeKey>(initial);
  const choice = choices.find((x) => x.key === key) ?? choices[0];
  const lines = useMemo(() => (series ? tapeLines(series, choice.key) : []), [series, choice.key]);
  const summary = tapeSummary(lines);
  const asOf = estimateAsOf ? Date.parse(estimateAsOf) : NaN;
  const fair = choice.fair != null && Number.isFinite(asOf) ? { price: choice.fair, from: asOf } : null;
  const time = (ms: number) => timeHM(new Date(ms).toISOString(), tz, locale);
  const day = (ms: number) => dayShort(new Date(ms).toISOString(), tz, locale);
  const every = lines[0]?.median_interval_min;
  const id = useId();
  let body: React.ReactNode;
  if (series == null) body = <p className="v3c-mt-empty">{c.tapeError}</p>;
  else if (!summary) body = <p className="v3c-mt-empty">{c.noTape}</p>;
  else if (summary.n === 1)
    body = (
      <p className="v3c-mt-empty">
        <b>{summary.to.toFixed(2)}</b>
        {c.onePoint(summary.to.toFixed(2), `${day(summary.lastAt)} ${time(summary.lastAt)}`)}
      </p>
    );
  else
    body = (
      <>
        <LineChart
          lines={lines}
          fair={fair}
          events={events}
          seal={sealedAt ? { t: Date.parse(sealedAt), label: c.chartSealed(time(Date.parse(sealedAt))) } : null}
          bookName={bookName}
          timeLabel={time}
          dayLabel={day}
          labels={{
            market: (b) => b,
            fair: fair ? `${c.fair(fair.price.toFixed(2))}` : "",
            opened: c.firstCapture,
            news: (tm, l) => c.newsAt(tm, l),
            aria: c.tapeAria(choice.label, summary.from.toFixed(2), summary.to.toFixed(2), summary.n),
          }}
        />
        <div className="v3c-mt-legend">
          {lines.map((l, i) => (
            <span key={l.bookmaker}>
              <i className={i === 0 ? "m" : "m2"} />
              {c.legendBook(bookName(l.bookmaker))}
            </span>
          ))}
          {/* polish: l'ora dell'ultimo punto del grafico, accanto all'ora del best price (passo 3): possono differire di centesimi */}
          <span className="v3c-mt-last">{c.lastCapture(`${day(summary.lastAt)} ${time(summary.lastAt)}`)}</span>
          {fair && estimateAsOf ? (
            <span>
              <i className="e" />
              {c.legendFair(fair.price.toFixed(2), stampLocal(estimateAsOf, ctx.tz, locale))}
            </span>
          ) : null}
          {events.length ? (
            <span>
              <i className="d" />
              {c.legendNews}
            </span>
          ) : null}
        </div>
      </>
    );
  return (
    <>
      <div className="v3c-cols v3c-cols-8-4">
        <figure className="v3c-mt-fig">
          <figcaption>
            <span className="v3c-lab">{c.tapeCap(choice.label)}</span>
            <span className="v3c-small">{c.tapeSub(lines.map((l) => bookName(l.bookmaker)).join(", ") || "—", every ? c.every(every) : null)}</span>
          </figcaption>
          {choices.length > 1 ? (
            <div className="v3c-chips" role="group" aria-label={c.outcomeChips} style={{ marginBottom: 10 }} id={id}>
              {choices.map((x) => (
                <button key={x.key} type="button" className="v3c-chip" aria-pressed={x.key === choice.key} onClick={() => setKey(x.key)}>
                  {x.label}
                </button>
              ))}
            </div>
          ) : null}
          {body}
        </figure>
        <div>{why(summary)}</div>
      </div>
      {strip}
    </>
  );
}

function MovedItem({ ctx, n, summary, tennis = false }: { ctx: Ctx; n: number; summary: ReturnType<typeof tapeSummary>; tennis?: boolean }) {
  const { c, tz, locale } = ctx;
  if (!summary) return null;
  const since = `${dayShort(new Date(summary.firstAt).toISOString(), tz, locale)} ${timeHM(new Date(summary.firstAt).toISOString(), tz, locale)}`;
  return (
    <li>
      <span className="k">{n}</span>
      <div>
        <h3>{summary.n === 1 ? c.single(summary.to.toFixed(2)) : summary.from === summary.to ? c.unchanged(summary.to.toFixed(2)) : c.moved(summary.from.toFixed(2), summary.to.toFixed(2))}</h3>
        {/* ui3: nel tennis non c'è un gap da spiegare */}
        <p>{(tennis ? c.movedBodyTennis : c.movedBody)(summary.n, since)}</p>
      </div>
    </li>
  );
}

/** #REDESIGN-V3C news: the latest note naming a team — when it came, never what it caused. */
function NewsItem({ ctx, n, card }: { ctx: Ctx; n: number; card: NewsCard }) {
  const { lang, tz, locale } = ctx;
  const nc = newsCopyFor(lang);
  const x = noteText(card, lang);
  const at = new Date(card.t).toISOString();
  return (
    <li>
      <span className="k">{n}</span>
      <div>
        <h3>
          {nc.newsAt(`${dayShort(at, tz, locale)} ${timeHM(at, tz, locale)}`)}: <span lang={x.english ? "en" : lang}>{x.title}</span>
        </h3>
        <p>{nc.matchBody(card.source)}</p>
        <p className="v3c-fine">
          {nc.aiLabel(card.source)}
          {x.english ? ` · ${nc.inEnglish}` : ""} ·{" "}
          <a href={card.url} rel="nofollow noopener noreferrer" target="_blank">
            {nc.readOriginal} <span aria-hidden="true">↗</span>
          </a>
        </p>
      </div>
    </li>
  );
}

function SealItem({ ctx, n, sealedAt, tennis = false }: { ctx: Ctx; n: number; sealedAt: string | null; tennis?: boolean }) {
  const { c, t, locale } = ctx;
  // ui3: nel tennis il numero sigillato è del mercato, non una nostra stima — lo si dice
  const body = sealedAt ? (tennis ? c.tnSealBody : c.sealBody)(stampLocal(sealedAt, ctx.tz, locale)) : c.notSealedBody;
  return (
    <li>
      <span className="k">{n}</span>
      <div>
        <h3>{sealedAt ? c.sealTitle : c.notSealed}</h3>
        <p>{body}</p>
        {sealedAt ? (
          <p className="v3c-mt-reg">
            <Sigillo sealedAt={sealedAt} tz={ctx.tz} locale={locale} label={t.fascia.sealed} />
            <Link href={V3C_ROUTES.record}>{c.record}</Link>
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ─── More on today's board ──────────────────────────────────────────────────

function More({ ctx, rows }: { ctx: Ctx; rows: MoreRow[] }) {
  const { c, t, tz, locale } = ctx;
  if (!rows.length) return null;
  const leadOf = (r: MoreRow) => (r.sport === "tennis" ? r.leadName ?? null : r.lead ? outcomeLabel(r, r.lead, t.board.draw) : null);
  // fidelity: le stesse colonne della board del prototipo (tape · prezzo · mercato · stima · gap); la riga apre la partita
  return (
    <section className="v3c-sec" aria-labelledby="v3c-mt-more">
      <div className="v3c-sec-h">
        <h2 className="v3c-t-sec" id="v3c-mt-more">
          {c.more}
        </h2>
        <Link className="v3c-ghost" href="/predictions">
          {c.allMatches}
        </Link>
      </div>
      <div className="v3c-board v3c-board-more">
        <div className="v3c-board-h" aria-hidden="true" lang={v3cLang(ctx.lang)}>
          <span className="v3c-lab">{t.board.kickoff}</span>
          <span className="v3c-lab">{t.board.match}</span>
          <span className="v3c-lab">
            {t.board.tapeHead}
            <small>{t.board.tapeSub(TAPE_HOURS)}</small>
          </span>
          <span className="v3c-lab v3c-ra">{t.board.price}</span>
          <span className="v3c-lab v3c-ra">{t.board.market}</span>
          <span className="v3c-lab v3c-ra">{t.board.estimate}</span>
          <span className="v3c-lab v3c-ra">{t.board.gap}</span>
        </div>
        {rows.map((r) => (
          <Link key={r.id} className="v3c-row v3c-mt-mr2" href={matchHref(r.id)}>
            <span className="v3c-r-time">
              {timeHM(r.kickoff, tz, locale)}
              <small>{dayShort(r.kickoff, tz, locale)}</small>
            </span>
            <span className="v3c-r-teams">
              <Monogrammi home={{ name: r.home }} away={{ name: r.away }} />
              <span className="v3c-r-name">
                <b className="v3c-t-row" title={`${r.home} — ${r.away}`}>
                  {r.home} — {r.away}
                </b>
                <small>
                  {r.league ?? (r.sport === "tennis" ? t.toolbar.tennis : t.toolbar.football)}
                  {leadOf(r) ? (
                    <>
                      {" · "}
                      <b>{leadOf(r)}</b>
                    </>
                  ) : null}
                </small>
              </span>
            </span>
            {r.tape ? (
              <span className="v3c-r-tape">
                <TapeMini points={r.tape.pts.map(([x, v]) => ({ t: x, v }))} fair={r.tape.fair} sealT={r.tape.fairT} label={t.board.tapeAria(leadOf(r) ?? r.home, price2(r.tape.from), price2(r.tape.to), r.tape.n)} />
                <small className="v3c-num" aria-hidden="true">
                  {price2(r.tape.from)} → {price2(r.tape.to)}
                </small>
              </span>
            ) : (
              <span className="v3c-r-tape v3c-r-tape-none">{t.board.tapeNone}</span>
            )}
            <span className="v3c-r-price v3c-num">{r.price == null ? "—" : price2(r.price)}</span>
            <span className={r.market == null ? "v3c-r-mk v3c-r-none" : "v3c-r-mk v3c-num"}>{r.market == null ? "—" : <>{pctInt(r.market)}<small>%</small></>}</span>
            {r.sport === "tennis" && r.tnElo && r.estimate != null ? (
              <>
                {/* tennis2: come la riga tennis della board — stima senza evidenziatore, gap attenuato */}
                <span className="v3c-r-es v3c-num v3c-r-es-tn">{pctInt(r.estimate)}<small>%</small></span>
                <span className="v3c-r-gap v3c-num v3c-g-tn">
                  <span>
                    {r.gap == null ? "—" : gapText(r.gap)}
                    {r.gap == null ? null : <small> pp</small>}
                  </span>
                  <span className="v3c-r-me" aria-hidden="true">
                    {r.market != null ? <span className="v3c-m">{pctInt(r.market)}% → </span> : null}
                    <span className="v3c-tn-e">{pctInt(r.estimate)}%</span>
                  </span>
                </span>
              </>
            ) : r.sport === "tennis" ? (
              <>
                {/* tennis2: Market only — un'etichetta al posto di Estimate e Gap, su mobile il mercato al posto del gap */}
                <span className="v3c-r-es v3c-r-tnonly">{t.tennis.marketOnly}</span>
                <span className="v3c-r-gap v3c-g-none v3c-r-tnm">
                  <span className="v3c-r-tnm-v v3c-num" aria-hidden="true">
                    {r.market == null ? "—" : `${pctInt(r.market)}%`}
                    <small>{t.tennis.marketOnly}</small>
                  </span>
                </span>
              </>
            ) : (
              <>
            <span className={r.estimate == null ? "v3c-r-es v3c-r-none" : "v3c-r-es v3c-num"}>{r.estimate == null ? "—" : <mark>{pctInt(r.estimate)}<small>%</small></mark>}</span>
            <span className={["v3c-r-gap", "v3c-num", isFlatGap(r.gap) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
              <span>
                {r.gap == null ? "—" : gapText(r.gap)}
                {r.gap == null ? null : <small> pp</small>}
              </span>
              <span className="v3c-r-me" aria-hidden="true">
                {r.market != null ? <span className="v3c-m">{pctInt(r.market)}%</span> : null}
                {r.market != null && r.estimate != null ? " → " : null}
                {r.estimate != null ? <mark>{pctInt(r.estimate)}%</mark> : null}
              </span>
            </span>
              </>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Calcio ─────────────────────────────────────────────────────────────────

function Football({ ctx, m, series, events, partners, links, more, news = [] }: { ctx: Ctx; m: V3BoardMatch; series: V3LineSeries[] | null; events: LineEvent[]; partners: boolean; links: V3BookLink[]; more: MoreRow[]; news?: NewsCard[] }) {
  const { t, c, lang, locale } = ctx;
  const lead = leadOutcome(m);
  const label = (o: Outcome) => outcomeLabel(m, o, t.board.draw);
  const L = label(lead.outcome);
  const hasMarket = lead.market_p != null && lead.market_price != null;
  const M = hasMarket ? pct0(lead.market_p as number) : null;
  const E = pct0(lead.estimate_p);
  const g = lead.edge_pp;
  const dir = g == null ? "flat" : gapDirection(g);
  const fc = fixdataCopyFor(lang);
  // fixdata B1: once the match has started, no book, no best price, no partner button
  const started = hasStarted(m.kickoff, new Date());
  const books = started ? [] : bookList(lead.book_prices, [...readBookLinks(m), ...links]);
  const chk = checkedAt(books);
  const prices = m.outcomes.map((o) => o.market_price);
  // fixdata B5/M5: EV and Kelly only when the model passes the sanity guard, and on the BEST price a book
  // really offers (with its link), never on the composite «market» price; Kelly as a fraction, no stake in €
  const bestP = started ? null : bestOf(lead);
  const valueOk = valueToolsAllowed(m) && bestP != null;
  const strip =
    hasMarket && prices.every((p) => p != null)
      ? toolStrip([
          ...(valueOk
            ? ([
                { slug: "ev-calculator", values: { price: bestP!.price, prob: E } },
                { slug: "kelly-criterion", values: { price: bestP!.price, prob: E, bank: null } },
              ] as const)
            : []),
          { slug: "margin-calculator", values: pricesAsInputs(prices) },
        ])
      : null;
  const guard = m.model_guard?.level ?? "ok";
  // fixdata2 N3: no market to compare (no estimate at all) or an estimate far from the best real price (no estimate, no fair price)
  const showEst = estimateShown(m);
  const f2 = fixdata2CopyFor(lang);
  const priceTime = (iso: string) => timeHM(iso, ctx.tz, locale);
  const choices: TapeChoice[] = m.outcomes.map((o) => ({ key: o.outcome, label: label(o.outcome), fair: showEst ? fairPrice(o.estimate_p) : null }));
  return (
    <>
      <Head ctx={ctx} tab={c.tabFootball} id={m.id} home={m.home} away={m.away} kickoff={m.kickoff} league={m.competition || m.league} sport="football" sealedAt={m.sealed_at} />

      <section className="v3c-mt-step" aria-labelledby="v3c-s1">
        <StepHead n={1} id="v3c-s1" title={c.s1} />
        <div className="v3c-mt-score">
          {hasMarket ? (
            <>
              <div>
                <span className="v3c-lab">
                  {c.market}
                  <InfoButton term="market" label={c.market} />
                  <small>{c.marketSub(L, price2(lead.market_price))}</small>
                </span>
                <b className="v3c-n-score v3c-m">
                  {M}
                  <i>%</i>
                </b>
              </div>
              <span className="v3c-mt-arrow" aria-hidden="true">
                →
              </span>
            </>
          ) : null}
          {showEst ? (
          <div>
            <span className="v3c-lab">
              {c.estimate}
              <InfoButton term="estimate" label={c.estimate} />
              <small>{guard === "market_only" ? t.tennis.marketOnly : m.blend ? c.estimateBlend : c.estimateModel}</small>
            </span>
            <b className="v3c-n-score">
              <mark>
                {E}
                <i>%</i>
              </mark>
            </b>
          </div>
          ) : null}
          {g != null && showEst ? (
            <div className={["v3c-mt-gap", isFlatGap(g) || guard !== "ok" ? "v3c-g-flat" : null].filter(Boolean).join(" ")} data-guard={guard}>
              <span className="v3c-lab">
                {c.gap}
                <InfoButton term="gap" label={c.gap} />
                <small>{c.gapSub}</small>
              </span>
              <b className="v3c-n-score">
                {gapText(g)}
                <i> pp</i>
              </b>
            </div>
          ) : null}
        </div>
        {hasMarket && M != null && guard === "market_only" ? (
          // fixdata B5: the estimate shown is the market — no «our estimate» sentence, no blend line, no tape of a gap
          <p className="v3c-mt-note v3c-guard-note" data-guard={guard} data-reason={m.model_guard?.reason}>{m.model_guard?.reason === "price_far" ? f2.priceFar : fc.marketOnly}</p>
        ) : hasMarket && M != null ? (
          <>
            {/* fixui UX-3: la frase-verdetto è il pezzo grande, la stima ha solo un contorno (fixui.css) */}
            <p className="v3c-explain v3c-mt-verdict">{c.explain(L, price2(lead.market_price), M, E, Math.abs(g ?? 0).toFixed(1), dir)}</p>
            <p className="v3c-pn-facts v3c-small" style={{ marginTop: 6, display: "flex", gap: "4px 14px", flexWrap: "wrap" }}>
              <span>{t.board.blend}</span>
              {m.market_from === "books" ? <span data-market-from="books">{f2.marketFromBooks}</span> : null}
              {m.margin_removed != null ? (
                <span className="v3c-fm-i">
                  {t.board.margin(`${(m.margin_removed * 100).toFixed(1)}%`)}
                  <InfoButton term="market" label={t.board.marketSub} />
                </span>
              ) : null}
              <span>{t.board.estimateAsOf(stampLocal(m.estimate_as_of, ctx.tz, locale))}</span>
              <GlossaryLink />
            </p>
            <Nastro market={M} estimate={E} gap={g} marketLabel={c.market} estimateLabel={c.estimate} inLineLabel={t.board.inLine} gapLabel={t.board.gapWord} />
            {guard === "no_value" ? <p className="v3c-mt-note v3c-guard-note" data-guard={guard}>{fc.noValue}</p> : null}
          </>
        ) : guard === "no_market" ? (
          <>
            <p className="v3c-mt-note v3c-guard-note" data-guard={guard}>
              <b>{f2.modelOnly}</b>
            </p>
            <p className="v3c-fine">{f2.modelOnlyNote}</p>
          </>
        ) : (
          <p className="v3c-mt-note">{c.noMarketLong}</p>
        )}
        <div className="v3c-mt-out" role="table" aria-label={t.board.allOutcomes}>
          <div className="v3c-mt-oh" role="row" lang={v3cLang(lang)}>
            <span className="v3c-lab" role="columnheader">
              {c.outcome}
            </span>
            <span className="v3c-lab v3c-ra v3c-mt-c-price" role="columnheader">
              {c.price}
            </span>
            <span className="v3c-lab v3c-ra" role="columnheader">
              {c.market}
            </span>
            <span className="v3c-lab v3c-ra" role="columnheader">
              {c.estimate}
            </span>
            <span className="v3c-lab v3c-ra" role="columnheader">
              {c.gap}
            </span>
          </div>
          {m.outcomes.map((o) => {
            const fp = showEst ? fairPrice(o.estimate_p) : null;
            return (
              <div key={o.outcome} role="row" className={["v3c-mt-or", o === lead ? "v3c-mt-lead" : null].filter(Boolean).join(" ")}>
                <span role="cell" className="v3c-mt-who">
                  {label(o.outcome)}
                  <small>{o === lead && o.edge_pp != null ? c.largest : fp ? c.fair(fp.toFixed(2)) : ""}</small>
                </span>
                <span role="cell" className="v3c-num v3c-ra v3c-mt-c-price">
                  {price2(o.market_price)}
                </span>
                <span role="cell" className="v3c-num v3c-ra v3c-m">
                  {o.market_p == null ? "—" : pctInt(o.market_p)}
                  {o.market_p == null ? null : <small>%</small>}
                </span>
                <span role="cell" className="v3c-num v3c-ra">
                  {showEst ? (
                    <mark>
                      {pctInt(o.estimate_p)}
                      <small>%</small>
                    </mark>
                  ) : (
                    "—"
                  )}
                </span>
                <span role="cell" className={["v3c-num", "v3c-ra", isFlatGap(o.edge_pp) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
                  {showEst ? gapText(o.edge_pp) : "—"}
                  {o.edge_pp == null || !showEst ? null : <small> pp</small>}
                </span>
              </div>
            );
          })}
        </div>
        <p className="v3c-fine" style={{ marginTop: 10 }}>
          {showEst ? c.wrongN(E) : null} {g != null && showEst ? <span className="v3c-gap-round">{fc.gapRounding}</span> : null}
        </p>
      </section>

      <section className="v3c-mt-step" aria-labelledby="v3c-s2">
        <StepHead n={2} id="v3c-s2" title={c.s2} />
        <Tape
          ctx={ctx}
          series={series}
          events={events}
          choices={choices}
          initial={lead.outcome}
          estimateAsOf={m.estimate_as_of}
          sealedAt={m.sealed_at}
          why={(summary) => (
            <ol className="v3c-mt-why">
              <MovedItem ctx={ctx} n={1} summary={summary} />
              {news[0] ? <NewsItem ctx={ctx} n={summary ? 2 : 1} card={news[0]} /> : null}
              <li>
                <span className="k">{(summary ? 2 : 1) + (news[0] ? 1 : 0)}</span>
                <div>
                  <h3>{m.blend ? c.blendTitle : c.modelTitle}</h3>
                  <p>{m.blend ? c.blendBody : c.modelBody}</p>
                </div>
              </li>
              <SealItem ctx={ctx} n={(summary ? 3 : 2) + (news[0] ? 1 : 0)} sealedAt={m.sealed_at} />
            </ol>
          )}
          strip={
            strip ? (
              <>
                <ToolStrip title={c.strip(L, price2(valueOk ? bestP!.price : lead.market_price))} all={c.allTools} items={strip} lang={lang} />
                {valueOk ? (
                  <p className="v3c-fine v3c-kelly-note">
                    {fc.bestBasis(price2(bestP!.price), bestP!.name)} {fc.kellyNote}
                  </p>
                ) : guard === "no_value" ? (
                  <p className="v3c-fine v3c-kelly-note">{fc.noValue}</p>
                ) : null}
              </>
            ) : null
          }
        />
      </section>

      <section className="v3c-mt-step" aria-labelledby="v3c-s3">
        <StepHead n={3} id="v3c-s3" title={c.s3} />
        <div className="v3c-cols v3c-cols-8-4">
          {started ? (
            <section className="v3c-partner v3c-mt-partner" aria-labelledby="v3c-mt-p">
              <h2 className="v3c-t-sec" id="v3c-mt-p">{fc.startedGroup}</h2>
              <StartedNote id={m.id} kickoff={m.kickoff} />
            </section>
          ) : (
            <PartnerBlock id="v3c-mt-p" title={c.bestAmong(books.filter((b) => b.price != null).length)} label={L} books={books} checked={chk ? priceTime(chk) : null} partners={partners} surface="match" c={c} age={t.foot.age} timeOf={priceTime} />
          )}
          <div className="v3c-mt-side">
            <Link className="v3c-btn v3c-btn-line v3c-btn-s" href={`/price-check?m=${encodeURIComponent(m.id)}`}>
              {c.pcBridge}
            </Link>
          </div>
        </div>
      </section>
      <More ctx={ctx} rows={more} />
    </>
  );
}

// ─── Tennis ─────────────────────────────────────────────────────────────────
// tennis2 (Andrea, 07/10): Market → Estimate → Gap come il calcio SOLO dove il contratto dice
// estimate_kind 'elo_blend_unsealed' (0,1·Elo + 0,9·mercato, Elo ≤ 6 h, ATP/WTA). La stima è
// «basata su Elo, non sigillata», senza evidenziatore; il gap è attenuato e non è mai un segnale
// (nessun prezzo equo dalla stima nel grafico, nessun EV nella striscia dei tool). Altrove il mercato.
// Il sigillo resta quello del mercato: il registro non è sigillato sull'Elo e non lo finge.

const pctOrDash = (p: number | null | undefined) => (p == null ? "—" : `${pctInt(p)}%`);

function Tennis({ ctx, m, series, events, partners, links, more }: { ctx: Ctx; m: V3BoardTennisMatch; series: V3LineSeries[] | null; events: LineEvent[]; partners: boolean; links: V3BookLink[]; more: MoreRow[] }) {
  const { t, c, lang, locale } = ctx;
  const lead: V3BoardTennisSide = tennisLead(m);
  // fixdata B1: once the match has started, no book, no best price, no partner button
  const started = hasStarted(m.kickoff, new Date());
  const books = started ? [] : bookList(lead.book_prices, [...readBookLinks(m), ...links]);
  const priceTime = (iso: string) => timeHM(iso, ctx.tz, locale);
  const chk = checkedAt(books);
  const sidePrices = m.sides.map((s) => s.market_price ?? bestOf(s)?.price ?? null);
  const leadPrice = sidePrices[m.sides.indexOf(lead)];
  const strip =
    sidePrices.every((p) => p != null) && leadPrice != null
      ? toolStrip([
          { slug: "odds-converter", values: { price: leadPrice } },
          { slug: "probability-calculator", values: pricesAsInputs(sidePrices) },
          { slug: "margin-calculator", values: pricesAsInputs(sidePrices) },
        ])
      : null;
  const choices: TapeChoice[] = m.sides.map((s) => ({ key: s.side as TennisSide, label: s.player, fair: null }));
  const asOf = m.market_source?.as_of ?? m.estimate_as_of;
  const est = tennisEstimateOf(m, lead.side);
  const elo = est.kind === "elo_blend_unsealed" && est.estimate != null && lead.market_p != null;
  // fixdata B8: a sealed row of OUR model (tempered Elo): the sealed number and its gap against the book before the seal
  const fc = fixdataCopyFor(lang);
  // (QA B8: the model_tempered branch only — the ui3 rule «no estimate of ours in tennis» stays for every other kind)
  // fixdata2 N9: the sealed Elo under the 15 / 25 pp guard — > 25 pp or no market, the board's «Market only» here too
  const sg = m.sealed_guard?.level ?? "ok";
  const f2 = fixdata2CopyFor(lang);
  const sealedRow = m.probability_kind === "model_tempered" && m.sealed_at != null && lead.sealed_p != null;
  const sealedOurs = sealedRow && (sg === "ok" || sg === "no_value");
  const sealedHidden = sealedRow && !sealedOurs;
  return (
    <>
      <Head ctx={ctx} tab={c.tabTennis} id={m.id} home={m.player1} away={m.player2} kickoff={m.kickoff} league={m.tournament || t.tennis.title} sport="tennis" sealedAt={m.sealed_at} />
      <section className="v3c-mt-step" aria-labelledby="v3c-s1">
        <StepHead n={1} id="v3c-s1" title={elo ? c.s1TennisElo : c.s1Tennis} />
        <div className="v3c-mt-score">
          <div>
            <span className="v3c-lab">
              {c.tennisMarketOnlyBig}
              <InfoButton term="market" label={c.tennisMarketOnlyBig} />
              <small>{lead.market_price != null ? c.marketSub(lead.player, price2(lead.market_price)) : lead.player}</small>
            </span>
            <b className="v3c-n-score v3c-m">
              {pctInt(lead.market_p)}
              {lead.market_p != null ? <i>%</i> : null}
            </b>
          </div>
          {elo ? (
            <>
              <span className="v3c-mt-arrow" aria-hidden="true">
                →
              </span>
              <div>
                <span className="v3c-lab">
                  {c.estimate}
                  <small>{t.tennis.eloLabel}</small>
                </span>
                <b className="v3c-n-score">
                  {pctInt(est.estimate)}
                  <i>%</i>
                </b>
              </div>
              {est.gap != null ? (
                <div className="v3c-mt-gap v3c-g-tn">
                  <span className="v3c-lab">
                    {c.gap}
                    <small>{c.gapSub}</small>
                  </span>
                  <b className="v3c-n-score">
                    {gapText(est.gap)}
                    <i> pp</i>
                  </b>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        {elo ? (
          <>
            <p className="v3c-explain v3c-tn-caveat">
              {t.tennis.caveat}
              {est.gap == null ? ` ${t.tennis.gapHidden}.` : null}
            </p>
            <p className="v3c-pn-facts v3c-small" style={{ marginTop: 6, display: "flex", gap: "4px 14px", flexWrap: "wrap" }}>
              <span>{t.tennis.blendFact}</span>
              {m.margin_removed != null ? <span>{t.board.margin(`${(m.margin_removed * 100).toFixed(1)}%`)}</span> : null}
              <span>{t.fascia.pricesAsOf(stampLocal(asOf, ctx.tz, locale))}</span>
              {m.elo_as_of ? <span>{t.tennis.eloAsOf(stampLocal(m.elo_as_of, ctx.tz, locale))}</span> : null}
              <GlossaryLink />
            </p>
            {est.gap != null ? (
              <Nastro className="v3c-gl-tn" market={pct0(lead.market_p as number)} estimate={pct0(est.estimate as number)} gap={est.gap} marketLabel={c.market} estimateLabel={c.estimate} inLineLabel={t.board.inLine} gapLabel={t.board.gapWord} />
            ) : null}
          </>
        ) : sealedOurs ? null : sealedHidden ? (
          <p className="v3c-mt-note v3c-guard-note" data-guard={sg}>
            {sg === "no_market" ? f2.modelOnly : f2.sealedFar}
          </p>
        ) : (
          <p className="v3c-mt-note">{t.tennis.noEstimate}</p>
        )}
        {sealedOurs ? (
          <div className="v3c-mt-sealed" data-sealed-gap={lead.gap_pp != null ? "yes" : "no"}>
            <div className="v3c-mt-score">
              <div>
                <span className="v3c-lab">
                  {fc.sealedElo}
                  <small>{fc.sealedAt(stampLocal(m.sealed_at as string, ctx.tz, locale))}</small>
                </span>
                <b className="v3c-n-score">
                  {pctInt(lead.sealed_p)}
                  <i>%</i>
                </b>
              </div>
              {lead.gap_pp != null && lead.market_p_at_seal != null && m.gap_market ? (
                <>
                  <div>
                    <span className="v3c-lab">
                      {c.market}
                      <small>{fc.marketAtSeal(bookName(m.gap_market.bookmaker), stampLocal(m.gap_market.captured_at, ctx.tz, locale))}</small>
                    </span>
                    <b className="v3c-n-score v3c-m">
                      {pctInt(lead.market_p_at_seal)}
                      <i>%</i>
                    </b>
                  </div>
                  <div className="v3c-mt-gap v3c-g-tn">
                    <span className="v3c-lab">
                      {c.gap}
                      <small>{c.gapSub}</small>
                    </span>
                    <b className="v3c-n-score">
                      {gapText(lead.gap_pp)}
                      <i> pp</i>
                    </b>
                  </div>
                </>
              ) : null}
            </div>
            <p className="v3c-fine" data-guard={sg}>{lead.gap_pp != null ? fc.sealedGapNote : sg === "no_value" ? f2.sealedNoValue : m.gap_null_reason}</p>
          </div>
        ) : null}
        <div className={["v3c-mt-out", elo ? "v3c-mt-out-tn5" : "v3c-mt-out-tn3"].join(" ")} role="table" aria-label={t.tennis.winner}>
          <div className="v3c-mt-oh" role="row" lang={v3cLang(lang)}>
            <span className="v3c-lab" role="columnheader">
              {t.tennis.winner}
            </span>
            <span className="v3c-lab v3c-ra v3c-mt-c-price" role="columnheader">
              {c.price}
            </span>
            <span className="v3c-lab v3c-ra" role="columnheader">
              {c.market}
            </span>
            {elo ? (
              <>
                <span className="v3c-lab v3c-ra" role="columnheader">
                  {c.estimate}
                </span>
                <span className="v3c-lab v3c-ra" role="columnheader">
                  {c.gap}
                </span>
              </>
            ) : null}
          </div>
          {m.sides.map((x) => {
            const xe = tennisEstimateOf(m, x.side);
            return (
              <div key={x.side} role="row" className={["v3c-mt-or", x === lead ? "v3c-mt-lead" : null].filter(Boolean).join(" ")}>
                <span role="cell" className="v3c-mt-who">
                  {x.player}
                </span>
                <span role="cell" className="v3c-num v3c-ra v3c-mt-c-price">
                  {price2(x.market_price)}
                </span>
                <span role="cell" className="v3c-num v3c-ra v3c-m">
                  {pctOrDash(x.market_p)}
                </span>
                {elo ? (
                  <>
                    <span role="cell" className="v3c-num v3c-ra">
                      {pctOrDash(xe.estimate)}
                    </span>
                    <span role="cell" className="v3c-num v3c-ra v3c-g-tn">
                      {xe.gap == null ? "—" : gapText(xe.gap)}
                      {xe.gap == null ? null : <small> pp</small>}
                    </span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        {elo ? null : (
          <p className="v3c-pn-facts v3c-small" style={{ marginTop: 10, display: "flex", gap: "4px 14px", flexWrap: "wrap" }}>
            {m.margin_removed != null ? <span>{t.board.margin(`${(m.margin_removed * 100).toFixed(1)}%`)}</span> : null}
            <span>{t.fascia.pricesAsOf(stampLocal(asOf, ctx.tz, locale))}</span>
            <GlossaryLink />
          </p>
        )}
      </section>

      <section className="v3c-mt-step" aria-labelledby="v3c-s2">
        <StepHead n={2} id="v3c-s2" title={c.s2Tennis} />
        <Tape
          ctx={ctx}
          series={series}
          events={events}
          choices={choices}
          initial={lead.side}
          estimateAsOf={null}
          sealedAt={m.sealed_at}
          why={(summary) => (
            <ol className="v3c-mt-why">
              <MovedItem ctx={ctx} n={1} summary={summary} tennis />
              <li>
                <span className="k">{summary ? 2 : 1}</span>
                <div>
                  {/* fixdata B8: a sealed row of our tempered Elo is not «market only» and its seal is not market-based */}
                  <h3>{sealedOurs ? fc.sealedElo : elo ? c.tnEloWhyTitle : c.tnWhyTitle}</h3>
                  <p>{sealedOurs ? fc.sealedGapNote : elo ? c.tnEloWhyBody : c.tnWhyBody}</p>
                </div>
              </li>
              <SealItem ctx={ctx} n={summary ? 3 : 2} sealedAt={m.sealed_at} tennis={!sealedOurs} />
            </ol>
          )}
          strip={strip ? <ToolStrip title={c.stripTennis} all={c.allTools} items={strip} lang={lang} /> : null}
        />
      </section>

      <section className="v3c-mt-step" aria-labelledby="v3c-s3">
        <StepHead n={3} id="v3c-s3" title={c.s3} />
        <div className="v3c-cols v3c-cols-8-4">
          {started ? (
            <section className="v3c-partner v3c-mt-partner" aria-labelledby="v3c-mt-p">
              <h2 className="v3c-t-sec" id="v3c-mt-p">{fc.startedGroup}</h2>
              <StartedNote id={m.id} kickoff={m.kickoff} />
            </section>
          ) : (
            <PartnerBlock id="v3c-mt-p" title={c.bestAmong(books.filter((b) => b.price != null).length)} label={lead.player} books={books} checked={chk ? priceTime(chk) : null} partners={partners} surface="match" c={c} age={t.foot.age} timeOf={priceTime} />
          )}
          <div className="v3c-mt-side">
            <Link className="v3c-btn v3c-btn-line v3c-btn-s" href={`/price-check?m=${encodeURIComponent(m.id)}`}>
              {c.pcBridge}
            </Link>
          </div>
        </div>
      </section>
      <More ctx={ctx} rows={more} />
    </>
  );
}

// ─── Partita uscita dalla board ─────────────────────────────────────────────

function OffBoard({ ctx, p }: { ctx: Ctx; p: Extract<MatchViewProps, { kind: "off" }> }) {
  const { c, t } = ctx;
  const choices: TapeChoice[] =
    p.sport === "tennis"
      ? [
          { key: "p1", label: p.home, fair: null },
          { key: "p2", label: p.away, fair: null },
        ]
      : [
          { key: "home", label: p.home, fair: null },
          { key: "draw", label: t.board.draw, fair: null },
          { key: "away", label: p.away, fair: null },
        ];
  return (
    <>
      <Head ctx={ctx} tab={p.sport === "tennis" ? c.tabTennis : c.tabFootball} id={p.id} home={p.home} away={p.away} kickoff={p.kickoff} league={null} sport={p.sport} sealedAt={null} />
      <p className="v3c-mt-note" style={{ marginBottom: 24 }}>
        {c.offBoard}
      </p>
      <section className="v3c-mt-step" aria-labelledby="v3c-s2">
        <StepHead n={2} id="v3c-s2" title={c.s2} />
        <Tape ctx={ctx} series={p.series} events={p.events} choices={choices} initial={choices[0].key} estimateAsOf={null} why={(s) => <ol className="v3c-mt-why"><MovedItem ctx={ctx} n={1} summary={s} tennis={p.sport === "tennis"} /></ol>} />
      </section>
      <More ctx={ctx} rows={p.more} />
    </>
  );
}

export function MatchView(props: MatchViewProps) {
  const ctx = useCtx();
  if (props.kind === "football") return <Football ctx={ctx} {...props} />;
  if (props.kind === "tennis") return <Tennis ctx={ctx} {...props} />;
  return <OffBoard ctx={ctx} p={props} />;
}
