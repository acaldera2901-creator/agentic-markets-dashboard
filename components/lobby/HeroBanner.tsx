// components/lobby/HeroBanner.tsx — #RESTYLING-0921 round 4
//
// Il banner in testa alla Home. Round 4: QUADRATO e PICCOLO — occupa meno di
// metà larghezza (il layout lo decide `.br-home-top` in app/design-system.css)
// e nello spazio che libera di fianco ci vanno prediction card vere, non aria.
// Dentro il quadrato: l'immagine della casa a tutta superficie, e sopra — in
// basso, sotto un velo — eyebrow, headline breve, i numeri veri e la CTA.
//
// Perché: il banner largo del round 3 (tipografia enorme su texture in duotone)
// è stato bocciato nella FORMA prima che nel contenuto — «quadrato, non largo,
// decisamente più piccolo, e a fianco le card». La texture trattata in duotone
// dal CSS non c'è più: l'immagine è già nella palette (pallone che si dissolve
// in mesh dati blu/lime) e si mostra com'è. Resta la variante B — pannello
// nudo con la riga di calce — per chi non passa `image`.
//
// Tutto ciò che è un NUMERO o una PROMESSA arriva dal chiamante:
//   - `stats`  → i conteggi (live / starting soon / high edge). Una stat con
//                value null NON si rende: meglio due cifre vere che tre con un
//                trattino.
//   - `points` → la checklist (`aside`). Nessun default: «Trusted by 100K+
//                bettors» nell'immagine di riferimento era un placeholder di
//                ChatGPT, non un dato nostro. Round 3: la scatola a destra non
//                esiste più; se il chiamante passa i punti, stanno in coda al
//                banner come una riga piana, senza cornice.
//   - `image`  → l'immagine del quadrato, 1:1. `srcSm` è la versione ≤640px
//                (480², un quarto del peso): la sceglie il browser via
//                srcset/sizes. Senza `image`, la variante B. È decorativa:
//                `alt` di default "".
//
// La parola accentata si passa come <em> dentro `title`: semantica di
// enfasi, resa in lime dal CSS (.br-hero__title em).
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { IconArrow, IconCheck } from "@/components/ui/icons";

export type HeroStatKind = "live" | "starting-soon" | "high-edge";

export type HeroStat = {
  kind: HeroStatKind;
  label: string;
  /** null = non lo sappiamo → la cifra non si rende. */
  value: number | null;
  href?: string;
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
};

export type HeroBannerProps = {
  eyebrow: string;
  /** Headline; la parola accentata va in <em>. Es. <>Top opportunities <em>today.</em></> */
  title: ReactNode;
  subtitle?: string;
  stats?: HeroStat[];
  cta: { label: string; href: string; onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void };
  secondary?: { label: string; href: string; onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void };
  /** Punti in coda al banner. Omessi → niente. */
  aside?: { title?: ReactNode; subtitle?: string; points: string[] };
  /** L'immagine del quadrato. Omessa → variante B, solo tipografia. */
  image?: { src: string; srcSm?: string; alt?: string };
  className?: string;
};

// La riga di calce della variante B: una linea sola, 2px, −7°. È un <svg>
// (non un div ruotato) così la linea è disegnata, scala col banner e non
// produce overflow. Su telefono la texture si spegne e resta questa.
function ChalkLine() {
  return (
    <svg className="br-hero__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
      <line x1="-4" y1="52" x2="104" y2="40" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function HeroBanner({ eyebrow, title, subtitle, stats, cta, secondary, aside, image, className }: HeroBannerProps) {
  const shownStats = (stats ?? []).filter((s) => s.value != null);
  const hasAside = !!aside && aside.points.length > 0;
  return (
    <section
      className={["br-hero", className].filter(Boolean).join(" ")}
      data-has-aside={hasAside ? "true" : "false"}
      data-art={image ? "photo" : "type"}
      aria-label={eyebrow}
    >
      {/* Fondo: l'immagine (se c'è) + riga di calce. Il velo che regge il testo
          e la grana stanno nel CSS (.br-hero__art::after, .br-hero__grain). */}
      <div className="br-hero__art">
        {image && (
          <img
            className="br-hero__tex"
            src={image.src}
            srcSet={image.srcSm ? `${image.srcSm} 480w, ${image.src} 960w` : undefined}
            sizes="(max-width: 640px) 100vw, 420px"
            width={960}
            height={960}
            alt={image.alt ?? ""}
            /* È l'LCP della Home: si carica subito, non in coda. */
            fetchPriority="high"
            decoding="async"
          />
        )}
        <ChalkLine />
      </div>
      <i className="br-hero__grain" aria-hidden />

      <p className="br-hero__eyebrow">{eyebrow}</p>
      <h1 className="br-hero__title">{title}</h1>

      <div className="br-hero__row">
        {subtitle && <p className="br-hero__sub">{subtitle}</p>}
        {shownStats.length > 0 && (
          <ul className="br-hero__stats">
            {shownStats.map((s) => {
              const inner = (
                <>
                  <b className="br-hero__stat-n">{s.value}</b>
                  <span className="br-hero__stat-l">{s.label}</span>
                </>
              );
              return (
                <li key={s.kind} data-kind={s.kind}>
                  {s.href ? (
                    <Link href={s.href} className="br-hero__stat" onClick={s.onClick}>{inner}</Link>
                  ) : (
                    <span className="br-hero__stat">{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="br-hero__ctas">
        <Link href={cta.href} className="br-hero__cta" data-tone="primary" onClick={cta.onClick}>
          {cta.label}
          <IconArrow size={16} />
        </Link>
        {secondary && (
          <Link href={secondary.href} className="br-hero__cta" data-tone="ghost" onClick={secondary.onClick}>
            {secondary.label}
          </Link>
        )}
      </div>

      {hasAside && aside && (
        <aside className="br-hero__aside">
          {aside.title && <h2 className="br-hero__aside-h">{aside.title}</h2>}
          {aside.subtitle && <p className="br-hero__aside-sub">{aside.subtitle}</p>}
          <ul className="br-hero__points">
            {aside.points.map((p) => (
              <li key={p}><IconCheck size={12} stroke={2} />{p}</li>
            ))}
          </ul>
        </aside>
      )}
    </section>
  );
}
