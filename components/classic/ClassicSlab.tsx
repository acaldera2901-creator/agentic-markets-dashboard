"use client";
// components/classic/ClassicSlab.tsx — #CLASSIC-CARD-1008 · #CLASSIC-ROOBET-1013 (round 2)
//
// La scheda prediction nella forma del mockup di Andrea (12–13/10), e NIENTE
// altro: quattro blocchi, altezza uniforme, zero spazio vuoto.
//   1. una riga: «Competizione · Oggi 19:00» (live: il badge LIVE al posto
//      dell'ora), la watchlist a destra;
//   2. l'arena: il pannello azzurro con i due stemmi, i nomi e «VS» (live: il
//      punteggio al posto del «VS»);
//   3. il modulo scuro: PICK + esito a sinistra, il numero grande in lime a
//      destra con la sua etichetta ONESTA (stima / solo mercato / Elo / solo
//      modello / protetta) e la «i» che apre, in una riga sola, il blend, il
//      mercato e lo scarto — le regole di REGOLE-CLASSIC non cambiano, cambiano
//      posto: non più una riga di contesto sempre visibile;
//   4. il piede, UNA riga: a sinistra il chip «esito · logo partner · quota»
//      della miglior quota disponibile per la pick (link affiliato vero,
//      `partner_click`, rel=sponsored, «AD·18+» in forma minima dentro al chip),
//      a destra «Vedi l'analisi ↗».
// Niente cornici (round 2): la separazione la fanno i toni di fondo — arena
// chiara > scheda > modulo scuro — e lo spazio.
//
// LA PICK NON SI RIVELA. Su una riga CHIUSA (Pick Pro) la quota della pick
// direbbe l'esito (1/X/2) che il Pro compra: lì il chip non c'è, e al suo posto
// stanno i loghi di tre partner con il link affiliato di atterraggio
// (PartnerFallback). Lo stesso ripiego vale dove per la partita non esiste un
// prezzo partner. Partita iniziata: nessun prezzo pre-match (card-view
// `finish`), resta il ripiego. Geo bloccata (fail-closed): nessun link.
//
// Rende la STESSA interfaccia di PredictionCard (props identiche): la sceglie
// PredictionCard quando NEXT_PUBLIC_CLASSIC=1, così ogni chiamante — lobby,
// elenco calcio/tennis, World Cup — riceve la scheda nuova senza toccarlo.
import Link from "next/link";
import { useId, useState } from "react";
import { Crest } from "@/components/ui/Crest";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { WatchlistButton } from "@/components/ui/WatchlistButton";
import { IconCheck, IconClock, IconLock, IconStar } from "@/components/ui/icons";
import { formatPct, splitLiveScore } from "@/lib/ui/prediction-card";
import type { PredictionCardProps } from "@/components/ui/PredictionCard";
import { useClassicPrices, type ClassicPrices } from "@/components/classic/ClassicContext";
import { classicCopy, fill, type ClassicCopy } from "@/lib/classic/copy";
import { classicViewFor, readLabel, type ClassicCell, type ClassicView } from "@/lib/classic/card-view";
import { MODEL_WEIGHT, hasStarted } from "@/lib/classic/guard";
import { TENNIS_ELO_WEIGHT } from "@/lib/classic/tennis-estimate";
import { landingPartnersFor } from "@/lib/affiliate";
import { BOOKS } from "@/lib/betconstruct-books";
import { PARTNERS, partnerLogoByName, sortBooksForMenu } from "@/lib/partners";
import { trackEvent } from "@/lib/track-event";

function useMountedNow(): Date {
  // Una sola lettura dell'orologio per scheda, al montaggio (render puro).
  const [now] = useState(() => new Date());
  return now;
}

/** Il logo del partner. Un wordmark (YBets, BetScore) dice già il nome: allora
 *  il nome scritto accanto non serve, e il logo porta l'alt. Un emblema no. */
function isWordmark(name: string): boolean {
  const p = PARTNERS.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  return !!p?.logo && p.logoShape !== "emblem";
}

export function PartnerLogo({ name, labelled = false }: { name: string; labelled?: boolean }) {
  const src = partnerLogoByName(name);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={labelled ? name : ""} className="cl-logo" data-wordmark={isWordmark(name) || undefined} loading="lazy" height={16} /> : <span className="cl-logo cl-logo--txt" aria-hidden="true">{name.slice(0, 2)}</span>;
}

export function trackPartner(name: string, surface: string) {
  trackEvent("partner_click", { partner_id: name, meta: { surface } });
}

