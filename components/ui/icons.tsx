// components/ui/icons.tsx — #RESTYLING-0921 round 3
//
// Il set di icone della casa. Un solo sistema al posto dei tre che si erano
// sommati (glyphs.tsx a 2px con punte tonde, lo sprite sport-glyphs a 1.5px con
// una forma in coral, i PNG 3D menu-*.png nel bottom-nav): tre stili diversi
// nella stessa barra è esattamente quello che fa leggere un'interfaccia come
// «assemblata da una libreria».
//
// La firma, in quattro regole — sono queste che fanno riconoscere il segno,
// non il soggetto:
//   1. Griglia 24, area viva 3,5–20,5. Tratto 1,75 (a 20px ≈ 1,46px; a 16px
//      ≈ 1,17px — sotto i 14px il chiamante passa `stroke={2}`).
//   2. Punte PIATTE e giunti a SPIGOLO (`butt` + `miter`). Le librerie
//      generiche (Feather, Lucide, Heroicons) hanno tutte punte tonde: è il
//      tratto tondo che fa «template». Qui il segno è tagliato, non arrotondato.
//   3. Il TAGLIO: ogni forma chiusa rettangolare perde l'angolo in alto a
//      sinistra con uno smusso a 45° (bookmark, lucchetto, calcolatrice,
//      registro). È lo stesso smusso delle schede prediction e di GlyphRank —
//      la forma dice «BetRedge» prima del soggetto.
//   4. UNA faccia piena per icona, al massimo, e sempre in currentColor
//      (il pentagono del pallone, l'ago della bussola, il delta dentro il
//      delta). Nessun secondo colore dentro l'icona: il colore lo dà il
//      contesto, e resta uno solo per schermata (regola della densità, round 3).
//
// Tutto eredita `currentColor`. `label` presente → role="img" + aria-label;
// assente → aria-hidden (decorativa, il testo accanto dice già cosa è).
import type { SVGProps } from "react";

export type IconProps = {
  size?: number;
  /** Peso del tratto; alzare a 2 sotto i 14px. */
  stroke?: number;
  className?: string;
  /** Se presente l'icona è informativa (role="img"); altrimenti decorativa. */
  label?: string;
  style?: SVGProps<SVGSVGElement>["style"];
};

function Svg({ size = 20, stroke = 1.75, className, label, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ display: "inline-block", verticalAlign: "-0.15em", flex: "none", ...style }}
    >
      {children}
    </svg>
  );
}

/* ── Navigazione ─────────────────────────────────────────────────────────── */

/** Casa: tetto a spigolo, corpo aperto, porta. Home / Discover. */
export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 11.75 12 4.25l8.5 7.5" />
      <path d="M6 10v10.5h12V10" />
      <path d="M10.25 20.5V15h3.5v5.5" />
    </Svg>
  );
}

/** Live: un punto pieno e due coppie di archi — «sta trasmettendo adesso». */
export function IconLive(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" />
      <path d="M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" />
    </Svg>
  );
}

/** Bussola: la scoperta (Explore). L'ago ha la punta nord piena. */
export function IconExplore(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.4 8.6 13.13 13.13 8.6 15.4l2.27-4.53z" />
      <path d="M15.4 8.6 13.13 13.13l-2.26-2.26z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Calcolatrice col taglio: l'hub Tools (odds converter, EV, builder). */
export function IconTools(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 3.5h11.5v17H4.5V7z" />
      <path d="M8 7.5h8" />
      <path d="M8 11.5h2.5M13.5 11.5H16M8 15.5h2.5M13.5 15.5H16" />
    </Svg>
  );
}

/** Profilo / account. */
export function IconProfile(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8.25" r="3.75" />
      <path d="M4.5 20.5v-.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6v.5" />
    </Svg>
  );
}

/** Ricerca. */
export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 20.5 20.5" />
    </Svg>
  );
}

/** Segnalibro col taglio. `filled` = salvato in watchlist. */
export function IconBookmark({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p}>
      <path d="M9.5 3.5h8v17L12 16.6l-5.5 3.9v-14z" fill={filled ? "currentColor" : "none"} />
    </Svg>
  );
}

/* ── Sport ───────────────────────────────────────────────────────────────── */

/** Pallone: un pentagono pieno e le cinque cuciture che ne partono. */
export function IconFootball(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 9l2.85 2.07-1.09 3.36h-3.52L9.15 11.07z" fill="currentColor" stroke="none" />
      <path d="M12 9V3.5M14.85 11.07l5.23-1.7M13.76 14.43 17 18.88M10.24 14.43 7 18.88M9.15 11.07 3.92 9.37" />
    </Svg>
  );
}

/** Pallina da tennis: due cuciture curve, niente croce (quella è il basket). */
export function IconTennis(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.6 5.6c3.2 2.7 3.2 10.1 0 12.8M17.4 5.6c-3.2 2.7-3.2 10.1 0 12.8" />
    </Svg>
  );
}

