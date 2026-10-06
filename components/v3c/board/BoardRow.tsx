"use client";
// components/v3c/board/BoardRow.tsx (#REDESIGN-V3C F3)
// Una riga = una partita = una decisione. Ordine di lettura fisso: ora ·
// monogrammi e partita · prezzo · mercato→stima sulla scala · gap con segno ·
// SOLO DOPO la lettura il miglior prezzo di un book connesso. Il tocco apre il
// pannello: tutti gli esiti, il sigillo spiegato, i book, e l'unico bottone.
//
// Tennis: la riga mostra tutto ciò che il contratto porta (stima, prezzi dei
// book connessi) e dice onestamente cosa manca («market comparison coming»):
// nessun mercato, nessun gap, mai un valore inventato.
import Link from "next/link";
import { useId } from "react";
import type { V3BookPrice } from "@/lib/v3c/contracts";
import type { OddsOnSitePartner } from "@/lib/price-books";
import type { V3cCopy } from "@/lib/v3c/copy";
import { gapText, isFlatGap, liveState, outcomeLabel, pctInt, price2, sealedStamp, timeHM, dayShort, topShared, type BoardRowVM, type TennisRowVM } from "@/lib/v3c/board-view";
import { trackEvent } from "@/lib/track-event";
import { matchHref } from "@/lib/v3c/match-view";
import { Monogrammi } from "../Monogramma";
import { Arrow } from "../Arrow";
import { Sigillo } from "../Sigillo";
import { RowScale } from "./RowScale";

type Common = {
  t: V3cCopy;
  tz: string | undefined;
  locale: string;
  now: Date;
  open: boolean;
  onToggle: () => void;
  /** false nei paesi dove i link ai book vanno nascosti */
  partners: boolean;
  /** F7: partner senza quota letta, mostrati col bottone «Odds on site» */
  siteOnly?: OddsOnSitePartner[];
  surface: "home" | "predictions";
};

/** Il chip del book: marchio · quota. Link affiliato reale (deep-link o landing del registro), tracciato. */
export function BookChip({ b, t, surface, outcome }: { b: V3BookPrice; t: V3cCopy; surface: string; outcome: string }) {
  return (
    <a
      className="v3c-bchip"
      href={b.url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      data-partner={b.bookmaker}
      onClick={(e) => {
        e.stopPropagation();
        trackEvent("partner_click", { partner_id: b.name, meta: { surface: `v3c_${surface}`, kind: "chip", outcome } });
      }}
    >
      <BookLogo b={b} />
      <b>{price2(b.price)}</b>
      <span className="v3c-sr">{t.board.partnerAria(b.name)}</span>
    </a>
  );
}

const BOOK_COLOUR: Record<string, string> = { fortuneplay: "#1B1F5E", ybets: "#0B6B4F" };

function BookLogo({ b }: { b: Pick<V3BookPrice, "bookmaker" | "name"> }) {
  const code = b.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  return (
    <span className="v3c-bk" style={{ "--bk": BOOK_COLOUR[b.bookmaker] ?? "#14171C" } as React.CSSProperties} aria-hidden="true">
      {code}
    </span>
  );
}

function TimeCell({ kickoff, t, tz, locale, now, sport }: { kickoff: string; t: V3cCopy; tz: string | undefined; locale: string; now: Date; sport: "football" | "tennis" }) {
  const live = liveState(kickoff, now);
  // Tennis: nessun minuto di gioco (e il contratto non porta il punteggio dei set) → solo «Live».
  if (live.live)
    return (
      <span className="v3c-r-time">
        <em className="v3c-live">{t.board.live}</em>
        {sport === "football" ? <small>{t.board.liveSince(live.minutes)}</small> : null}
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
            <BookLogo b={{ bookmaker: p.partner_id, name: p.name }} />
            <span>{p.name}</span>
            <small>{t.board.oddsOnSite}</small>
            <span className="v3c-sr">{t.board.partnerAria(p.name)}</span>
          </a>
        ))}
      </span>
      <p className="v3c-fine">{t.board.siteOnlyNote}</p>
    </div>
  );
}

function BestCta({ best, shared, t, surface, label }: { best: V3BookPrice; shared: number; t: V3cCopy; surface: string; label: string }) {
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
      <p className="v3c-fine">{t.board.bestNote}</p>
    </div>
  );
}

