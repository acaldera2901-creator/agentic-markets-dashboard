"use client";
// components/classic/ClassicSlab.tsx — #CLASSIC-CARD-1008 · Fase B, direzione A «Slab»
//
// La scheda prediction di oggi senza nessuna cornice: la lastra blu sul navy fa
// da contenitore, dentro raggruppa lo spazio e UN filo sottile separa la lettura
// dall'azione. Un solo numero grande (la stima, o il mercato quando è solo
// mercato), il mercato piccolo accanto, lo scarto col segno solo dove è
// legittimo, il blend dichiarato dietro una «i». Sotto, le quote dei partner e
// il bottone col link affiliato vero (deep-link del book, tracciato come nella
// scheda partita: `partner_click`). Partita iniziata: niente prezzi, niente bottone.
//
// Rende la STESSA interfaccia di PredictionCard (props identiche): la sceglie
// PredictionCard quando NEXT_PUBLIC_CLASSIC=1, così ogni chiamante — lobby,
// elenco calcio/tennis, World Cup — riceve la scheda nuova senza toccarlo.
import Link from "next/link";
import { useId, useState } from "react";
import { Crest } from "@/components/ui/Crest";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { WatchlistButton } from "@/components/ui/WatchlistButton";
import { IconArrow, IconCheck, IconClock, IconLock, IconStar } from "@/components/ui/icons";
import { formatPct, splitLiveScore } from "@/lib/ui/prediction-card";
import type { PredictionCardProps } from "@/components/ui/PredictionCard";
import { useClassicPrices } from "@/components/classic/ClassicContext";
import { classicCopy, fill } from "@/lib/classic/copy";
import { classicFootballView, classicTennisView, footballBooks, tennisBooks, type ClassicLanding, type ClassicView } from "@/lib/classic/card-view";
import { MODEL_WEIGHT, hasStarted } from "@/lib/classic/guard";
import { TENNIS_ELO_WEIGHT } from "@/lib/classic/tennis-estimate";
import { abbinaQuotaPartner } from "@/lib/fp-odds-join";
import { teamPairKey } from "@/lib/team-pair-key";
import { landingPartnersFor } from "@/lib/affiliate";
import { PARTNERS, partnerLogoByName, sortBooksForMenu } from "@/lib/partners";
import { trackEvent } from "@/lib/track-event";

const SPORT_LABEL: Record<string, string> = { football: "Football", tennis: "Tennis" };
// I partner solo-landing che atterrano su una superficie di scommessa (Beazt e
// Wildz aprono la lobby del casinò: lib/affiliate.ts) — al più uno, in coda ai chip.
const CASINO_LANDING = /^(beazt|wildz)$/i;

function useMountedNow(): Date {
  // Una sola lettura dell'orologio per scheda, al montaggio (render puro).
  const [now] = useState(() => new Date());
  return now;
}

function Score({ cells, testId }: { cells: string[]; testId: string }) {
  return (
    <span className="cl-score" data-testid={testId} aria-hidden="true">
      {cells.map((c, i) => <span key={i}>{c === "" ? "–" : c}</span>)}
    </span>
  );
}

/** Il logo del partner. Un wordmark (YBets, BetScore) dice già il nome: allora
 *  il nome scritto accanto non serve, e il logo porta l'alt. Un emblema no. */
function isWordmark(name: string): boolean {
  const p = PARTNERS.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  return !!p?.logo && p.logoShape !== "emblem";
}

function PartnerLogo({ name, labelled = false }: { name: string; labelled?: boolean }) {
  const src = partnerLogoByName(name);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={labelled ? name : ""} className="cl-logo" data-wordmark={isWordmark(name) || undefined} loading="lazy" height={18} /> : <span className="cl-logo cl-logo--txt" aria-hidden="true">{name.slice(0, 2)}</span>;
}

function track(name: string, surface: string) {
  trackEvent("partner_click", { partner_id: name, meta: { surface } });
}

