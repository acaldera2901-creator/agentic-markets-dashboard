// components/ui/PredictionCard.tsx — #RESTYLING-0921
//
// «One card = one decision», leggibile in 2–3 secondi. Livello 1 del brief
// (discovery): lega+quando, squadre, pick, MODEL | MARKET | EDGE, un badge
// contestuale, «View analysis». L'analisi (livelli 2/3) è dietro `href`.
//
// Varianti:
//   compact        la card della lobby, CTA come link testuale (royal)
//   featured       più aria, teaser del «perché», l'UNICA con la CTA verde piena
//   live           LiveBadge col minuto al posto del kickoff
//   premiumLocked  Model/Market visibili (valore free), Pick ed Edge chiusi,
//                  CTA «Unlock full analysis» in outline verde
//
// Il verde compare in una card compatta solo nel numero dell'edge. Se ogni
// card avesse la CTA verde, l'edge non si vedrebbe più.
//
// La card NON è un link intero (accessibilità: un solo target, testo
// leggibile): il link è la CTA. `onOpen` è l'hook analytics del click.
import Link from "next/link";
import type { ReactNode } from "react";
import { Crest } from "@/components/ui/Crest";
import { SportChip } from "@/components/ui/SportChip";
import { LeagueChip } from "@/components/ui/LeagueChip";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { ProbabilityComparison } from "@/components/ui/ProbabilityComparison";
import { WatchlistButton } from "@/components/ui/WatchlistButton";
import { GlyphArrow, GlyphLock } from "@/components/ui/glyphs";
import { EDGE_HIGH_PP, type PredictionCardData } from "@/lib/ui/prediction-card";

export type PredictionCardVariant = "compact" | "featured" | "live" | "premiumLocked";
export type PredictionCardBadgeKind = "high-edge" | "starting-soon" | "featured";

export type PredictionCardProps = {
  data: PredictionCardData;
  variant?: PredictionCardVariant;
  /** Rotta della match/detail page. */
  href: string;
  /** undefined = derivato (edge ≥ EDGE_HIGH_PP → «High edge»; featured →
   *  «Featured»); null = nessun badge; oggetto = esplicito, con label a scelta
   *  (es. «Starts in 40 min», calcolata dal chiamante). */
  badge?: { kind: PredictionCardBadgeKind; label?: string } | null;
  saved?: boolean;
  onToggleWatchlist?: () => void;
  onOpen?: () => void;
  /** Slot sotto la riga MODEL|MARKET|EDGE (es. ConfidenceIndicator). */
  extra?: ReactNode;
  className?: string;
};

const BADGE_LABEL: Record<PredictionCardBadgeKind, string> = {
  "high-edge": "High edge",
  "starting-soon": "Starting soon",
  featured: "Featured",
};

function deriveBadge(data: PredictionCardData, variant: PredictionCardVariant, locked: boolean): { kind: PredictionCardBadgeKind; label?: string } | null {
  if (variant === "featured") return { kind: "featured" };
  // Una card chiusa non annuncia «High edge»: nasconderebbe l'edge e insieme
  // lo dichiarerebbe. O si vede il numero, o non si vede il badge.
  if (locked) return null;
  if (data.edgePct != null && data.edgePct >= EDGE_HIGH_PP) return { kind: "high-edge" };
  return null;
}

export function PredictionCard({ data, variant = "compact", href, badge, saved, onToggleWatchlist, onOpen, extra, className }: PredictionCardProps) {
  const locked = variant === "premiumLocked" || data.locked === true;
  const live = variant === "live" || data.isLive;
  const resolvedBadge = badge === undefined ? deriveBadge(data, variant, locked) : badge;
  const hasMarket = data.marketPct != null;
  const size = variant === "featured" ? "lg" : "md";
  const ctaTone = locked ? "unlock" : variant === "featured" ? "primary" : "link";
  const ctaText = locked ? "Unlock full analysis" : "View analysis";
  const showWhy = variant === "featured" && !!data.explanation && !locked;

  return (
    <article className={["br-card", className].filter(Boolean).join(" ")} data-variant={variant} data-id={data.id} data-live={live || undefined}>
      <header className="br-card__kicker">
        <SportChip sport={data.sport} />
        <LeagueChip league={data.league} />
        {live ? <LiveBadge minute={data.liveMinute} /> : data.kickoffLabel ? <span className="br-card__when">{data.kickoffLabel}</span> : null}
        {(resolvedBadge || onToggleWatchlist) && (
          <span className="br-card__side">
            {resolvedBadge && (
              <span className="br-badge" data-kind={resolvedBadge.kind}>{resolvedBadge.label ?? BADGE_LABEL[resolvedBadge.kind]}</span>
            )}
            {onToggleWatchlist && <WatchlistButton saved={!!saved} onToggle={onToggleWatchlist} />}
          </span>
        )}
      </header>

      <div className="br-card__match">
        <h3 className="br-card__teams">
          <span className="br-card__team"><Crest team={data.home} sport={data.sport} size={22} /><span>{data.home}</span></span>
          <span className="br-card__vs">vs</span>
          <span className="br-card__team"><Crest team={data.away} sport={data.sport} size={22} /><span>{data.away}</span></span>
        </h3>
      </div>

      <p className="br-card__pick">
        <span className="br-label">Pick</span>
        {locked ? (
          <span className="br-card__pick-v" data-locked="true"><GlyphLock size={13} />Pro pick</span>
        ) : (
          <span className="br-card__pick-v" title={data.pick ?? undefined}>{data.pick ?? "—"}</span>
        )}
      </p>

      <ProbabilityComparison modelPct={data.modelPct} marketPct={data.marketPct} edgePct={data.edgePct} size={size} locked={locked} />

      {extra}

      <footer className="br-card__foot">
        {showWhy ? (
          <p className="br-card__why"><strong>Why the model disagrees.</strong> {data.explanation}</p>
        ) : !hasMarket ? (
          <p className="br-card__note">Model estimate · no market price yet</p>
        ) : <span />}
        <Link href={href} className="br-cta" data-tone={ctaTone} onClick={onOpen} aria-label={`${ctaText}: ${data.home} vs ${data.away}`}>
          {locked && <GlyphLock size={14} />}
          {ctaText}
          {!locked && <GlyphArrow size={14} />}
        </Link>
      </footer>
    </article>
  );
}
