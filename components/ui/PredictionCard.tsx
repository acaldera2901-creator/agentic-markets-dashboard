// components/ui/PredictionCard.tsx — #RESTYLING-0921
//
// «One card = one decision», leggibile in 2–3 secondi. Livello 1 del brief
// (discovery): lega+quando, squadre, pick, LA NOSTRA percentuale, un badge
// contestuale, «View analysis». L'analisi (livelli 2/3) è dietro `href`.
//
// #RESTYLING-0921 round 4 — LA CARD MOSTRA UN SOLO NUMERO, IL NOSTRO.
// Fino al round 3 c'era la riga MODEL | MARKET | EDGE con la barra di
// confronto: giudicata «troppo confusionaria» a livello 1 — tre dati da
// mettere in relazione mentre si scorre. Qui resta la probabilità del modello,
// grande, protagonista.
//
// Round 13: la stessa riga è stata tolta anche dal livello 2 (la scheda
// partita), che adesso ripete questo trattamento — numero grande in --am-pct,
// «Our model» sotto. Il confronto col mercato non sparisce dal prodotto: si
// legge in «Why the model likes this pick», a parole, in entrambe le direzioni.
//
// Varianti:
//   compact        la card della lobby, CTA come link testuale (royal)
//   featured       più aria, teaser del «perché», l'UNICA con la CTA verde piena
//   live           LiveBadge col minuto al posto del kickoff
//   premiumLocked  la nostra percentuale VERA e visibile (il valore free), solo
//                  la Pick chiusa, CTA «Unlock full analysis» in outline verde
//
// #RESTYLING-0921 round 2 — il lucchetto copre la PICK, mai il numero. Ciò che
// si paga è il LATO su cui scommettere, non la probabilità.
//
// La card NON è un link intero (accessibilità: un solo target, testo
// leggibile): il link è la CTA. `onOpen` è l'hook analytics del click.
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { Crest } from "@/components/ui/Crest";
import { SportChip } from "@/components/ui/SportChip";
import { LeagueChip } from "@/components/ui/LeagueChip";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { WatchlistButton } from "@/components/ui/WatchlistButton";
import { IconArrow, IconClock, IconEdge, IconLock, IconStar } from "@/components/ui/icons";
import { EDGE_HIGH_PP, formatPct, splitLiveScore, type PredictionCardData } from "@/lib/ui/prediction-card";
import type { Lang } from "@/lib/house-banners";

function pick5<T>(lang: Lang, v: { it: T; en: T; es: T; fr: T; ru: T }): T {
  return v[lang];
}

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
  /** Slot sotto la percentuale del modello (es. ConfidenceIndicator). */
  extra?: ReactNode;
  /** Solo `featured` (round 2): foto/crest della partita in testa alla card,
   *  a tutta larghezza, con il gradiente che la riporta nel pannello. Il
   *  chiamante passa un <img> (o nulla: la card resta quella del round 1). */
  media?: ReactNode;
  className?: string;
  /** #I18N-CTA-0924 — la CTA («View analysis»/«Unlock full analysis») era
   *  fissa in inglese: unico testo non tradotto della card, su tutte le
   *  lingue del desk. `en` di default per i chiamanti che non lo passano
   *  ancora (nessuna regressione). */
  lang?: Lang;
};

const BADGE_LABEL: Record<PredictionCardBadgeKind, string> = {
  "high-edge": "High edge",
  "starting-soon": "Starting soon",
  featured: "Featured",
};

// Round 3: il badge è outline monocromo — il significato lo danno la parola e
// il segno, non un terzo colore accanto all'edge e al LIVE.
function BadgeIcon({ kind }: { kind: PredictionCardBadgeKind }) {
  if (kind === "high-edge") return <IconEdge size={12} stroke={2} />;
  if (kind === "starting-soon") return <IconClock size={12} stroke={2} />;
  return <IconStar size={12} stroke={2} />;
}

// #CARD-LAYOUT-0925 — le celle del punteggio di una riga squadra: nel calcio
// una, nel tennis una per set. `aria-hidden`: il valore per chi ascolta è la
// frase «Live score 2-1» nell'h3, non due cifre sparse.
function ScoreCells({ cells, testId }: { cells: string[]; testId: string }) {
  return (
    <span className="br-card__score" data-live="true" data-testid={testId} aria-hidden="true">
      {cells.map((c, i) => <span key={i}>{c === "" ? "–" : c}</span>)}
    </span>
  );
}

function deriveBadge(data: PredictionCardData, variant: PredictionCardVariant): { kind: PredictionCardBadgeKind; label?: string } | null {
  if (variant === "featured") return { kind: "featured" };
  // Round 4: il badge resta una PAROLA, non un numero — «High edge» dice che
  // c'è uno scarto dal mercato e invita ad aprire l'analisi, dove lo scarto è
  // scritto. È il contrario del problema segnalato (tre numeri da confrontare
  // sulla card), e senza di lui la fascia «High edge» della Home non avrebbe
  // alcun segno sulle sue righe.
  if (data.edgePct != null && data.edgePct >= EDGE_HIGH_PP) return { kind: "high-edge" };
  return null;
}

