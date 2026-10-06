"use client";
// components/v3c/match/MatchView.tsx (#REDESIGN-V3C F4)
// La pagina partita in tre passi (analisi-gpt/03-teardown-ux.md):
//   1 Market → Estimate → gap, con il 70/30 e il margine SEMPRE accanto;
//   2 il perché: il nastro (solo catture vere), il registro del sigillo, i
//     tool precompilati EV · Kelly · Margin;
//   3 best price e partner, SOLO qui, dopo la lettura.
// Tennis: tutto ciò che il contratto fornisce; gap solo dove esiste, altrimenti
// il motivo per cui non c'è. Nessun numero inventato, nessuna notizia inventata.
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Outcome, TennisSide, V3BoardMatch, V3BoardTennisMatch, V3BoardTennisSide, V3LineSeries } from "@/lib/v3c/contracts";
import type { V3cCopy } from "@/lib/v3c/copy";
import { bestOf, dayShort, gapText, isFlatGap, outcomeLabel, pctInt, price2, sealedStamp, timeHM, dayLong } from "@/lib/v3c/board-view";
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
import { PartnerBlock } from "./PartnerBlock";
import { ToolStrip } from "./ToolStrip";

const BOOK_NAME: Record<string, string> = { fortuneplay: "FortunePlay", ybets: "YBets" };
const bookName = (k: string) => BOOK_NAME[k] ?? k;

export type MoreRow = { id: string; home: string; away: string; kickoff: string; league: string | null; gap: number | null };

export type MatchViewProps =
  | { kind: "football"; m: V3BoardMatch; series: V3LineSeries[] | null; events: LineEvent[]; partners: boolean; links: V3BookLink[]; more: MoreRow[] }
  | { kind: "tennis"; m: V3BoardTennisMatch; series: V3LineSeries[] | null; events: LineEvent[]; partners: boolean; links: V3BookLink[]; more: MoreRow[] }
  | { kind: "off"; id: string; sport: "football" | "tennis"; home: string; away: string; kickoff: string; series: V3LineSeries[] | null; events: LineEvent[]; more: MoreRow[] };

type Ctx = { t: V3cCopy; c: V3cMatchCopy; lang: string; tz: string | undefined; locale: string };

function useCtx(): Ctx {
  const { lang, t } = useV3cCopy();
  const tz = useLocalTimeZone();
  return { t, c: matchCopyFor(lang), lang, tz, locale: lang === "it" ? "it-IT" : "en-GB" };
}

// ─── Testa ─────────────────────────────────────────────────────────────────