export function FootballRow({ r, t, tz, locale, now, open, onToggle, partners, siteOnly, surface }: Common & { r: BoardRowVM }) {
  const panelId = useId();
  const { m, lead } = r;
  const match = `${m.home} – ${m.away}`;
  const leadLabel = outcomeLabel(m, lead.outcome, t.board.draw);
  const g = lead.edge_pp;
  const flat = isFlatGap(g);
  const others = r.others
    .map((o) => `${outcomeLabel(m, o.outcome, t.board.draw)} ${gapText(o.edge_pp)}`)
    .join(" · ");
  const scaleAria = lead.market_p == null ? t.board.scaleAriaNoMarket(pctInt(lead.estimate_p)) : t.board.scaleAria(pctInt(lead.market_p), pctInt(lead.estimate_p), gapText(g));
  return (
    <div className={["v3c-row", open ? "v3c-row-open" : null].filter(Boolean).join(" ")} data-sport="football">
      <TimeCell kickoff={m.kickoff} t={t} tz={tz} locale={locale} now={now} sport="football" />
      <span className="v3c-r-teams">
        <Monogrammi home={{ name: m.home }} away={{ name: m.away }} />
        <span className="v3c-r-name">
          <button type="button" className="v3c-rowlink v3c-t-row" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
            {match}
            <span className="v3c-sr">, {t.board.rowAria(leadLabel, price2(lead.market_price), pctInt(lead.market_p), pctInt(lead.estimate_p), gapText(g))}</span>
          </button>
          <small>
            {m.competition || m.league || t.toolbar.football} · <b>{leadLabel}</b>
            {others && g != null ? <span className="v3c-r-others"> · {others}</span> : null}
          </small>
        </span>
      </span>
      <span className="v3c-r-price v3c-num">{price2(lead.market_price)}</span>
      <RowScale className="v3c-r-scale" market={lead.market_p} estimate={lead.estimate_p} label={scaleAria} />
      <span className={["v3c-r-gap", "v3c-num", flat ? "v3c-g-flat" : null, g == null ? "v3c-g-none" : null].filter(Boolean).join(" ")}>
        {g == null ? (
          <small className="v3c-r-nomkt">{t.board.noMarket}</small>
        ) : flat ? (
          <>
            {gapText(g)}
            <small> {t.board.inLine}</small>
          </>
        ) : (
          <>
            {gapText(g)}
            <small> pp</small>
          </>
        )}
      </span>
      <span className="v3c-r-book">
        {partners && r.best ? <><BookChip b={r.best} t={t} surface={surface} outcome={leadLabel} />{topShared(lead).length > 1 ? <small className="v3c-r-tie">{t.board.sameAt(topShared(lead).length)}</small> : null}</> : <small className="v3c-r-nobook">{partners ? t.board.noPrice : ""}</small>}
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
          <p className="v3c-small">
            <Link href={matchHref(m.id)}>{t.board.openMatch}</Link>
          </p>
          <PanelBooks books={lead.book_prices} t={t} surface={surface} label={leadLabel} partners={partners} />
          {partners ? <SiteOnlyBooks list={siteOnly} t={t} surface={surface} /> : null}
          {partners && r.best ? <BestCta best={r.best} shared={topShared(lead).length} t={t} surface={surface} label={leadLabel} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Perché il tennis non ha un gap, nella lingua del visitatore (il motivo del contratto è inglese tecnico). */
function tennisNoGap(m: TennisRowVM["m"], t: V3cCopy): string {
  if (!m.is_our_model) return t.tennis.marketOnlyLong;
  const r = m.gap_null_reason ?? "";
  if (r.startsWith("not sealed")) return t.tennis.reasonNotSealed;
  if (r.startsWith("no FortunePlay")) return t.tennis.reasonNoMarketAtSeal;
  if (r) return t.tennis.reasonAnchored;
  return t.tennis.comingLong;
}

const pctOrDash = (p: number | null | undefined) => (p == null ? "—" : `${pctInt(p)}%`);

export function TennisRow({ r, t, tz, locale, now, open, onToggle, partners, siteOnly, surface }: Common & { r: TennisRowVM }) {
  const panelId = useId();
  const { m, lead } = r;
  const match = `${m.player1} – ${m.player2}`;
  const leadLabel = lead.player;
  // Il gap del tennis esiste SOLO dove il contratto lo dà: stima sigillata del nostro Elo − prezzo di un
  // book connesso catturato prima del sigillo. Allora la scala mostra QUEI due numeri, così distanza e gap coincidono.
  const hasGap = lead.gap_pp != null && lead.sealed_p != null && lead.market_p_at_seal != null;
  const marketOnly = !m.is_our_model;
  const g = lead.gap_pp;
  const kind = m.probability_kind === "model" ? t.tennis.kindModel : m.probability_kind === "model_tempered" ? t.tennis.kindModelTempered : t.tennis.kindMarket;
  const scaleLabel = hasGap
    ? t.tennis.scaleAriaSeal(pctInt(lead.market_p_at_seal), pctInt(lead.sealed_p), gapText(g))
    : marketOnly
      ? t.tennis.scaleAriaMarket(pctInt(lead.market_p ?? lead.estimate_p))
      : t.tennis.scaleAriaModel(pctInt(lead.estimate_p));
  return (
    <div className={["v3c-row", "v3c-row-tn", open ? "v3c-row-open" : null].filter(Boolean).join(" ")} data-sport="tennis">
      <TimeCell kickoff={m.kickoff} t={t} tz={tz} locale={locale} now={now} sport="tennis" />
      <span className="v3c-r-teams">
        <Monogrammi home={{ name: m.player1 }} away={{ name: m.player2 }} />
        <span className="v3c-r-name">
          <button type="button" className="v3c-rowlink v3c-t-row" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
            {match}
            <span className="v3c-sr">, {t.tennis.rowAria(leadLabel, scaleLabel)}</span>
          </button>
          <small>
            {m.tournament || t.tennis.title} · <b>{leadLabel}</b>
          </small>
        </span>
      </span>
      <span className="v3c-r-price v3c-num">{price2(lead.market_price)}</span>
      {hasGap ? (
        <RowScale className="v3c-r-scale" market={lead.market_p_at_seal} estimate={lead.sealed_p} label={scaleLabel} />
      ) : marketOnly ? (
        <RowScale className="v3c-r-scale" market={null} estimate={lead.market_p ?? lead.estimate_p} marketOnly label={scaleLabel} />
      ) : (
        <RowScale className="v3c-r-scale" market={null} estimate={lead.estimate_p} label={scaleLabel} />
      )}
      {hasGap ? (
        <span className={["v3c-r-gap", "v3c-num", isFlatGap(g) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
          {gapText(g)}
          <small> {isFlatGap(g) ? t.board.inLine : "pp"}</small>
          <small className="v3c-r-atseal">{t.tennis.atSeal}</small>
        </span>
      ) : (
        <span className="v3c-r-gap v3c-g-none">
          <small className="v3c-r-nomkt">{marketOnly ? t.tennis.marketOnly : t.tennis.coming}</small>
        </span>
      )}
      <span className="v3c-r-book">
        {partners && r.best ? <><BookChip b={r.best} t={t} surface={surface} outcome={leadLabel} />{topShared(lead).length > 1 ? <small className="v3c-r-tie">{t.board.sameAt(topShared(lead).length)}</small> : null}</> : <small className="v3c-r-nobook">{partners ? t.board.noPrice : ""}</small>}
      </span>
      <span className="v3c-chev" aria-hidden="true">
        {open ? "–" : "+"}
      </span>
      {open ? (
        <div className="v3c-pn" id={panelId}>
          <div className="v3c-pn-o v3c-pn-o-tn" role="table" aria-label={t.tennis.winner}>
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
              <span className="v3c-lab v3c-ra" role="columnheader">
                {t.board.estimate}
              </span>
              <span className="v3c-lab v3c-ra" role="columnheader">
                {t.tennis.sealedCol}
              </span>
              <span className="v3c-lab v3c-ra" role="columnheader">
                {t.tennis.gapCol}
              </span>
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
                <span role="cell" className="v3c-num v3c-ra">
                  {marketOnly ? pctOrDash(x.estimate_p) : <mark>{pctOrDash(x.estimate_p)}</mark>}
                </span>
                <span role="cell" className="v3c-num v3c-ra">
                  {pctOrDash(x.sealed_p)}
                </span>
                <span role="cell" className={["v3c-num", "v3c-ra", isFlatGap(x.gap_pp) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
                  {x.gap_pp == null ? "—" : `${gapText(x.gap_pp)} pp`}
                </span>
              </div>
            ))}
          </div>
          <p className="v3c-pn-facts v3c-small">
            <span>{kind}</span>
            {lead.model_p != null ? <span>{t.tennis.rawElo(pctInt(lead.model_p))}</span> : null}
            {m.margin_removed != null ? <span>{t.board.margin(`${(m.margin_removed * 100).toFixed(1)}%`)}</span> : null}
            <span>{t.board.estimateAsOf(sealedStamp(m.estimate_as_of, locale))}</span>
          </p>
          <p className="v3c-small v3c-pn-note">
            {m.gap_market ? t.tennis.gapVs(m.gap_market.bookmaker === "ybets" ? "YBets" : m.gap_market.bookmaker === "fortuneplay" ? "FortunePlay" : m.gap_market.bookmaker, sealedStamp(m.gap_market.captured_at, locale)) : tennisNoGap(m, t)}
          </p>
          {m.sealed_at ? (
            <p className="v3c-pn-seal">
              <Sigillo sealedAt={m.sealed_at} label={t.fascia.sealed} title={t.board.sealedWhy(sealedStamp(m.sealed_at, locale))} />
              <span className="v3c-small">{t.board.sealedWhy(sealedStamp(m.sealed_at, locale))}</span>
            </p>
          ) : null}
          <p className="v3c-small">
            <Link href={matchHref(m.id)}>{t.board.openMatch}</Link>
          </p>
          {partners ? (
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
          {partners ? <SiteOnlyBooks list={siteOnly} t={t} surface={surface} /> : null}
          {partners && r.best ? <BestCta best={r.best} shared={topShared(lead).length} t={t} surface={surface} label={leadLabel} /> : null}
        </div>
      ) : null}
    </div>
  );
}