/**
 * Il chip «esito · logo · quota»: la forma del mockup di Andrea (13/10). Un link
 * affiliato vero (deep-link del book, `rel=sponsored`), con il nome del book nel
 * title e nel nome accessibile, e «AD·18+» in forma minima dentro al chip.
 * `pick` = è l'esito della pick (lime sul prezzo).
 */
export function OddsChip({ cell, surface, c, pick }: { cell: ClassicCell; surface: string; c: ClassicCopy; pick?: boolean }) {
  return (
    <a
      className="cl-odd"
      data-pick={pick || undefined}
      href={cell.url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      title={`${cell.bookName} · ${c.ad}`}
      aria-label={`${cell.label} ${cell.price.toFixed(2)} · ${cell.bookName} · ${c.ad}`}
      onClick={() => trackPartner(cell.bookName, surface)}
    >
      <span className="cl-odd-k">{cell.label}</span>
      <PartnerLogo name={cell.bookName} />
      <span className="cl-odd-p">{cell.price.toFixed(2)}</span>
      <span className="cl-odd-ad" aria-hidden="true">{c.ad}</span>
    </a>
  );
}

/** Il chip della pick: il miglior prezzo con link sul lato della pick (riga aperta). */
export function pickCell(view: ClassicView | null, labels: readonly string[], leadIdx: number | null | undefined): ClassicCell | null {
  if (!view || leadIdx == null) return null;
  const best = view.chips.find((ch) => ch.price != null && ch.url);
  if (!best || best.price == null) return null;
  return { label: labels[leadIdx] ?? "", price: best.price, bookKey: best.key, bookName: best.name, url: best.url };
}

/** Quanti partner nel ripiego senza quota. Andrea (13/10): almeno tre. */
export const FALLBACK_PARTNERS = 3;

/**
 * I partner del ripiego: i due book con feed (link di atterraggio affiliato, lib/
 * betconstruct-books) più i solo-landing della geo (lib/affiliate), nell'ordine
 * del menu «Piazza la scommessa» (chi porta a una superficie di scommessa prima
 * di chi apre il casinò). Geo bloccata → nessuno: il gate resta fail-closed.
 */
export function fallbackPartners(prices: Pick<ClassicPrices, "booksBlocked" | "geoCountry">, max = FALLBACK_PARTNERS): { name: string; url: string }[] {
  if (prices.booksBlocked) return [];
  const all = [...BOOKS.map((b) => ({ name: b.name, url: b.landing })), ...landingPartnersFor(prices.geoCountry)];
  const seen = new Set<string>();
  return sortBooksForMenu(all.filter((p) => p.url && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))).slice(0, max);
}

/** La riga dei loghi partner, dove la quota non c'è o non si può dire. */
export function PartnerFallback({ surface, c, lang }: { surface: string; c: ClassicCopy; lang: string }) {
  const prices = useClassicPrices();
  const list = fallbackPartners(prices);
  if (list.length === 0) return null;
  const visit = ({ it: "Vai su", en: "Go to", es: "Ir a", fr: "Aller sur", ru: "Перейти на" } as Record<string, string>)[lang] ?? "Go to";
  return (
    <span className="cl-partners" data-testid="classic-partners" data-n={list.length}>
      {list.map((p) => (
        <a
          key={p.name}
          className="cl-partner"
          href={p.url}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          title={`${p.name} · ${c.ad}`}
          aria-label={`${visit} ${p.name} · ${c.ad}`}
          onClick={() => trackPartner(p.name, surface)}
        >
          <PartnerLogo name={p.name} />
        </a>
      ))}
      <span className="cl-odd-ad" aria-hidden="true">{c.ad}</span>
    </span>
  );
}