export function ClassicSlab({ data, variant = "compact", href, badge, saved, onToggleWatchlist, onOpen, extra, className, lang = "en", included }: PredictionCardProps) {
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

  // ── le quote partner di questa partita (dalla mappa che il desk ha già) ──
  const landing: ClassicLanding[] = prices.booksBlocked
    ? []
    : sortBooksForMenu(landingPartnersFor(prices.geoCountry).filter((l) => !CASINO_LANDING.test(l.name))).slice(0, 1);
  const raw = data.classic;
  let view: ClassicView | null = null;
  if (raw?.sport === "football") {
    const fp = abbinaQuotaPartner(data.home, data.away, data.startsAt, prices.fpOdds, prices.fpIndex).quota;
    const books = prices.booksBlocked ? [] : footballBooks(fp, data.home, data.away);
    view = classicFootballView({ started, est: raw.est, odds: raw.odds, leadIdx: raw.leadIdx, estLead: raw.estLead, oddsLead: raw.oddsLead, books, landing, labels: ["1", "X", "2"] });
  } else if (raw?.sport === "tennis") {
    const fp = prices.fpOdds[teamPairKey("tennis", data.home, data.away, data.startsAt) ?? ""];
    const books = prices.booksBlocked ? [] : tennisBooks(fp, data.home, data.away);
    view = classicTennisView({
      started, modelVersion: raw.modelVersion, tournament: raw.tournament, player1: data.home, player2: data.away,
      p: raw.p, odds: raw.odds, leadIdx: raw.leadIdx, pLead: raw.pLead, oddsLead: raw.oddsLead,
      eloAsOf: prices.tennisComputedAt, now, books, landing,
      labels: ["1", "2"], // 1 = il primo nome sopra, 2 = il secondo: come l'1X2 del calcio
    });
  }

  // senza i numeri grezzi (un chiamante che non passa da lib/ui/desk-card) la
  // scheda dice solo ciò che sa: stima o mercato, nessuno scarto.
  const kind = view?.kind ?? (data.probabilitySource === "market" ? "market_only" : "estimate");
  const big = view ? view.bigPct : data.modelPct;
  const isOurs = kind === "estimate" || kind === "protected" || kind === "elo_blend" || kind === "model_only";
  const bigLabel =
    kind === "market_only" ? c.marketOnly
    : kind === "model_only" ? c.modelOnly
    : kind === "elo_blend" ? c.eloBased
    : c.ourEstimate;
  const infoText =
    kind === "elo_blend" ? fill(c.eloNote, { e: Math.round(TENNIS_ELO_WEIGHT * 100), k: Math.round((1 - TENNIS_ELO_WEIGHT) * 100) })
    : kind === "market_only" ? (data.sport === "tennis" ? (raw?.sport === "tennis" && raw.modelVersion === "partner-market-v1" ? c.partnerMarketNote : c.marketOnlyTennisNote) : c.marketOnlyNote)
    : kind === "model_only" ? c.modelOnlyNote
    : fill(c.blendInfo, { m: Math.round(MODEL_WEIGHT * 100), k: Math.round((1 - MODEL_WEIGHT) * 100) });
  const gap = view?.gapPp ?? null;
  const gapText = gap == null ? null
    : view?.flat ? c.inLine
    : gap > 0 ? fill(c.gapAbove, { n: Math.abs(gap).toFixed(1) })
    : fill(c.gapBelow, { n: Math.abs(gap).toFixed(1) });
  const note = kind === "protected" ? c.protectedNote : null;

  const ctaText = locked
    ? ({ it: "Sblocca l'analisi completa", en: "Unlock full analysis", es: "Desbloquea el análisis completo", fr: "Débloquer l'analyse complète", ru: "Открыть полный анализ" } as Record<string, string>)[lang] ?? "Unlock full analysis"
    : ({ it: "Vedi l'analisi", en: "View analysis", es: "Ver análisis", fr: "Voir l'analyse", ru: "Смотреть анализ" } as Record<string, string>)[lang] ?? "View analysis";
  // il badge di valore non esiste più: resta solo ciò che dice il TEMPO (Starting soon) o la vetrina
  const timeBadge = badge && badge.kind !== "high-edge" ? badge : null;

  const surface = "card";
  const cta = view?.cta ?? null;
  // il bottone partner è lime solo quando la protezione è ok (mockup A); neutro altrimenti
  const ctaTone = view?.valueAllowed ? "primary" : "neutral";

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
      <header className="cl-head">
        <p className="cl-meta">
          <span className="cl-sport" data-sport={data.sport}>{SPORT_LABEL[data.sport] ?? data.sport}</span>
          {data.league && <span className="cl-league" title={data.league}>{data.league}</span>}
        </p>
        <p className="cl-when">
          {live ? <LiveBadge minute={data.liveMinute} /> : data.kickoffLabel ? <span>{data.kickoffLabel}</span> : null}
          {live && data.liveScoreLabel && !score && <span className="cl-scoreraw">{data.liveScoreLabel}</span>}
          {timeBadge && (
            <span className="cl-tag" data-kind={timeBadge.kind}>
              {timeBadge.kind === "starting-soon" ? <IconClock size={11} stroke={2} /> : <IconStar size={11} stroke={2} />}
              {timeBadge.label ?? (timeBadge.kind === "starting-soon" ? "Starting soon" : "Featured")}
            </span>
          )}
          {inc && (
            <span className="cl-tag" data-kind="included" data-testid="card-included" data-borrowed={borrowed || undefined}>
              <IconCheck size={10} stroke={2.5} />
              {borrowed
                ? ({ it: "Nella quota di oggi", en: "In your daily quota", es: "En tu cuota de hoy", fr: "Dans votre quota du jour", ru: "В квоте на сегодня" } as Record<string, string>)[lang] ?? "In your daily quota"
                : ({ it: "Inclusa oggi", en: "Included today", es: "Incluida hoy", fr: "Incluse aujourd'hui", ru: "Доступно сегодня" } as Record<string, string>)[lang] ?? "Included today"}
            </span>
          )}
        </p>
      </header>

      <h3 className="cl-teams">
        <span className="cl-team">
          <Crest team={data.home} sport={data.sport} size={22} role="home" />
          <span className="cl-name" title={data.home}>{data.home}</span>
          {score && <Score cells={score.home} testId="score-home" />}
        </span>
        <span className="cl-vs">vs</span>
        <span className="cl-team">
          <Crest team={data.away} sport={data.sport} size={22} role="away" />
          <span className="cl-name" title={data.away}>{data.away}</span>
          {score && <Score cells={score.away} testId="score-away" />}
        </span>
        {score && <span className="cl-vs">Live score {data.liveScoreLabel}</span>}
      </h3>

      <p className="cl-pick">
        <span className="cl-k">Pick</span>
        {locked
          ? <span className="cl-pick-v" data-locked="true"><IconLock size={12} stroke={2} />Pro pick</span>
          : <span className="cl-pick-v" title={data.pick ?? undefined}>{data.pick ?? "—"}</span>}
      </p>

      <div className="cl-read">
        <p className="cl-big" data-ours={isOurs || undefined} data-testid="classic-big">
          <span className="cl-big-n">{formatPct(big)}</span>
          {big != null && <span className="cl-big-pc">%</span>}
        </p>
        {view?.marketPct != null && kind !== "market_only" && (
          <p className="cl-mkt" data-testid="classic-market">
            <span className="cl-mkt-n">{formatPct(view.marketPct)}<span className="cl-mkt-pc">%</span></span>
            <span className="cl-k">{c.market}</span>
          </p>
        )}
        <p className="cl-label">
          <span>{bigLabel}</span>
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
      <p id={infoId} className="cl-infotext" hidden={!infoOpen} data-testid="classic-info">{infoText}</p>

      {(gapText || note) && (
        <div className="cl-gapline">
          {gapText && <p className="cl-gap" data-sign={gap == null ? undefined : gap > 0 ? "pos" : gap < 0 ? "neg" : "zero"} data-testid="classic-gap">{gapText}</p>}
          {note && <p className="cl-note"><strong>{c.protectedTag}</strong></p>}
        </div>
      )}

      {extra}

      {/* le quote: sotto il filo, la parte «azione» della lastra */}
      {view && !prices.booksBlocked && (
        <div className="cl-odds" data-testid="classic-odds">
          {view.started ? (
            <p className="cl-odds-note">{c.pricesRemoved}</p>
          ) : view.chips.length > 0 ? (
            <ul className="cl-chips" aria-label={c.bestPrices}>
              {view.chips.map((ch) => (
                <li key={ch.key}>
                  <a
                    className="cl-chip"
                    data-best={ch.best || undefined}
                    href={ch.url}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    onClick={() => track(ch.name, surface)}
                  >
                    <PartnerLogo name={ch.name} labelled={isWordmark(ch.name)} />
                    {!isWordmark(ch.name) && <span className="cl-chip-name">{ch.name}</span>}
                    {ch.price != null
                      ? <span className="cl-chip-p">{ch.price.toFixed(2)}</span>
                      : <span className="cl-chip-site">{c.oddsOnPartnerSite}</span>}
                  </a>
                </li>
              ))}
            </ul>
          ) : view.cells.length > 0 ? (
            <div className="cl-cells">
              <span className="cl-k">{c.bestPrices}</span>
              <ul className="cl-cells-l">
                {view.cells.map((cell) => (
                  <li key={cell.label} className="cl-cell" title={cell.bookName}>
                    <span className="cl-cell-k">{cell.label}</span>
                    <PartnerLogo name={cell.bookName} />
                    <span className="cl-cell-p">{cell.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="cl-odds-note">{c.noPartnerPrice}</p>
          )}
          {cta && (
            <a
              className="cl-bet"
              data-tone={ctaTone}
              href={cta.url}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              onClick={() => track(cta.name, surface)}
              data-testid="classic-bet"
            >
              <span>{fill(c.betAt, { book: cta.name })}{cta.price != null ? ` · ${cta.price.toFixed(2)}` : ""}</span>
              <span aria-hidden="true">↗</span>
              <span className="cl-ad">{c.ad}</span>
            </a>
          )}
        </div>
      )}

      <footer className="cl-foot">
        <span className="cl-foot-l">
          {onToggleWatchlist && <WatchlistButton saved={!!saved} onToggle={onToggleWatchlist} />}
        </span>
        <Link href={href} className="cl-open" data-locked={locked || undefined} onClick={onOpen} aria-label={`${ctaText}: ${data.home} vs ${data.away}`}>
          {locked && <IconLock size={13} />}
          {ctaText}
          {!locked && <IconArrow size={13} />}
        </Link>
      </footer>
    </article>
  );
}
