"use client";
// components/v3c/board/BoardRow.tsx (#REDESIGN-V3C F3)
// Una riga = una partita = una decisione. Ordine di lettura fisso: ora ·
// monogrammi e partita · prezzo · mercato→stima sulla scala · gap con segno ·
// SOLO DOPO la lettura il miglior prezzo di un book connesso. Il tocco apre il
// pannello: tutti gli esiti, il sigillo spiegato, i book, e l'unico bottone.
//
// Tennis (tennis2, Andrea 07/10): Market → Estimate → Gap come il calcio, ma SOLO dove il
// contratto dice estimate_kind 'elo_blend_unsealed' (0,1·Elo + 0,9·mercato, Elo ≤ 6 h, ATP/WTA):
// stima senza evidenziatore, etichetta «Elo-based, not sealed», gap ATTENUATO (grigio, mai
// verde/rosso, nessuna freccia, nessun badge). Altrove «Market only», nessuna colonna vuota.
import Link from "next/link";
import { useId } from "react";
import type { V3BookPrice } from "@/lib/v3c/contracts";
import type { OddsOnSitePartner } from "@/lib/price-books";
import type { V3cCopy } from "@/lib/v3c/copy";
import { gapText, isFlatGap, outcomeLabel, pctInt, price2, sealedStamp, timeHM, dayShort, topShared, type BoardRowVM, type TennisRowVM } from "@/lib/v3c/board-view";
import { trackEvent } from "@/lib/track-event";
import { matchHref } from "@/lib/v3c/match-view";
import { Monogrammi } from "../Monogramma";
import { PartnerLogo, needsName } from "../PartnerLogo";
import { Arrow } from "../Arrow";
import { Sigillo } from "../Sigillo";
import { RowScale } from "./RowScale";
import { Tape } from "../Tape";
import type { RowTape } from "@/lib/v3c/tape";
import type { V3LiveItem } from "@/lib/v3c/live-contract";
import type { V3cLiveCopy } from "@/lib/v3c/live-copy";
import { liveBadge, type LiveBadge } from "@/lib/v3c/live-view";
import { tennisEstimateOf } from "@/lib/v3c/tennis-estimate";
import { LiveScoreChip, LiveTimeCell } from "../live/LiveBits";
import { fixdataCopyFor } from "@/lib/v3c/fixdata-copy";
import { hasStarted, valueToolsAllowed, zoneAbbr } from "@/lib/v3c/fixdata";
import "../ui3.css";
import "../fixdata.css";
import "../tennis2.css";

type Common = {
  t: V3cCopy;
  tz: string | undefined;
  locale: string;
  now: Date;
  open: boolean;
  onToggle: () => void;
  /** false nei paesi dove i link ai book vanno nascosti */
  partners: boolean;
  /** F7: partner senza quota letta, mostrati col bottone «Odds on partner site» */
  siteOnly?: OddsOnSitePartner[];
  surface: "home" | "predictions";
  /** fidelity: il tape «open → now» dai dati veri; assente = meno di due catture */
  tape?: RowTape;
  /** livescores: il punteggio della fonte (GET /api/v3/live), solo informazione; assente = nessun dato */
  live?: V3LiveItem;
  /** livescores: la prima risposta è arrivata (da qui «nessun item» vuol dire «punteggio n.d.») */
  liveLoaded?: boolean;
  lc?: V3cLiveCopy;
};

/** livescores: il badge della riga — solo se la fonte ha un dato (fixdata B1). */
function rowBadge(live: V3LiveItem | undefined, loaded: boolean | undefined, lc: V3cLiveCopy | undefined, sport: "football" | "tennis"): LiveBadge | null {
  // fixdata B1: without an item from the live feed there is no badge — the time cell says «Started», never «Kick-off/Start hh:mm»
  if (!lc || !live) return null;
  return liveBadge(live, Boolean(loaded), lc, sport);
}