export function PredictionCard({ data, variant = "compact", href, badge, saved, onToggleWatchlist, onOpen, extra, media, className, lang = "en" }: PredictionCardProps) {
  const locked = variant === "premiumLocked" || data.locked === true;
  const live = variant === "live" || data.isLive;
  const resolvedBadge = badge === undefined ? deriveBadge(data, variant) : badge;
  const featured = variant === "featured";
  const size = featured ? "lg" : "md";
  // Round 2: nella Featured i crest sono il «volto» della partita (36px), non
  // un puntino accanto al nome.
  const crestSize = featured ? 36 : 22;
  const ctaTone = locked ? "unlock" : variant === "featured" ? "primary" : "link";
  const ctaText = locked
    ? pick5(lang, { it: "Sblocca l'analisi completa", en: "Unlock full analysis", es: "Desbloquea el análisis completo", fr: "Débloquer l'analyse complète", ru: "Открыть полный анализ" })
    : pick5(lang, { it: "Vedi l'analisi", en: "View analysis", es: "Ver análisis", fr: "Voir l'analyse", ru: "Смотреть анализ" });
  const showWhy = variant === "featured" && !!data.explanation && !locked;
  const score = live ? splitLiveScore(data.liveScoreLabel) : null;

  return (
    <article className={["br-card", className].filter(Boolean).join(" ")} data-variant={variant} data-id={data.id} data-live={live || undefined}>
      {featured && media ? <div className="br-card__media" data-testid="card-media">{media}</div> : null}
      {/* #CARD-LAYOUT-0925 — l'header è due righe ASSEGNATE, non un flusso che
          va a capo dove capita. Sulle larghezze vere della lobby (275px a 1280,
          310 a 390) il vecchio `flex-wrap` produceva tre righe — sport+lega /
          orario / badge+watch — con il gruppo `margin-left:auto` da solo su
          una riga vuota: quasi metà card di meta-informazione. Ora: riga 1 =
          cos'è (sport, lega); riga 2 = quando (orario o LIVE) e il badge. La
          watchlist scende nel piede, accanto alla CTA: le due azioni insieme,
          l'informazione sopra. */}
      <header className="br-card__kicker">
        <span className="br-card__meta">
          <SportChip sport={data.sport} />
          <LeagueChip league={data.league} />
        </span>
        {(live || data.kickoffLabel || resolvedBadge) && (
          <span className="br-card__status">
            {live ? <LiveBadge minute={data.liveMinute} /> : data.kickoffLabel ? <span className="br-card__when">{data.kickoffLabel}</span> : null}
            {/* Punteggio in una forma che non è «a-b»: si mostra intero, qui,
                piuttosto che in una colonna sbagliata. */}
            {live && data.liveScoreLabel && !score && <span className="br-card__scoreraw">{data.liveScoreLabel}</span>}
            {resolvedBadge && (
              <span className="br-badge" data-kind={resolvedBadge.kind}><BadgeIcon kind={resolvedBadge.kind} />{resolvedBadge.label ?? BADGE_LABEL[resolvedBadge.kind]}</span>
            )}
          </span>
        )}
      </header>

      {/* #CARD-LAYOUT-0925 — le squadre sono SEMPRE due righe impilate, come
          già fa MatchHeader al livello 2. Prima andavano a capo solo quando i
          nomi non entravano (la maggioranza dei casi reali), e la stessa
          griglia mescolava card inline con «vs» e card impilate con il «vs»
          appeso in fondo al primo nome: altezze da 249 a 297px.
          Il punteggio live (#LIVE-SCORE-CARD-0925 lo metteva al posto del
          «vs», bocciato da Andrea il 25/09) sta ora in COLONNA a destra, un
          valore per riga accanto alla squadra a cui appartiene — il tabellone
          che chi guarda una partita legge da sempre; nel tennis un set per
          colonna. Il «vs» resta solo per chi ascolta la pagina. */}
      <div className="br-card__match">
        <h3 className="br-card__teams" data-score={score ? "true" : undefined}>
          <span className="br-card__team" data-role="home">
            <Crest team={data.home} sport={data.sport} size={crestSize} role="home" />
            <span className="br-card__name" title={data.home}>{data.home}</span>
            {score && <ScoreCells cells={score.home} testId="score-home" />}
          </span>
          <span className="br-card__vs">vs</span>
          <span className="br-card__team" data-role="away">
            <Crest team={data.away} sport={data.sport} size={crestSize} role="away" />
            <span className="br-card__name" title={data.away}>{data.away}</span>
            {score && <ScoreCells cells={score.away} testId="score-away" />}
          </span>
          {score && <span className="br-card__vs">Live score {data.liveScoreLabel}</span>}
        </h3>
      </div>

      <p className="br-card__pick">
        <span className="br-label">Pick</span>
        {locked ? (
          <span className="br-card__pick-v" data-locked="true"><IconLock size={13} stroke={2} />Pro pick</span>
        ) : (
          <span className="br-card__pick-v" title={data.pick ?? undefined}>{data.pick ?? "—"}</span>
        )}
      </p>

      {/* Round 4: un numero solo, il nostro. Nessun `locked`: la probabilità è
          il valore che il free deve vedere, il lucchetto sta sulla pick qui
          sopra. Il confronto col mercato è nella scheda partita. */}
      <p className="br-card__model" data-size={size}>
        <span className="br-card__model-n">
          {formatPct(data.modelPct)}
          {data.modelPct != null && <span className="br-card__model-pc">%</span>}
        </span>
        <span className="br-label">Our model</span>
      </p>

      {extra}

      <footer className="br-card__foot">
        {showWhy && <p className="br-card__why"><strong>Why the model disagrees.</strong> {data.explanation}</p>}
        <span className="br-card__foot-l">
          {onToggleWatchlist && <WatchlistButton saved={!!saved} onToggle={onToggleWatchlist} />}
        </span>
        <Link href={href} className="br-cta" data-tone={ctaTone} onClick={onOpen} aria-label={`${ctaText}: ${data.home} vs ${data.away}`}>
          {locked && <IconLock size={14} />}
          {ctaText}
          {!locked && <IconArrow size={14} />}
        </Link>
      </footer>
    </article>
  );
}
