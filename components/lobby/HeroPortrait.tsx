// components/lobby/HeroPortrait.tsx — #RESTYLING-0921 round 7
//
// L'hero del riferimento non è un banner largo né il quadratino del round 4: è
// una CARD VERTICALE nel rail sinistro (26% della riga), con le card vere del
// board nella colonna accanto. Misure lette dal CSS computato del riferimento
// (359×610, ratio 1:1,70): bordo 1px rgba(72,164,255,.4), raggio 6, hover
// `scale(1.035)` sulla sola immagine, velo a quattro stop.
//
// Dentro: la label in alto a sinistra, e in basso il titolo su più righe
// (l'ultima in gradiente lime), una riga di testo e una barra CTA lime a tutta
// larghezza. Nel riferimento NON c'è un badge statistico dentro l'hero — il
// numero sta sulle card, ed è lì che deve restare.
import Link from "next/link";
import type { MouseEvent } from "react";

export type HeroPortraitProps = {
  label: string;
  /** Le righe del titolo. L'ULTIMA è l'accento (gradiente lime). */
  lines: string[];
  sub?: string;
  cta: string;
  href: string;
  image: { src: string; srcSm?: string; alt?: string };
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
};

export function HeroPortrait({ label, lines, sub, cta, href, image, onClick, className }: HeroPortraitProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={["br-hp", className].filter(Boolean).join(" ")}
      aria-label={`${lines.join(" ")} — ${cta}`}
    >
      <img
        className="br-hp__img"
        src={image.src}
        srcSet={image.srcSm ? `${image.srcSm} 420w, ${image.src} 705w` : undefined}
        sizes="(max-width: 780px) 100vw, 360px"
        width={705}
        height={941}
        alt={image.alt ?? ""}
        /* È l'LCP della Home: si carica subito, non in coda. */
        fetchPriority="high"
        decoding="async"
      />
      <span className="br-hp__scrim" aria-hidden="true" />
      <span className="br-hp__label">{label}</span>
      <span className="br-hp__copy">
        <span className="br-hp__title" aria-hidden="true">
          {lines.map((l, i) => (
            <span key={l} className="br-hp__line" data-accent={i === lines.length - 1 ? "true" : undefined}>{l}</span>
          ))}
        </span>
        {sub && <span className="br-hp__sub">{sub}</span>}
        <span className="br-hp__cta">{cta}<b aria-hidden="true">↗</b></span>
      </span>
    </Link>
  );
}

/** Il blocco sotto l'hero: il secondo richiamo al Pro del rail sinistro.
 *  Stessa anatomia della fascia Pro (gradiente royal, filo azzurro a
 *  sinistra), ma verticale — nel riferimento è il `rail-deep`. */
export function RailDeep({ label, lines, cta, href, onClick, className }: {
  label: string;
  lines: string[];
  cta: string;
  href: string;
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}) {
  return (
    <Link href={href} onClick={onClick} className={["br-raildeep", className].filter(Boolean).join(" ")}>
      <span className="br-raildeep__label">{label}</span>
      <strong className="br-raildeep__h">
        {lines.map((l) => <span key={l}>{l}</span>)}
      </strong>
      <span className="br-raildeep__cta">{cta}<b aria-hidden="true">↗</b></span>
    </Link>
  );
}