export function ClassicSlab({ data, variant = "compact", href, badge, saved, onToggleWatchlist, onOpen, className, lang = "en", included }: PredictionCardProps) {
  const c = classicCopy(lang);
  const prices = useClassicPrices();
  const now = useMountedNow();
  const infoId = useId();
  const [infoOpen, setInfoOpen] = useState(false);

  const locked = variant === "premiumLocked" || data.locked === true;
  const inc = !!included && !locked;
  const borrowed = inc && data.quotaBorrowed === true;
  const live = variant === "live" || data.isLive;
  const started = live || hasStarted(data.startsAt, now);
  const score = live ? splitLiveScore(data.liveScoreLabel) : null;

  // ── la lettura (lib/classic/card-view): stima, mercato, protezione, prezzi ──
  const { view, labels, leadIdx } = classicViewFor(data, prices, started, now);
  const raw = data.classic;

  // senza i numeri grezzi (un chiamante che non passa da lib/ui/desk-card) la
  // scheda dice solo ciò che sa: stima o mercato, nessuno scarto.
  const kind = view?.kind ?? (data.probabilitySource === "market" ? "market_only" : "estimate");
  const big = view ? view.bigPct : data.modelPct;
  const noPrice = kind === "no_price";
  const fromPartners = view?.marketFrom === "partners";
  const isOurs = kind === "estimate" || kind === "protected" || kind === "elo_blend" || kind === "model_only";
  // l'etichetta onesta: la riga protetta lo dice QUI, non in una riga a parte
  const bigLabel = kind === "protected" ? c.protectedTag : readLabel(kind, c);
  const howText =
    noPrice ? (data.sport === "tennis" ? c.noPriceTennisNote : c.noPriceNote)
    : kind === "market_only" && view?.priceFar ? c.marketOnlyFarNote
    // #CLASSIC-FIX1-1008 — senza quote servite la stima del calcio è il modello da solo (nessun blend)
    : (kind === "estimate" || kind === "protected") && fromPartners ? c.partnerMarketInfo
    : kind === "elo_blend" ? fill(c.eloNote, { e: Math.round(TENNIS_ELO_WEIGHT * 100), k: Math.round((1 - TENNIS_ELO_WEIGHT) * 100) })
    : kind === "market_only" ? (data.sport === "tennis" ? (raw?.sport === "tennis" && raw.modelVersion === "partner-market-v1" ? c.partnerMarketNote : c.marketOnlyTennisNote) : c.marketOnlyNote)
    : kind === "model_only" ? c.modelOnlyNote
    : fill(c.blendInfo, { m: Math.round(MODEL_WEIGHT * 100), k: Math.round((1 - MODEL_WEIGHT) * 100) });
  const gap = view?.gapPp ?? null;
  const gapText = gap == null ? null
    : view?.flat ? c.inLine
    : gap > 0 ? fill(c.gapAbove, { n: Math.abs(gap).toFixed(1) })
    : fill(c.gapBelow, { n: Math.abs(gap).toFixed(1) });
  const marketText = view?.marketPct != null && kind !== "market_only" ? `${c.market} ${formatPct(view.marketPct)}%` : null;
  // dietro la «i»: come è fatto il numero, il mercato, lo scarto, la protezione, l'origine
  const infoText = [howText, marketText, gapText, kind === "protected" ? c.protectedNote : null, fromPartners ? c.partnerMarket : null].filter(Boolean).join(" · ");

  const ctaText = locked ? c.unlockAnalysis : c.viewAnalysis;
  // il badge di valore non esiste più: resta solo ciò che dice il TEMPO (Starting soon) o la vetrina
  const timeBadge = badge && badge.kind !== "high-edge" ? badge : null;

  const surface = "card";
  // Il piede: riga aperta → UN chip, il miglior prezzo della pick. Riga chiusa,
  // partita iniziata o nessun prezzo → i loghi partner (ripiego).
  const chip = !locked && !prices.booksBlocked ? pickCell(view, labels, leadIdx) : null;

  return (
    <article
      className={["br-card", "cl-slab", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-id={data.id}
      data-live={live || undefined}
      data-included={inc || undefined}
      data-kind={kind}
      data-testid="classic-slab"
    >
      {/* 1 · competizione · ora, la watchlist a destra */}
      <p className="cl-head">
        {/* #CLASSIC-ASSET-1013 (QA BUG-1) — un torneo lungo («Dongfeng Voyah Wuhan
            Open») accanto all'ora finiva in «Dongfeng Voyah W…»: la parte che lo
            identifica sparisce. Oltre 17 caratteri (≈ lo spazio che resta accanto a
            «mer 14 ott, 05:00» in una scheda da 280 px) nome e ora vanno su due
            righe, senza il punto. Soglia sul testo, non misurata: uguale sul
            server e sul client. */}
        <span className="cl-meta" data-stack={(data.league?.length ?? 0) > 17 || undefined}>
          {data.league && <span className="cl-league" title={data.league}>{data.league}</span>}
          {data.league && (live || data.kickoffLabel) && (data.league.length <= 17) && <span className="cl-dot" aria-hidden="true">·</span>}
          {live ? <LiveBadge minute={data.liveMinute} />
            : data.kickoffLabel ? <span className="cl-when">{started ? fill(c.kickoffAt, { t: data.kickoffLabel }) : data.kickoffLabel}</span>
            : null}
        </span>
        {timeBadge && (
          <span className="cl-tag" data-kind={timeBadge.kind}>
            {timeBadge.kind === "starting-soon" ? <IconClock size={11} stroke={2} /> : <IconStar size={11} stroke={2} />}
            {timeBadge.label ?? (timeBadge.kind === "starting-soon" ? c.startingSoon : "Featured")}
          </span>
        )}
        {inc && (
          <span className="cl-tag" data-kind="included" data-testid="card-included" data-borrowed={borrowed || undefined}>
            <IconCheck size={10} stroke={2.5} />
            {prices.freePlan ? "FREE" : borrowed ? c.inQuota : c.includedToday}
          </span>
        )}
        {onToggleWatchlist && <span className="cl-watch"><WatchlistButton saved={!!saved} onToggle={onToggleWatchlist} /></span>}
      </p>

      {/* 2 · l'arena: stemmi, nomi, VS (o il punteggio) */}
      <h3 className="cl-arena">
        <span className="cl-team" data-role="home">
          <Crest team={data.home} sport={data.sport} size={44} role="home" className="cl-crest" />
          <span className="cl-name" title={data.home}>{data.home}</span>
        </span>
        <span className="cl-mid" aria-hidden={score ? undefined : "true"}>
          {score ? (
            <span className="cl-score" data-testid="score-live">
              <span>{score.home.map((x) => (x === "" ? "–" : x)).join(" ")}</span>
              <span>{score.away.map((x) => (x === "" ? "–" : x)).join(" ")}</span>
            </span>
          ) : <span className="cl-vs">vs</span>}
        </span>
        <span className="cl-team" data-role="away">
          <Crest team={data.away} sport={data.sport} size={44} role="away" className="cl-crest" />
          <span className="cl-name" title={data.away}>{data.away}</span>
        </span>
        {score && <span className="cl-sr">Live score {data.liveScoreLabel}</span>}
        {!score && <span className="cl-sr">vs</span>}
      </h3>

      {/* 3 · il modulo: pick a sinistra, numero a destra */}
      <div className="cl-pickmod">
        <p className="cl-pick">
          <span className="cl-k">{c.pick}</span>
          {locked
            ? <span className="cl-pick-v" data-locked="true"><IconLock size={12} stroke={2} />{c.proPick}</span>
            : <span className="cl-pick-v" title={data.pick ?? undefined}>{data.pick ?? "—"}</span>}
        </p>
        {/* round 3 (Andrea, 14/10): senza prezzo niente «—» grande e niente
            «Nessun prezzo per ora» — il numero non c'è e basta; resta la «i»,
            che spiega perché (c.noPriceNote). Mai una quota inventata. */}
        <div className={noPrice ? "cl-read cl-read--none" : "cl-read"} data-testid={noPrice ? "classic-noprice" : undefined}>
          {!noPrice && (
            <p className="cl-big" data-ours={isOurs || undefined} data-testid="classic-big">
              <span className="cl-big-n">{formatPct(big)}</span>
              {big != null && <span className="cl-big-pc">%</span>}
            </p>
          )}
          <p className="cl-label" data-kind={kind}>
            {!noPrice && <span>{bigLabel}</span>}
            <button
              type="button"
              className="cl-info"
              aria-expanded={infoOpen}
              aria-controls={infoId}
              aria-label={c.infoLabel}
              title={c.infoLabel}
              onClick={() => setInfoOpen((o) => !o)}
            >
              {/* #CLASSIC-ASSET-1013 — l'icona «info» della firma di casa (griglia 24,
                  tratto 1,75, punte piatte): asset-classic-final/icons/svg/info.svg, inline
                  per prendere currentColor. Prima era una «i» in Georgia corsivo. */}
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="butt" strokeLinejoin="miter" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 11v5.5" />
                <path d="M10.9 7.1h2.2v2.2h-2.2z" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </p>
        </div>
      </div>
      <p id={infoId} className="cl-infotext" hidden={!infoOpen} data-testid="classic-info" data-market={marketText ? "" : undefined} data-gap={gap == null ? undefined : gap > 0 ? "pos" : gap < 0 ? "neg" : "zero"} data-origin={fromPartners ? "partners" : undefined}>
        {infoText}
      </p>

      {/* 4 · il piede, una riga: chip della pick (o i partner) · CTA */}
      <footer className="cl-foot">
        <span className="cl-foot-l" data-testid="classic-odds">
          {chip ? <OddsChip cell={chip} surface={surface} c={c} pick /> : <PartnerFallback surface={surface} c={c} lang={lang} />}
        </span>
        <Link href={href} className="cl-open" data-locked={locked || undefined} onClick={onOpen} aria-label={`${ctaText}: ${data.home} vs ${data.away}`}>
          {locked && <IconLock size={13} />}
          <span>{ctaText}&nbsp;<span aria-hidden="true">↗</span></span>
        </Link>
      </footer>
    </article>
  );
}
