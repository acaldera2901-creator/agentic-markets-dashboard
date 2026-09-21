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
//   premiumLocked  Model/Market/Edge VERI e visibili (il valore free), solo la
//                  Pick chiusa, CTA «Unlock full analysis» in outline verde
//
// #RESTYLING-0921 round 2 — il lucchetto copre la PICK, mai i numeri. Prima
// copriva anche l'edge, ed era incoerente: la card mostrava «MODEL 64 ·
// MARKET 52» e poi un lucchetto al posto di 12, che il lettore calcola in
// testa. Ciò che si paga è il LATO su cui scommettere, non la sottrazione.
//
// Il verde compare in una card compatta solo nel numero dell'edge. Se ogni
// card avesse la CTA verde, l'edge non si vedrebbe più.
//
// La card NON è un link intero (accessibilità: un solo target, testo
// leggibile): il link è la CTA. `onOpen` è l'hook analytics del click.
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
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
  /** Click sulla CTA. Riceve l'evento: chi ha già la scheda in pagina (la
   *  lobby del desk) fa preventDefault e apre il modal, mentre `href` resta un
   *  link vero — tasto centrale, «apri in nuova scheda» e condivisione
   *  continuano a funzionare. #RESTYLING-0921 */
  onOpen?: (ev: MouseEvent<HTMLAnchorElement>) => void;
  /** Slot sotto la riga MODEL|MARKET|EDGE (es. ConfidenceIndicator). */
  extra?: ReactNode;
  /** Solo `featured` (round 2): foto/crest della partita in testa alla card,
   *  a tutta larghezza, con il gradiente che la riporta nel pannello. Il
   *  chiamante passa un <img> (o nulla: la card resta quella del round 1). */
  media?: ReactNode;
  className?: string;
};

const BADGE_LABEL: Record<PredictionCardBadgeKind, string> = {
  "high-edge": "High edge",
  "starting-soon": "Starting soon",
  featured: "Featured",
};

function deriveBadge(data: PredictionCardData, variant: PredictionCardVariant): { kind: PredictionCardBadgeKind; label?: string } | null {
  if (variant === "featured") return { kind: "featured" };
  // La regola resta «o si vede il numero, o non si vede il badge» — ed è per
  // questo che il guard su `locked` è caduto nel round 2: ora l'edge di una
  // card chiusa È visibile, quindi il badge non promette nulla di nascosto.
  if (data.edgePct != null && data.edgePct >= EDGE_HIGH_PP) return { kind: "high-edge" };
  return null;
}

export function PredictionCard({ data, variant = "compact", href, badge, saved, onToggleWatchlist, onOpen, extra, media, className }: PredictionCardProps) {
  const locked = variant === "premiumLocked" || data.locked === true;
  const live = variant === "live" || data.isLive;
  const resolvedBadge = badge === undefined ? deriveBadge(data, variant) : badge;
  const hasMarket = data.marketPct != null;
  const featured = variant === "featured";
  const size = featured ? "lg" : "md";
  // Round 2: nella Featured i crest sono il «volto» della partita (36px), non
  // un puntino accanto al nome.
  const crestSize = featured ? 36 : 22;
  const ctaTone = locked ? "unlock" : variant === "featured" ? "primary" : "link";
  const ctaText = locked ? "Unlock full analysis" : "View analysis";
  const showWhy = variant === "featured" && !!data.explanation && !locked;

  return (
    <article className={["br-card", className].filter(Boolean).join(" ")} data-variant={variant} data-id={data.id} data-live={live || undefined}>
      {featured && media ? <div className="br-card__media" data-testid="card-media">{media}</div> : null}
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
          <span className="br-card__team"><Crest team={data.home} sport={data.sport} size={crestSize} /><span>{data.home}</span></span>
          <span className="br-card__vs">vs</span>
          <span className="br-card__team"><Crest team={data.away} sport={data.sport} size={crestSize} /><span>{data.away}</span></span>
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

      {/* Nessun `locked`: i tre numeri sono il valore che il free deve vedere.
          Il lucchetto sta sulla pick, qui sopra. */}
      <ProbabilityComparison modelPct={data.modelPct} marketPct={data.marketPct} edgePct={data.edgePct} size={size} />

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