/** Basket: croce più due cuciture laterali. */
export function IconBasketball(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17M3.5 12h17" />
      <path d="M6 6c3.4 3.2 3.4 8.8 0 12M18 6c-3.4 3.2-3.4 8.8 0 12" />
    </Svg>
  );
}

/** Esports: un controller. Croce direzionale a sinistra, due tasti pieni a destra. */
export function IconEsports(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 7.5h10a4.5 4.5 0 0 1 4.5 4.5v3a1.75 1.75 0 0 1-3.1 1.1L16.5 14h-9l-1.9 2.1A1.75 1.75 0 0 1 2.5 15v-3A4.5 4.5 0 0 1 7 7.5z" />
      <path d="M7.5 10.25v3.5M5.75 12h3.5" />
      <circle cx="15.5" cy="11.25" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="17.75" cy="12.75" r="0.95" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** «More sports» / menu overflow: tre quadrati pieni, non tre puntini. */
export function IconMore(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 10.75h2.5v2.5H3.5zM10.75 10.75h2.5v2.5h-2.5zM18 10.75h2.5v2.5H18z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Mappa sport → icona. Sconosciuto → IconMore (mai un pallone generico). */
export function IconSport({ sport, ...p }: IconProps & { sport: string }) {
  const s = sport.toLowerCase();
  if (s.includes("tenn")) return <IconTennis {...p} />;
  if (s.includes("foot") || s.includes("calc") || s.includes("soccer")) return <IconFootball {...p} />;
  if (s.includes("bask")) return <IconBasketball {...p} />;
  if (s.includes("esport") || s.includes("e-sport") || s.includes("gaming")) return <IconEsports {...p} />;
  return <IconMore {...p} />;
}

/* ── Stato e dati ────────────────────────────────────────────────────────── */

/** Stella a spigoli vivi: Featured / scelta del modello. `filled` per lo stato attivo. */
export function IconStar({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p}>
      <path d="M12 3.5l2.35 5.76 6.21.46-4.76 4.02 1.49 6.04L12 16.5l-5.29 3.28 1.49-6.04-4.76-4.02 6.21-.46z" fill={filled ? "currentColor" : "none"} />
    </Svg>
  );
}

/** L'edge: un delta (Δ = differenza) con un delta pieno dentro. High edge, edge indicator. */
export function IconEdge(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4.5l8.5 15H3.5z" />
      <path d="M12 10.25l3.5 6.25h-7z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Confidenza: un manometro — arco, ago, perno pieno. Indicatore secondario. */
export function IconConfidence(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 16.5a8 8 0 0 1 16 0" />
      <path d="M12 16.5l3.6-6.2" />
      <circle cx="12" cy="16.5" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Orologio: Starting soon, kickoff. */
export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.25V12h3.75" />
    </Svg>
  );
}

/** Andamento: track record nel tempo. */
export function IconTrend(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 17.5 9.25 11.75l3.5 3.5L20.5 7.5" />
      <path d="M20.5 12.5v-5h-5" />
    </Svg>
  );
}

/** Registro col taglio e bordo a strappo: il log delle pick concluse (History). */
export function IconLedger(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 3.5h8.5v17l-2.75-1.9-2.75 1.9-2.75-1.9L6.5 20.5V6z" />
      <path d="M10 9h4.5M10 12.5h4.5" />
    </Svg>
  );
}

/** Lucchetto col taglio: Pro pick, analisi bloccata. */
export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7.5 10.5h12v10h-15v-7z" />
      <path d="M8 10.5V7.75a4 4 0 0 1 8 0v2.75" />
    </Svg>
  );
}

/** Tre lastre a rombo: l'accumulatore (Probability Builder). */
export function IconStack(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" />
      <path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
    </Svg>
  );
}

/* ── Azioni ──────────────────────────────────────────────────────────────── */

/** Freccia: «vai a vedere». */
export function IconArrow(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 12h15.5" />
      <path d="M14 6.5l5.5 5.5-5.5 5.5" />
    </Svg>
  );
}

/** Spunta. */
export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 12.5l5 5 10-10.5" />
    </Svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9.5l6 6 6-6" />
    </Svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 6l6 6-6 6" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </Svg>
  );
}

/* ── Registro per nome (config di nav e bottom-nav) ─────────────────────── */

export const ICONS = {
  home: IconHome,
  live: IconLive,
  explore: IconExplore,
  tools: IconTools,
  profile: IconProfile,
  search: IconSearch,
  bookmark: IconBookmark,
  football: IconFootball,
  tennis: IconTennis,
  basketball: IconBasketball,
  esports: IconEsports,
  more: IconMore,
  star: IconStar,
  edge: IconEdge,
  confidence: IconConfidence,
  clock: IconClock,
  trend: IconTrend,
  ledger: IconLedger,
  lock: IconLock,
  stack: IconStack,
  arrow: IconArrow,
  check: IconCheck,
  chevronDown: IconChevronDown,
  chevronRight: IconChevronRight,
  close: IconClose,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, ...p }: IconProps & { name: IconName }) {
  const C = ICONS[name] as (props: IconProps) => React.JSX.Element;
  return <C {...p} />;
}