function Head({ ctx, tab, home, away, kickoff, league, sealedAt }: { ctx: Ctx; tab: string; home: string; away: string; kickoff: string; league: string | null; sealedAt: string | null }) {
  const { c, t, tz, locale } = ctx;
  return (
    <>
      <p className="v3c-mt-crumbs">
        <Link href={V3C_ROUTES.board}>{c.crumbsBoard}</Link>
        <span aria-hidden="true">›</span>
        <span>{league ?? "—"}</span>
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
              {tz ? "" : ` ${c.kickoffUtc}`}
            </b>
            {league ? <span>{league}</span> : null}
            {sealedAt ? <Sigillo sealedAt={sealedAt} label={t.fascia.sealed} title={t.board.sealedWhy(sealedStamp(sealedAt, locale))} /> : null}
          </>
        }
      />
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

function Tape({ ctx, series, events, choices, initial, estimateAsOf, why, strip }: { ctx: Ctx; series: V3LineSeries[] | null; events: LineEvent[]; choices: TapeChoice[]; initial: TapeKey; estimateAsOf: string | null; why: (summary: ReturnType<typeof tapeSummary>) => React.ReactNode; strip?: React.ReactNode }) {
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
          {fair && estimateAsOf ? (
            <span>
              <i className="e" />
              {c.legendFair(fair.price.toFixed(2), sealedStamp(estimateAsOf, locale))}
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

function MovedItem({ ctx, n, summary }: { ctx: Ctx; n: number; summary: ReturnType<typeof tapeSummary> }) {
  const { c, tz, locale } = ctx;
  if (!summary) return null;
  const since = `${dayShort(new Date(summary.firstAt).toISOString(), tz, locale)} ${timeHM(new Date(summary.firstAt).toISOString(), tz, locale)}`;
  return (
    <li>
      <span className="k">{n}</span>
      <div>
        <h3>{summary.n === 1 ? c.single(summary.to.toFixed(2)) : summary.from === summary.to ? c.unchanged(summary.to.toFixed(2)) : c.moved(summary.from.toFixed(2), summary.to.toFixed(2))}</h3>
        <p>{c.movedBody(summary.n, since)}</p>
      </div>
    </li>
  );
}

function SealItem({ ctx, n, sealedAt }: { ctx: Ctx; n: number; sealedAt: string | null }) {
  const { c, t, locale } = ctx;
  return (
    <li>
      <span className="k">{n}</span>
      <div>
        <h3>{sealedAt ? c.sealTitle : c.notSealed}</h3>
        <p>{sealedAt ? c.sealBody(sealedStamp(sealedAt, locale)) : c.notSealedBody}</p>
        {sealedAt ? (
          <p className="v3c-mt-reg">
            <Sigillo sealedAt={sealedAt} label={t.fascia.sealed} />
            <Link href={V3C_ROUTES.record}>{c.record}</Link>
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ─── More on today's board ──────────────────────────────────────────────────

function More({ ctx, rows }: { ctx: Ctx; rows: MoreRow[] }) {
  const { c, tz, locale } = ctx;
  if (!rows.length) return null;
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
      <div className="v3c-mt-more">
        {rows.map((r) => (
          <Link key={r.id} className="v3c-mt-mr" href={matchHref(r.id)}>
            <span className="v3c-small">
              <b className="v3c-num" style={{ fontSize: 18, display: "block", textAlign: "left" }}>
                {timeHM(r.kickoff, tz, locale)}
              </b>
              {dayShort(r.kickoff, tz, locale)}
            </span>
            <Monogrammi home={{ name: r.home }} away={{ name: r.away }} />
            <span>
              <b className="v3c-t-row">
                {r.home} — {r.away}
              </b>
              <small>{r.league ?? "—"}</small>
            </span>
            <span className={["v3c-num", isFlatGap(r.gap) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
              {r.gap == null ? "—" : gapText(r.gap)}
              {r.gap == null ? null : <small> pp</small>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Calcio ─────────────────────────────────────────────────────────────────

function Football({ ctx, m, series, events, partners, links, more }: { ctx: Ctx; m: V3BoardMatch; series: V3LineSeries[] | null; events: LineEvent[]; partners: boolean; links: V3BookLink[]; more: MoreRow[] }) {
  const { t, c, lang, locale } = ctx;
  const lead = leadOutcome(m);
  const label = (o: Outcome) => outcomeLabel(m, o, t.board.draw);
  const L = label(lead.outcome);
  const hasMarket = lead.market_p != null && lead.market_price != null;
  const M = hasMarket ? pct0(lead.market_p as number) : null;
  const E = pct0(lead.estimate_p);
  const g = lead.edge_pp;
  const dir = g == null ? "flat" : gapDirection(g);
  const books = bookList(lead.book_prices, [...readBookLinks(m), ...links]);
  const chk = checkedAt(books);
  const prices = m.outcomes.map((o) => o.market_price);
  const strip =
    hasMarket && prices.every((p) => p != null)
      ? toolStrip([
          { slug: "ev-calculator", values: { price: lead.market_price, prob: E } },
          { slug: "kelly-criterion", values: { price: lead.market_price, prob: E, bank: 500 } },
          { slug: "margin-calculator", values: pricesAsInputs(prices) },
        ])
      : null;
  const choices: TapeChoice[] = m.outcomes.map((o) => ({ key: o.outcome, label: label(o.outcome), fair: fairPrice(o.estimate_p) }));
  return (
    <>
      <Head ctx={ctx} tab={c.tabFootball} home={m.home} away={m.away} kickoff={m.kickoff} league={m.competition || m.league} sealedAt={m.sealed_at} />

      <section className="v3c-mt-step" aria-labelledby="v3c-s1">
        <StepHead n={1} id="v3c-s1" title={c.s1} />
        <div className="v3c-mt-score">
          {hasMarket ? (
            <>
              <div>
                <span className="v3c-lab">
                  {c.market}
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
          <div>
            <span className="v3c-lab">
              {c.estimate}
              <small>{m.blend ? c.estimateBlend : c.estimateModel}</small>
            </span>
            <b className="v3c-n-score">
              <mark>
                {E}
                <i>%</i>
              </mark>
            </b>
          </div>
          {g != null ? (
            <div className={["v3c-mt-gap", isFlatGap(g) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
              <span className="v3c-lab">
                {c.gap}
                <small>{c.gapSub}</small>
              </span>
              <b className="v3c-n-score">
                {gapText(g)}
                <i> pp</i>
              </b>
            </div>
          ) : null}
        </div>
        {hasMarket && M != null ? (
          <>
            <p className="v3c-explain">{c.explain(L, price2(lead.market_price), M, E, Math.abs(g ?? 0).toFixed(1), dir)}</p>
            <p className="v3c-pn-facts v3c-small" style={{ marginTop: 6, display: "flex", gap: "4px 14px", flexWrap: "wrap" }}>
              <span>{t.board.blend}</span>
              {m.margin_removed != null ? <span>{t.board.margin(`${(m.margin_removed * 100).toFixed(1)}%`)}</span> : null}
              <span>{t.board.estimateAsOf(sealedStamp(m.estimate_as_of, locale))}</span>
            </p>
            <Nastro market={M} estimate={E} gap={g} marketLabel={c.market} estimateLabel={c.estimate} />
          </>
        ) : (
          <p className="v3c-mt-note">{c.noMarketLong}</p>
        )}
        <div className="v3c-mt-out" role="table" aria-label={t.board.allOutcomes}>
          <div className="v3c-mt-oh" role="row">
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
            const fp = fairPrice(o.estimate_p);
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
                  <mark>
                    {pctInt(o.estimate_p)}
                    <small>%</small>
                  </mark>
                </span>
                <span role="cell" className={["v3c-num", "v3c-ra", isFlatGap(o.edge_pp) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
                  {gapText(o.edge_pp)}
                  {o.edge_pp == null ? null : <small> pp</small>}
                </span>
              </div>
            );
          })}
        </div>
        <p className="v3c-fine" style={{ marginTop: 10 }}>
          {c.wrongN(E)}
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
          why={(summary) => (
            <ol className="v3c-mt-why">
              <MovedItem ctx={ctx} n={1} summary={summary} />
              <li>
                <span className="k">{summary ? 2 : 1}</span>
                <div>
                  <h3>{m.blend ? c.blendTitle : c.modelTitle}</h3>
                  <p>{m.blend ? c.blendBody : c.modelBody}</p>
                </div>
              </li>
              <SealItem ctx={ctx} n={summary ? 3 : 2} sealedAt={m.sealed_at} />
            </ol>
          )}
          strip={strip ? <ToolStrip title={c.strip(L, price2(lead.market_price))} all={c.allTools} items={strip} lang={lang} /> : null}
        />
      </section>

      <section className="v3c-mt-step" aria-labelledby="v3c-s3">
        <StepHead n={3} id="v3c-s3" title={c.s3} />
        <div className="v3c-cols v3c-cols-8-4">
          <PartnerBlock id="v3c-mt-p" title={c.bestAmong(books.filter((b) => b.price != null).length)} label={L} books={books} checked={chk ? timeHM(chk, ctx.tz, locale) : null} partners={partners} surface="match" c={c} age={t.foot.age} />
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

function tennisNoGap(m: V3BoardTennisMatch, c: V3cMatchCopy): string {
  if (!m.is_our_model) return c.tnMarketOnly;
  const r = m.gap_null_reason ?? "";
  if (r.startsWith("not sealed")) return c.tnNotSealed;
  if (r.startsWith("no FortunePlay")) return c.tnNoMarketAtSeal;
  if (r) return c.tnAnchored;
  return c.tnComing;
}

const pctOrDash = (p: number | null | undefined) => (p == null ? "—" : `${pctInt(p)}%`);

function Tennis({ ctx, m, series, events, partners, links, more }: { ctx: Ctx; m: V3BoardTennisMatch; series: V3LineSeries[] | null; events: LineEvent[]; partners: boolean; links: V3BookLink[]; more: MoreRow[] }) {
  const { t, c, lang, locale } = ctx;
  const lead: V3BoardTennisSide = m.sides.find((x) => x.side === m.focus) ?? m.sides[0];
  const hasGap = lead.gap_pp != null && lead.sealed_p != null && lead.market_p_at_seal != null;
  const marketOnly = !m.is_our_model;
  const kind = m.probability_kind === "model" ? t.tennis.kindModel : m.probability_kind === "model_tempered" ? t.tennis.kindModelTempered : t.tennis.kindMarket;
  const books = bookList(lead.book_prices, [...readBookLinks(m), ...links]);
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
  const choices: TapeChoice[] = m.sides.map((s) => ({ key: s.side as TennisSide, label: s.player, fair: marketOnly ? null : fairPrice(s.estimate_p) }));
  const big = hasGap ? null : marketOnly ? (lead.market_p ?? lead.estimate_p) : lead.estimate_p;
  return (
    <>
      <Head ctx={ctx} tab={c.tabTennis} home={m.player1} away={m.player2} kickoff={m.kickoff} league={m.tournament || t.tennis.title} sealedAt={m.sealed_at} />
      <section className="v3c-mt-step" aria-labelledby="v3c-s1">
        <StepHead n={1} id="v3c-s1" title={c.s1} />
        <div className="v3c-mt-score">
          {hasGap ? (
            <>
              <div>
                <span className="v3c-lab">
                  {c.tennisMarketAtSeal}
                  <small>{lead.player}</small>
                </span>
                <b className="v3c-n-score v3c-m">
                  {pctInt(lead.market_p_at_seal)}
                  <i>%</i>
                </b>
              </div>
              <span className="v3c-mt-arrow" aria-hidden="true">
                →
              </span>
              <div>
                <span className="v3c-lab">
                  {c.tennisSealedEstimate}
                  <small>{kind}</small>
                </span>
                <b className="v3c-n-score">
                  <mark>
                    {pctInt(lead.sealed_p)}
                    <i>%</i>
                  </mark>
                </b>
              </div>
              <div className={["v3c-mt-gap", isFlatGap(lead.gap_pp) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
                <span className="v3c-lab">
                  {c.gap}
                  <small>{c.tennisGapAtSeal}</small>
                </span>
                <b className="v3c-n-score">
                  {gapText(lead.gap_pp)}
                  <i> pp</i>
                </b>
              </div>
            </>
          ) : (
            <div>
              <span className="v3c-lab">
                {marketOnly ? c.tennisMarketOnlyBig : c.tennisModelBig}
                <small>
                  {lead.player} · {kind}
                </small>
              </span>
              <b className={["v3c-n-score", marketOnly ? "v3c-m" : null].filter(Boolean).join(" ")}>
                {marketOnly ? (
                  <>
                    {pctInt(big)}
                    <i>%</i>
                  </>
                ) : (
                  <mark>
                    {pctInt(big)}
                    <i>%</i>
                  </mark>
                )}
              </b>
            </div>
          )}
        </div>
        {hasGap && m.gap_market ? (
          <>
            <Nastro market={Number(pctInt(lead.market_p_at_seal))} estimate={Number(pctInt(lead.sealed_p))} marketLabel={c.tennisMarketAtSeal} estimateLabel={c.tennisSealedEstimate} />
            <p className="v3c-explain">{t.tennis.gapVs(bookName(m.gap_market.bookmaker), sealedStamp(m.gap_market.captured_at, locale))}</p>
          </>
        ) : (
          <p className="v3c-mt-note">
            <b>{marketOnly ? t.tennis.marketOnly : t.tennis.coming}</b>
            <br />
            {tennisNoGap(m, c)}
          </p>
        )}
        <div className="v3c-mt-out v3c-mt-out-tn" role="table" aria-label={t.tennis.winner}>
          <div className="v3c-mt-oh" role="row">
            <span className="v3c-lab" role="columnheader">
              {t.tennis.winner}
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
            <span className="v3c-lab v3c-ra v3c-mt-c-seal" role="columnheader">
              {t.tennis.sealedCol}
            </span>
            <span className="v3c-lab v3c-ra" role="columnheader">
              {t.tennis.gapCol}
            </span>
          </div>
          {m.sides.map((x) => (
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
              <span role="cell" className="v3c-num v3c-ra">
                {marketOnly ? pctOrDash(x.estimate_p) : <mark>{pctOrDash(x.estimate_p)}</mark>}
              </span>
              <span role="cell" className="v3c-num v3c-ra v3c-mt-c-seal">
                {pctOrDash(x.sealed_p)}
              </span>
              <span role="cell" className={["v3c-num", "v3c-ra", isFlatGap(x.gap_pp) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
                {x.gap_pp == null ? "—" : `${gapText(x.gap_pp)} pp`}
              </span>
            </div>
          ))}
        </div>
        <p className="v3c-pn-facts v3c-small" style={{ marginTop: 10, display: "flex", gap: "4px 14px", flexWrap: "wrap" }}>
          {lead.model_p != null ? <span>{t.tennis.rawElo(pctInt(lead.model_p))}</span> : null}
          {m.margin_removed != null ? <span>{t.board.margin(`${(m.margin_removed * 100).toFixed(1)}%`)}</span> : null}
          <span>{t.board.estimateAsOf(sealedStamp(m.estimate_as_of, locale))}</span>
        </p>
      </section>

      <section className="v3c-mt-step" aria-labelledby="v3c-s2">
        <StepHead n={2} id="v3c-s2" title={c.s2} />
        <Tape
          ctx={ctx}
          series={series}
          events={events}
          choices={choices}
          initial={lead.side}
          estimateAsOf={marketOnly ? null : m.estimate_as_of}
          why={(summary) => (
            <ol className="v3c-mt-why">
              <MovedItem ctx={ctx} n={1} summary={summary} />
              <li>
                <span className="k">{summary ? 2 : 1}</span>
                <div>
                  <h3>{kind}</h3>
                  <p>{hasGap ? t.tennis.gapVs(bookName(m.gap_market?.bookmaker ?? ""), sealedStamp(m.gap_market?.captured_at ?? "", locale)) : tennisNoGap(m, c)}</p>
                </div>
              </li>
              <SealItem ctx={ctx} n={summary ? 3 : 2} sealedAt={m.sealed_at} />
            </ol>
          )}
          strip={strip ? <ToolStrip title={c.stripTennis} all={c.allTools} items={strip} lang={lang} /> : null}
        />
      </section>

      <section className="v3c-mt-step" aria-labelledby="v3c-s3">
        <StepHead n={3} id="v3c-s3" title={c.s3} />
        <PartnerBlock id="v3c-mt-p" title={c.bestAmong(books.filter((b) => b.price != null).length)} label={lead.player} books={books} checked={chk ? timeHM(chk, ctx.tz, locale) : null} partners={partners} surface="match" c={c} age={t.foot.age} />
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
      <Head ctx={ctx} tab={p.sport === "tennis" ? c.tabTennis : c.tabFootball} home={p.home} away={p.away} kickoff={p.kickoff} league={null} sealedAt={null} />
      <p className="v3c-mt-note" style={{ marginBottom: 24 }}>
        {c.offBoard}
      </p>
      <section className="v3c-mt-step" aria-labelledby="v3c-s2">
        <StepHead n={2} id="v3c-s2" title={c.s2} />
        <Tape ctx={ctx} series={p.series} events={p.events} choices={choices} initial={choices[0].key} estimateAsOf={null} why={(s) => <ol className="v3c-mt-why"><MovedItem ctx={ctx} n={1} summary={s} /></ol>} />
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
