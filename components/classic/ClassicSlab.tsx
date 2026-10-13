"use client";
// components/classic/ClassicSlab.tsx — #CLASSIC-CARD-1008 · #CLASSIC-ROOBET-1013
//
// La scheda prediction nella forma del Design Review del 12/10 (PDF, direzione
// scelta da Andrea), dall'alto:
//   1. una riga: «Competizione · Oggi 19:00» (live: il badge LIVE al posto dell'ora);
//   2. l'arena: un pannello azzurro più chiaro con i due stemmi, i nomi e «VS»
//      (live: il punteggio al posto del «VS»);
//   3. il modulo scuro: PICK + esito a sinistra, il numero grande in lime a
//      destra con la sua etichetta ONESTA (stima / solo mercato / Elo / solo
//      modello — le regole di REGOLE-CLASSIC non cambiano, cambia la forma);
//   4. una riga quieta di contesto: mercato, scarto col segno, protezione, origine;
//   5. il piede: a sinistra il chip «esito · logo partner · quota» della MIGLIOR
//      quota disponibile per la pick (link affiliato vero, tracciato
//      `partner_click`) — l'unica differenza dal PDF, decisa da Andrea il 13/10 —
//      al centro «Vedi l'analisi ↗», a destra la watchlist.
// Bordi sottili bianco-freddo (non lime), come il PDF: qui la regola «niente
// cornici» dell'8/10 è superata dalla decisione del 12/10, SOLO sulla scheda.
//
// Cosa NON c'è più rispetto alla Slab dell'8/10: il vassoio delle quote con il
// bottone lime «Scommetti su X» (lo sostituisce il chip), l'indicatore di
// confidenza (`extra`: il PDF non lo prevede, e la scheda deve restare bassa).
// Il chip su una riga CHIUSA mostrerebbe l'esito (1/X/2) e cioè la pick che il
// Pro compra: lì stanno le migliori quote per OGNI esito, che non lo rivelano —
// la stessa regola del vassoio di prima. Partita iniziata: nessun prezzo.
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
import { useClassicPrices } from "@/components/classic/ClassicContext";
import { classicCopy, fill, type ClassicCopy } from "@/lib/classic/copy";
import { classicViewFor, readLabel, type ClassicCell, type ClassicView } from "@/lib/classic/card-view";
import { MODEL_WEIGHT, hasStarted } from "@/lib/classic/guard";
import { TENNIS_ELO_WEIGHT } from "@/lib/classic/tennis-estimate";
import { PARTNERS, partnerLogoByName } from "@/lib/partners";
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
 * title e nel nome accessibile. `pick` = è l'esito della pick (lime sul prezzo).
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
  const bigLabel = readLabel(kind, c);
  const infoText =
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
  const note = kind === "protected" ? c.protectedTag : null;
  const marketText = view?.marketPct != null && kind !== "market_only" ? `${c.market} ${formatPct(view.marketPct)}%` : null;

  const ctaText = locked ? c.unlockAnalysis : c.viewAnalysis;
  // il badge di valore non esiste più: resta solo ciò che dice il TEMPO (Starting soon) o la vetrina
  const timeBadge = badge && badge.kind !== "high-edge" ? badge : null;

  const surface = "card";
  // Il piede: riga aperta → UN chip, il miglior prezzo della pick; riga chiusa →
  // il miglior prezzo per OGNI esito (non rivela la pick). Partita iniziata →
  // niente (card-view `finish` svuota chip e celle).
  const chip = !locked && !prices.booksBlocked ? pickCell(view, labels, leadIdx) : null;
  const cells = locked && !prices.booksBlocked && view ? view.cells : [];

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
      {/* 1 · competizione · ora */}
      <p className="cl-head">
        <span className="cl-meta">
          {data.league && <span className="cl-league" title={data.league}>{data.league}</span>}
          {data.league && (live || data.kickoffLabel) && <span className="cl-dot" aria-hidden="true">·</span>}
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
            {borrowed ? c.inQuota : c.includedToday}
          </span>
        )}
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
        <div className="cl-read" data-testid={noPrice ? "classic-noprice" : undefined}>
          <p className="cl-big" data-ours={(isOurs && !noPrice) || undefined} data-testid="classic-big">
            <span className="cl-big-n">{noPrice ? "—" : formatPct(big)}</span>
            {!noPrice && big != null && <span className="cl-big-pc">%</span>}
          </p>
          <p className="cl-label">
            <span>{noPrice ? c.noPrice : bigLabel}</span>
            <button
              type="button"
              className="cl-info"
              aria-expanded={infoOpen}
              aria-controls={infoId}
              aria-label={c.infoLabel}
              title={c.infoLabel}
              onClick={() => setInfoOpen((o) => !o)}
            >
              i
            </button>
          </p>
        </div>
      </div>
      <p id={infoId} className="cl-infotext" hidden={!infoOpen} data-testid="classic-info">{infoText}</p>

      {/* 4 · il contesto, in una riga quieta */}
      {(marketText || gapText || note || fromPartners || noPrice) && (
        <p className="cl-gapline">
          {noPrice && <span className="cl-noprice-why">{infoText}</span>}
          {marketText && <span className="cl-mkt" data-testid="classic-market">{marketText}</span>}
          {gapText && <span className="cl-gap" data-sign={gap == null ? undefined : gap > 0 ? "pos" : gap < 0 ? "neg" : "zero"} data-testid="classic-gap">{gapText}</span>}
          {note && <span className="cl-note">{note}</span>}
          {fromPartners && <span className="cl-origin" data-testid="classic-origin">{c.partnerMarket}</span>}
        </p>
      )}

      {/* 5 · il piede: chip della miglior quota · CTA · watchlist */}
      <footer className="cl-foot" data-cells={cells.length > 1 || undefined}>
        <span className="cl-foot-l" data-testid="classic-odds">
          {chip && <OddsChip cell={chip} surface={surface} c={c} pick />}
          {cells.map((cell) => <OddsChip key={cell.label} cell={cell} surface={surface} c={c} />)}
          {(chip || cells.length > 0) && <span className="cl-ad" aria-hidden="true">{c.ad}</span>}
        </span>
        <Link href={href} className="cl-open" data-locked={locked || undefined} onClick={onOpen} aria-label={`${ctaText}: ${data.home} vs ${data.away}`}>
          {locked && <IconLock size={13} />}
          {/* testo e freccia in UN nodo: a 390, se il testo va a capo, icona e
              freccia non si aprono ai due lati della CTA */}
          <span>{ctaText} <span aria-hidden="true">↗</span></span>
        </Link>
        <span className="cl-foot-r">
          {onToggleWatchlist && <WatchlistButton saved={!!saved} onToggle={onToggleWatchlist} />}
        </span>
      </footer>
    </article>
  );
}