/** Il chip del book: marchio · quota. Link affiliato reale (deep-link o landing del registro), tracciato. */
/** ui2: `compact` (la colonna stretta della riga) = solo logo e quota, il nome resta nel nome accessibile e nel title. */
export function BookChip({ b, t, surface, outcome, compact = false }: { b: V3BookPrice; t: V3cCopy; surface: string; outcome: string; compact?: boolean }) {
  return (
    <a
      className="v3c-bchip"
      href={b.url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      data-partner={b.bookmaker}
      title={b.name}
      onClick={(e) => {
        e.stopPropagation();
        trackEvent("partner_click", { partner_id: b.name, meta: { surface: `v3c_${surface}`, kind: "chip", outcome } });
      }}
    >
      <PartnerLogo id={b.bookmaker} name={b.name} size="chip" decorative />
      {!compact && needsName(b.bookmaker, b.name) ? <span className="v3c-bchip-n" aria-hidden="true">{b.name}</span> : null}
      <b>{price2(b.price)}</b>
      <span className="v3c-sr">{t.board.partnerAria(b.name)}</span>
    </a>
  );
}

function TimeCell({ kickoff, tz, locale, now, badge }: { kickoff: string; tz: string | undefined; locale: string; now: Date; badge: LiveBadge | null }) {
  if (badge) return <LiveTimeCell badge={badge} kickoffTime={timeHM(kickoff, tz, locale)} />;
  // fixdata B1: started and no score from the live feed (or past the live window, a long tennis match) — «Started»,
  // never «Start hh:mm» again, and not «Live» from the clock either: without a score we do not know it is in play
  if (hasStarted(kickoff, now))
    return (
      <span className="v3c-r-time">
        <em className="v3c-live v3c-started">{fixdataCopyFor(locale).startedGroup}</em>
        <small>{timeHM(kickoff, tz, locale)}</small>
      </span>
    );
  return (
    <span className="v3c-r-time">
      {timeHM(kickoff, tz, locale)}
      <small>{dayShort(kickoff, tz, locale)}</small>
    </span>
  );
}

function PanelBooks({ books, t, surface, label, partners }: { books: V3BookPrice[]; t: V3cCopy; surface: string; label: string; partners: boolean }) {
  if (!partners) return <p className="v3c-fine">{t.board.partnerBlocked}</p>;
  if (!books.length) return <p className="v3c-fine">{t.board.noFeedBooks}</p>;
  return (
    <div className="v3c-pn-books">
      <span className="v3c-lab">{t.board.booksFor(label)}</span>
      <span className="v3c-chips">
        {books.map((b) => (
          <BookChip key={b.bookmaker} b={b} t={t} surface={surface} outcome={label} />
        ))}
      </span>
    </div>
  );
}

/** F7: i partner di cui non leggiamo la quota — marchio e link affiliato reale, mai un numero. */
function SiteOnlyBooks({ list, t, surface }: { list: OddsOnSitePartner[] | undefined; t: V3cCopy; surface: string }) {
  if (!list?.length) return null;
  return (
    <div className="v3c-pn-books v3c-siteonly">
      <span className="v3c-lab">{t.board.siteOnlyLab}</span>
      <span className="v3c-chips">
        {list.map((p) => (
          <a
            key={p.partner_id}
            className="v3c-bchip"
            href={p.url}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            data-partner={p.partner_id}
            data-reason={p.reason}
            onClick={(e) => {
              e.stopPropagation();
              trackEvent("partner_click", { partner_id: p.name, meta: { surface: `v3c_${surface}`, kind: "odds_on_site" } });
            }}
          >
            <PartnerLogo id={p.partner_id} name={p.name} size="chip" decorative />
            {needsName(p.partner_id, p.name) ? <span aria-hidden="true">{p.name}</span> : null}
            <small>{t.board.oddsOnSite}</small>
            <span className="v3c-sr">{t.board.partnerAria(p.name)}</span>
          </a>
        ))}
      </span>
      <p className="v3c-fine">{t.board.siteOnlyNote}</p>
    </div>
  );
}

function BestCta({ best, shared, t, surface, label, tz, locale }: { best: V3BookPrice; shared: number; t: V3cCopy; surface: string; label: string; tz?: string; locale?: string }) {
  // fixdata B2: the time the price was read, in the visitor's zone
  const at = best.captured_at ? fixdataCopyFor(locale).priceAt(timeHM(best.captured_at, tz, locale), zoneAbbr(best.captured_at, tz, locale)) : null;
  // polish: «best» solo se un book paga strettamente di più; a pari prezzo nessuna CTA verso uno dei due
  if (shared > 1) return <p className="v3c-pn-cta v3c-small">{t.board.sharedTop(label, price2(best.price), shared)}</p>;
  return (
    <div className="v3c-pn-cta">
      <a
        className="v3c-btn v3c-btn-cta"
        href={best.url}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        onClick={() => trackEvent("partner_click", { partner_id: best.name, meta: { surface: `v3c_${surface}`, kind: "best_price", outcome: label } })}
      >
        {t.board.bestCta(label, price2(best.price), best.name)} <Arrow up />
      </a>
      <p className="v3c-fine">
        {at ? <span className="v3c-price-at">{at} · </span> : null}
        {t.board.bestNote}
      </p>
    </div>
  );
}

/** fidelity: il tape della riga (prototipo «Open → now»): gradini veri, «2.02 → 2.15» accanto su mobile. */
function TapeCell({ tape, label, t }: { tape: RowTape | undefined; label: string; t: V3cCopy }) {
  if (!tape) return <span className="v3c-r-tape v3c-r-tape-none">{t.board.tapeNone}</span>;
  return (
    <span className="v3c-r-tape">
      <Tape points={tape.pts.map(([x, v]) => ({ t: x, v }))} fair={tape.fair} sealT={tape.fairT} label={t.board.tapeAria(label, price2(tape.from), price2(tape.to), tape.n)} />
      <small className="v3c-num" aria-hidden="true">
        {price2(tape.from)} → {price2(tape.to)}
      </small>
    </span>
  );
}

/** fidelity: mercato e stima in due colonne di numeri (prototipo), «—» dove il contratto non porta il dato. */
function MkEs({ market, estimate, markEstimate = true }: { market: number | null | undefined; estimate: number | null | undefined; markEstimate?: boolean }) {
  return (
    <>
      <span className={market == null ? "v3c-r-mk v3c-r-none" : "v3c-r-mk v3c-num"}>{market == null ? "—" : <>{pctInt(market)}<small>%</small></>}</span>
      <span className={estimate == null ? "v3c-r-es v3c-r-none" : "v3c-r-es v3c-num"}>
        {estimate == null ? "—" : markEstimate ? <mark>{pctInt(estimate)}<small>%</small></mark> : <>{pctInt(estimate)}<small>%</small></>}
      </span>
    </>
  );
}

/** fidelity, mobile: «44% → 48%» sotto il gap, come il ledger a due livelli del prototipo. */
function MeLine({ market, estimate }: { market: number | null | undefined; estimate: number | null | undefined }) {
  if (market == null && estimate == null) return null;
  return (
    <span className="v3c-r-me" aria-hidden="true">
      {market != null ? <span className="v3c-m">{pctInt(market)}%</span> : null}
      {market != null && estimate != null ? " → " : null}
      {estimate != null ? <mark>{pctInt(estimate)}%</mark> : null}
    </span>
  );
}

export function FootballRow({ r, t, tz, locale, now, open, onToggle, partners, siteOnly, surface, tape, live, liveLoaded, lc }: Common & { r: BoardRowVM }) {
  const panelId = useId();
  const { m, lead } = r;
  const badge = rowBadge(live, liveLoaded, lc, "football");
  const match = `${m.home} – ${m.away}`;
  const leadLabel = outcomeLabel(m, lead.outcome, t.board.draw);
  const g = lead.edge_pp;
  const flat = isFlatGap(g);
  const others = r.others
    .map((o) => `${outcomeLabel(m, o.outcome, t.board.draw)} ${gapText(o.edge_pp)}`)
    .join(" · ");
  const scaleAria = lead.market_p == null ? t.board.scaleAriaNoMarket(pctInt(lead.estimate_p)) : t.board.scaleAria(pctInt(lead.market_p), pctInt(lead.estimate_p), gapText(g));
  // fixdata B1: a started match has no book, no best price, no partner button
  const started = hasStarted(m.kickoff, now);
  // fixdata B5: model far from the market — no edge badge (neutral gap); > 25 pp «Market only»
  const fc = fixdataCopyFor(locale);
  const guard = m.model_guard?.level ?? "ok";
  return (
    <div className={["v3c-row", open ? "v3c-row-open" : null].filter(Boolean).join(" ")} data-sport="football">
      <TimeCell kickoff={m.kickoff} tz={tz} locale={locale} now={now} badge={badge} />
      <span className="v3c-r-teams">
        <Monogrammi home={{ name: m.home }} away={{ name: m.away }} />
        <span className="v3c-r-name">
          <button type="button" className="v3c-rowlink v3c-t-row" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
            {match}
            <span className="v3c-sr">, {t.board.rowAria(leadLabel, price2(lead.market_price), pctInt(lead.market_p), pctInt(lead.estimate_p), gapText(g))}</span>
          </button>
          <small>
            {badge?.score ? <LiveScoreChip score={badge.score} final={badge.tone === "done"} /> : null}
            {m.competition || m.league || t.toolbar.football} · <b>{leadLabel}</b>
            {others && g != null ? <span className="v3c-r-others"> · {others}</span> : null}
          </small>
        </span>
      </span>
      <TapeCell tape={tape} label={leadLabel} t={t} />
      <span className="v3c-r-price v3c-num">{price2(lead.market_price)}</span>
      <MkEs market={lead.market_p} estimate={lead.estimate_p} />
      <span className={["v3c-r-gap", "v3c-num", flat || !valueToolsAllowed(m) ? "v3c-g-flat" : null, g == null ? "v3c-g-none" : null].filter(Boolean).join(" ")} title={guard === "market_only" ? fc.marketOnly : guard === "no_value" ? `${scaleAria} · ${fc.noValue}` : scaleAria} data-guard={guard}>
        {g == null ? (
          <small className="v3c-r-nomkt">{t.board.noMarket}</small>
        ) : guard === "market_only" ? (
          <small className="v3c-r-nomkt">{t.tennis.marketOnly}</small>
        ) : flat ? (
          <span>
            {gapText(g)}
            <small> {t.board.inLine}</small>
          </span>
        ) : (
          <span>
            {gapText(g)}
            <small> pp</small>
          </span>
        )}
        <MeLine market={lead.market_p} estimate={lead.estimate_p} />
      </span>
      <span className="v3c-r-book">
        {partners && r.best ? <><BookChip b={r.best} t={t} surface={surface} outcome={leadLabel} compact />{topShared(lead).length > 1 ? <small className="v3c-r-tie">{t.board.sameAt(topShared(lead).length)}</small> : null}</> : <small className="v3c-r-nobook">{partners && !started ? t.board.noPrice : ""}</small>}
      </span>
      <span className="v3c-chev" aria-hidden="true">
        {open ? "–" : "+"}
      </span>
      {open ? (
        <div className="v3c-pn" id={panelId}>
          <div className="v3c-pn-o" role="table" aria-label={t.board.allOutcomes}>
            <div className="v3c-pn-oh" role="row">
              <span className="v3c-lab" role="columnheader">
                {t.board.outcome}
              </span>
              <span className="v3c-lab v3c-ra" role="columnheader">
                {t.board.price}
              </span>
              <span className="v3c-lab" role="columnheader">
                {t.board.scaleHead}
              </span>
              <span className="v3c-lab v3c-ra" role="columnheader">
                {t.board.gap}
              </span>
            </div>
            {m.outcomes.map((o) => {
              const lab = outcomeLabel(m, o.outcome, t.board.draw);
              return (
                <div key={o.outcome} role="row" className={o === lead ? "v3c-pn-lead" : undefined}>
                  <span role="cell" className="v3c-pn-who">
                    {lab}
                  </span>
                  <span role="cell" className="v3c-num v3c-ra">
                    {price2(o.market_price)}
                  </span>
                  <span role="cell">
                    <RowScale market={o.market_p} estimate={o.estimate_p} label={o.market_p == null ? t.board.scaleAriaNoMarket(pctInt(o.estimate_p)) : t.board.scaleAria(pctInt(o.market_p), pctInt(o.estimate_p), gapText(o.edge_pp))} />
                  </span>
                  <span role="cell" className={["v3c-num", "v3c-ra", isFlatGap(o.edge_pp) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
                    {o.edge_pp == null ? "—" : `${gapText(o.edge_pp)} pp`}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="v3c-pn-facts v3c-small">
            <span>{m.blend ? t.board.blend : t.board.modelOnly}</span>
            {m.margin_removed != null ? <span>{t.board.margin(`${(m.margin_removed * 100).toFixed(1)}%`)}</span> : null}
            <span>{t.board.estimateAsOf(sealedStamp(m.estimate_as_of, locale))}</span>
          </p>
          {m.sealed_at ? (
            <p className="v3c-pn-seal">
              <Sigillo sealedAt={m.sealed_at} label={t.fascia.sealed} title={t.board.sealedWhy(sealedStamp(m.sealed_at, locale))} />
              <span className="v3c-small">{t.board.sealedWhy(sealedStamp(m.sealed_at, locale))}</span>
            </p>
          ) : null}
          {m.blend == null ? <p className="v3c-fine">{t.board.noMarketLong}</p> : null}
          {guard !== "ok" ? <p className="v3c-fine" data-guard={guard}>{guard === "market_only" ? fc.marketOnly : fc.noValue}</p> : null}
          <p className="v3c-small">
            <Link href={matchHref(m.id)}>{t.board.openMatch}</Link>
          </p>
          {started ? <p className="v3c-fine">{fc.startedNote}</p> : <PanelBooks books={lead.book_prices} t={t} surface={surface} label={leadLabel} partners={partners} />}
          {partners && !started ? <SiteOnlyBooks list={siteOnly} t={t} surface={surface} /> : null}
          {partners && r.best ? <BestCta best={r.best} shared={topShared(lead).length} t={t} surface={surface} label={leadLabel} tz={tz} locale={locale} /> : null}
        </div>
      ) : null}
    </div>
  );
}

const pctOrDash = (p: number | null | undefined) => (p == null ? "—" : `${pctInt(p)}%`);

export function TennisRow({ r, t, tz, locale, now, open, onToggle, partners, siteOnly, surface, tape, live, liveLoaded, lc }: Common & { r: TennisRowVM }) {
  const panelId = useId();
  const { m, lead } = r;
  const badge = rowBadge(live, liveLoaded, lc, "tennis");
  const match = `${m.player1} – ${m.player2}`;
  const leadLabel = lead.player;
  // tennis2: la stima solo dove il contratto la porta; il gap è informativo, attenuato, mai un segnale
  const est = tennisEstimateOf(m, lead.side);
  const elo = est.kind === "elo_blend_unsealed" && est.estimate != null;
  // la home non mostra il gap del tennis (resta il mercato con la stima accanto); il gap vive sulla board e sulla partita
  const noGap = surface === "home";
  const gap = noGap ? null : est.gap;
  const kindLabel = elo ? t.tennis.eloLabel : t.tennis.marketOnly;
  const scaleLabel =
    lead.market_p == null
      ? t.board.noMarket
      : elo
        ? t.tennis.scaleAriaElo(pctInt(lead.market_p), pctInt(est.estimate), gap == null ? null : gapText(gap))
        : `${t.tennis.scaleAriaMarket(pctInt(lead.market_p))}, ${t.tennis.marketOnly}`;
  const sideEst = (x: (typeof m.sides)[number]) => tennisEstimateOf(m, x.side);
  const started = hasStarted(m.kickoff, now);
  return (
    <div className={["v3c-row", "v3c-row-tn", open ? "v3c-row-open" : null].filter(Boolean).join(" ")} data-sport="tennis" data-estimate={elo ? "elo" : "market"}>
      <TimeCell kickoff={m.kickoff} tz={tz} locale={locale} now={now} badge={badge} />
      <span className="v3c-r-teams">
        <Monogrammi home={{ name: m.player1 }} away={{ name: m.player2 }} />
        <span className="v3c-r-name">
          <button type="button" className="v3c-rowlink v3c-t-row" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
            {match}
            <span className="v3c-sr">, {t.tennis.rowAria(leadLabel, scaleLabel)}</span>
          </button>
          <small>
            {badge?.score ? <LiveScoreChip score={badge.score} final={badge.tone === "done"} /> : null}
            {m.tournament || t.tennis.title} · <b>{leadLabel}</b>
            <span className="v3c-tn-kind" aria-hidden="true"> · {kindLabel}</span>
          </small>
        </span>
      </span>
      <TapeCell tape={tape} label={leadLabel} t={t} />
      <span className="v3c-r-price v3c-num">{price2(lead.market_price)}</span>
      <span className={lead.market_p == null ? "v3c-r-mk v3c-r-none" : "v3c-r-mk v3c-num"}>{lead.market_p == null ? "—" : <>{pctInt(lead.market_p)}<small>%</small></>}</span>
      {elo ? (
        <>
          {/* la stima tennis non porta l'evidenziatore lime: non è sigillata */}
          <span className="v3c-r-es v3c-num v3c-r-es-tn">{pctInt(est.estimate)}<small>%</small></span>
          <span className={["v3c-r-gap", "v3c-num", "v3c-g-tn", noGap ? "v3c-g-none" : null].filter(Boolean).join(" ")} title={noGap ? scaleLabel : est.gap == null ? t.tennis.gapHidden : scaleLabel}>
            {noGap ? (
              <small className="v3c-r-nomkt">{t.tennis.eloLabel}</small>
            ) : gap == null ? (
              <small className="v3c-r-nomkt">—</small>
            ) : (
              <span>
                {gapText(gap)}
                <small> pp</small>
              </span>
            )}
            <span className="v3c-r-me" aria-hidden="true">
              {lead.market_p != null ? <span className="v3c-m">{pctInt(lead.market_p)}%</span> : null}
              {lead.market_p != null ? " → " : null}
              <span className="v3c-tn-e">{pctInt(est.estimate)}%</span>
            </span>
          </span>
        </>
      ) : (
        <>
          {/* Market only: una sola etichetta al posto di Estimate e Gap (desktop); su mobile il mercato al posto del gap */}
          <span className="v3c-r-es v3c-r-tnonly">{t.tennis.marketOnly}</span>
          <span className="v3c-r-gap v3c-g-none v3c-r-tnm" title={scaleLabel}>
            <span className="v3c-r-tnm-v v3c-num" aria-hidden="true">
              {pctOrDash(lead.market_p)}
              <small>{t.tennis.marketOnly}</small>
            </span>
          </span>
        </>
      )}
      <span className="v3c-r-book">
        {partners && r.best ? <><BookChip b={r.best} t={t} surface={surface} outcome={leadLabel} compact />{topShared(lead).length > 1 ? <small className="v3c-r-tie">{t.board.sameAt(topShared(lead).length)}</small> : null}</> : <small className="v3c-r-nobook">{partners && !started ? t.board.noPrice : ""}</small>}
      </span>
      <span className="v3c-chev" aria-hidden="true">
        {open ? "–" : "+"}
      </span>
      {open ? (
        <div className="v3c-pn" id={panelId}>
          <div className={["v3c-pn-o", elo ? (noGap ? "v3c-pn-o-tn4" : "v3c-pn-o-tn5") : "v3c-pn-o-tn3"].join(" ")} role="table" aria-label={t.tennis.winner}>
            <div className="v3c-pn-oh" role="row">
              <span className="v3c-lab" role="columnheader">
                {t.tennis.winner}
              </span>
              <span className="v3c-lab v3c-ra" role="columnheader">
                {t.board.price}
              </span>
              <span className="v3c-lab v3c-ra" role="columnheader">
                {t.board.market}
              </span>
              {elo ? (
                <>
                  <span className="v3c-lab v3c-ra" role="columnheader">
                    {t.board.estimate}
                  </span>
                  {noGap ? null : (
                    <span className="v3c-lab v3c-ra" role="columnheader">
                      {t.board.gap}
                    </span>
                  )}
                </>
              ) : null}
            </div>
            {m.sides.map((x) => (
              <div key={x.side} role="row" className={x === lead ? "v3c-pn-lead" : undefined}>
                <span role="cell" className="v3c-pn-who">
                  {x.player}
                </span>
                <span role="cell" className="v3c-num v3c-ra">
                  {price2(x.market_price)}
                </span>
                <span role="cell" className="v3c-num v3c-ra v3c-m">
                  {pctOrDash(x.market_p)}
                </span>
                {elo ? (
                  <>
                    <span role="cell" className="v3c-num v3c-ra">
                      {pctOrDash(sideEst(x).estimate)}
                    </span>
                    {noGap ? null : (
                      <span role="cell" className="v3c-num v3c-ra v3c-g-tn">
                        {sideEst(x).gap == null ? "—" : `${gapText(sideEst(x).gap)} pp`}
                      </span>
                    )}
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <p className="v3c-pn-facts v3c-small">
            {elo ? <span>{t.tennis.blendFact}</span> : null}
            {m.margin_removed != null ? <span>{t.board.margin(`${(m.margin_removed * 100).toFixed(1)}%`)}</span> : null}
            <span>{t.fascia.pricesAsOf(sealedStamp(m.market_source?.as_of ?? m.estimate_as_of, locale))}</span>
            {elo && m.elo_as_of ? <span>{t.tennis.eloAsOf(sealedStamp(m.elo_as_of, locale))}</span> : null}
          </p>
          <p className="v3c-small v3c-pn-note">{elo ? (est.gap == null && !noGap ? `${t.tennis.caveat} ${t.tennis.gapHidden}.` : t.tennis.caveat) : t.tennis.noEstimate}</p>
          {m.sealed_at ? (
            <p className="v3c-pn-seal">
              <Sigillo sealedAt={m.sealed_at} label={t.fascia.sealed} title={t.tennis.sealedWhy(sealedStamp(m.sealed_at, locale))} />
              <span className="v3c-small">{t.tennis.sealedWhy(sealedStamp(m.sealed_at, locale))}</span>
            </p>
          ) : null}
          <p className="v3c-small">
            <Link href={matchHref(m.id)}>{t.board.openMatch}</Link>
          </p>
          {started ? (
            <p className="v3c-fine">{fixdataCopyFor(locale).startedNote}</p>
          ) : partners ? (
            m.sides.map((x) =>
              x.book_prices.length ? (
                <div key={x.side} className="v3c-pn-books">
                  <span className="v3c-lab">{t.board.booksFor(x.player)}</span>
                  <span className="v3c-chips">
                    {x.book_prices.map((b) => (
                      <BookChip key={b.bookmaker} b={b} t={t} surface={surface} outcome={x.player} />
                    ))}
                  </span>
                </div>
              ) : null,
            )
          ) : (
            <p className="v3c-fine">{t.board.partnerBlocked}</p>
          )}
          {partners && !started ? <SiteOnlyBooks list={siteOnly} t={t} surface={surface} /> : null}
          {partners && r.best ? <BestCta best={r.best} shared={topShared(lead).length} t={t} surface={surface} label={leadLabel} tz={tz} locale={locale} /> : null}
        </div>
      ) : null}
    </div>
  );
}
